import { GoogleGenAI, Type } from '@google/genai';
import { MODEL_FLASH } from '../config/models';

/** 建立 Gemini AI client（動態 API Key） */
export function createAiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

export async function processAudioBidirectional(
  apiKey: string,
  base64Audio: string,
  langA: string,
  langB: string,
  previousContext: string = ''
) {
  const ai = createAiClient(apiKey);

  const systemInstruction = `You are a professional interpreter. 
Listen to the audio.
1. Transcribe the audio accurately.
2. Detect the spoken language.
3. Determine the target language based on these rules:
   - If the spoken language is ${langA}, translate to ${langB}.
   - If the spoken language is ${langB}, translate to ${langA}.
   - If ${langA} is 'auto', translate to ${langB}.
   - If ${langB} is 'auto', translate to ${langA}.
   - If both are 'auto', translate to English.
${previousContext ? `Previous conversation context for reference: "${previousContext}"\nUse this context to resolve pronouns and ambiguous terms.` : ''}
Return ONLY a JSON object with this structure:
{
  "source_text": "the transcription",
  "detected_language": "the language code of the spoken audio (e.g. zh-TW or en-US)",
  "translation": "the translated text",
  "target_language": "the language code of the translation"
}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: [
        {
          inlineData: {
            data: base64Audio,
            mimeType: 'audio/wav'
          }
        },
        {
          text: "Process this audio."
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            source_text: { type: Type.STRING },
            detected_language: { type: Type.STRING },
            translation: { type: Type.STRING },
            target_language: { type: Type.STRING }
          },
          required: ["source_text", "detected_language", "translation", "target_language"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Audio processing error:", e);
    return null;
  }
}

export async function processAudioForSubtitles(
  apiKey: string,
  base64Audio: string,
  targetLangs: string[],
  sourceLangHint: string = 'auto'
) {
  if (targetLangs.length === 0) return null;
  const ai = createAiClient(apiKey);

  const systemInstruction = `You are a professional interpreter.
Listen to the audio.
1. Transcribe the audio accurately.
2. Detect the spoken language. ${sourceLangHint !== 'auto' ? `(Hint: it is likely ${sourceLangHint})` : ''}
3. Translate the transcription into the following target languages: ${targetLangs.join(', ')}.
Return ONLY a JSON object with this structure:
{
  "source_text": "the transcription",
  "detected_language": "the language code of the spoken audio (e.g. zh-TW or en-US)",
  "translations": [
    { "language": "target_lang_1", "text": "translation 1" }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: [
        { inlineData: { data: base64Audio, mimeType: 'audio/wav' } },
        { text: "Process this audio." }
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            source_text: { type: Type.STRING },
            detected_language: { type: Type.STRING },
            translations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  language: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ["language", "text"]
              }
            }
          },
          required: ["source_text", "detected_language", "translations"]
        }
      }
    });

    const data = JSON.parse(response.text || '{}');

    // 將陣列轉換為 Record 以供 UI 使用
    if (data.translations && Array.isArray(data.translations)) {
      const translationsRecord: Record<string, string> = {};
      data.translations.forEach((t: any) => {
        const matchedLang = targetLangs.find(l =>
          l.toLowerCase() === t.language.toLowerCase() ||
          t.language.toLowerCase().includes(l.toLowerCase().split('-')[0])
        ) || t.language;

        translationsRecord[matchedLang] = t.text;
      });
      data.translations = translationsRecord;
    }

    return data;
  } catch (e) {
    console.error("Audio processing error:", e);
    return null;
  }
}

export async function generateTTS(text: string, langHint: string = 'en-US'): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.error("Browser does not support Web Speech API");
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 根據語言設定語系
    if (langHint === 'zh-TW') {
      utterance.lang = 'zh-TW';
    } else if (langHint === 'en-US') {
      utterance.lang = 'en-US';
    } else if (langHint === 'ja-JP') {
      utterance.lang = 'ja-JP';
    } else if (langHint === 'ko-KR') {
      utterance.lang = 'ko-KR';
    } else {
      utterance.lang = langHint;
    }

    // 當語音播放結束時 resolve Promise
    utterance.onend = () => {
      resolve();
    };

    // 發生錯誤也 resolve 避免卡死隊列
    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}
