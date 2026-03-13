export async function processAudioBidirectionalOpenAI(
  apiKey: string,
  audioBlob: Blob,
  langA: string,
  langB: string,
  previousContext: string = ''
) {
  try {
    // 1. STT: Whisper 語音轉文字
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav'); // 需要給附檔名
    formData.append('model', 'whisper-1');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    
    if (!whisperRes.ok) throw new Error('Whisper API failed');
    const { text: transcription } = await whisperRes.json();
    if (!transcription) return null;

    // 2. Translation: 用 GPT-4o-mini 或 gpt-4o 來做雙向判斷與翻譯
    const systemPrompt = `You are a professional interpreter.
Given this transcription: "${transcription}"
1. Detect the spoken language.
2. Determine target language:
   - If spoken language is ${langA}, translate to ${langB}.
   - If spoken language is ${langB}, translate to ${langA}.
   - If ${langA} is 'auto', translate to ${langB}.
   - If ${langB} is 'auto', translate to ${langA}.
   - If both are 'auto', translate to English.
${previousContext ? `Previous context: "${previousContext}"` : ''}
Return precisely this JSON format:
{
  "source_text": "the transcription",
  "detected_language": "the language code of the spoken audio (e.g. zh-TW or en-US)",
  "translation": "the translated text",
  "target_language": "the language code of the translation"
}`;

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!gptRes.ok) throw new Error('GPT API failed');
    const gptData = await gptRes.json();
    return JSON.parse(gptData.choices[0].message.content);

  } catch (e) {
    console.error("OpenAI processing error (Bidirectional):", e);
    return null;
  }
}

export async function processAudioForSubtitlesOpenAI(
  apiKey: string,
  audioBlob: Blob,
  targetLangs: string[],
  sourceLangHint: string = 'auto'
) {
  if (targetLangs.length === 0) return null;

  try {
    // 1. STT: Whisper 取得原文
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    
    if (!whisperRes.ok) throw new Error('Whisper API failed');
    const { text: transcription } = await whisperRes.json();
    if (!transcription) return null;

    // 2. Translation: GTP 將原文翻譯成多國語言
    const systemPrompt = `You are a professional interpreter.
Given this transcription: "${transcription}"
1. Detect the spoken language. ${sourceLangHint !== 'auto' ? `(Hint: it is likely ${sourceLangHint})` : ''}
2. Translate the transcription into the following target languages: ${targetLangs.join(', ')}.
Return ONLY a JSON object with this precise structure:
{
  "source_text": "...",
  "detected_language": "...",
  "translations": [
    { "language": "target_lang_1", "text": "translation 1" },
    { "language": "target_lang_2", "text": "translation 2" }
  ]
}`;

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!gptRes.ok) throw new Error('GPT API failed');
    const gptData = await gptRes.json();
    const result = JSON.parse(gptData.choices[0].message.content);
    
    // 轉換資料結構以符合目前 UI 端預定接收的 Record 格式
    if (result.translations && Array.isArray(result.translations)) {
      const translationsRecord: Record<string, string> = {};
      result.translations.forEach((t: any) => {
        const matchedLang = targetLangs.find(l =>
          l.toLowerCase() === t.language.toLowerCase() ||
          t.language.toLowerCase().includes(l.toLowerCase().split('-')[0])
        ) || t.language;
        translationsRecord[matchedLang] = t.text;
      });
      result.translations = translationsRecord;
    }

    return result;

  } catch (e) {
    console.error("OpenAI processing error (Subtitles):", e);
    return null;
  }
}
