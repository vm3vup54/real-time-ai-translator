import { processAudioBidirectional as geminiBidirectional, processAudioForSubtitles as geminiSubtitles } from './gemini';
import { processAudioBidirectionalOpenAI, processAudioForSubtitlesOpenAI } from './openai';
import type { AiProvider } from '../components/ApiKeyProvider';

export async function processAudioBidirectionalUnified(
  provider: AiProvider,
  apiKey: string,
  audioBlob: Blob, 
  langA: string,
  langB: string,
  previousContext: string = ''
) {
  if (provider === 'gemini') {
    const base64Audio = await blobToBase64(audioBlob);
    return geminiBidirectional(apiKey, base64Audio, langA, langB, previousContext);
  } else {
    return processAudioBidirectionalOpenAI(apiKey, audioBlob, langA, langB, previousContext);
  }
}

export async function processAudioForSubtitlesUnified(
  provider: AiProvider,
  apiKey: string,
  audioBlob: Blob,
  targetLangs: string[],
  sourceLangHint: string = 'auto'
) {
  if (provider === 'gemini') {
    const base64Audio = await blobToBase64(audioBlob);
    return geminiSubtitles(apiKey, base64Audio, targetLangs, sourceLangHint);
  } else {
    return processAudioForSubtitlesOpenAI(apiKey, audioBlob, targetLangs, sourceLangHint);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve((reader.result as string).split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
