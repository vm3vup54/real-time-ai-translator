import { useState, useRef, useCallback, useEffect } from 'react';

export interface VADOptions {
  /** 靜音閾值，低於此值視為靜音 (0~1)，預設 0.03 */
  silenceThreshold?: number;
  /** 靜音多久後斷句 (ms)，預設 1000 */
  silenceDurationMs?: number;
  /** 每一個 animation frame 更新音量的回呼函式（不透過 React state 以提升效能） */
  onVolumeChange?: (volume: number) => void;
}

const DEFAULT_SILENCE_THRESHOLD = 0.03;
const DEFAULT_SILENCE_DURATION_MS = 1000;
const MIN_SPEECH_MS = 1000;
/** 至少連續多少 frame 超過閾值才算開始說話，避免環境噪音觸發 */
const MIN_SPEECH_FRAMES = 3;

export function useVAD(onSpeechEnd: (audioBlob: Blob) => void, options?: VADOptions) {
  const [isListening, setIsListening] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentVolumeRef = useRef(0);

  const onSpeechEndRef = useRef(onSpeechEnd);
  onSpeechEndRef.current = onSpeechEnd;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateVolume = useCallback(() => {
    if (optionsRef.current?.onVolumeChange) {
      optionsRef.current.onVolumeChange(currentVolumeRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(updateVolume);
  }, []);


  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      gainNodeRef.current = gainNode;

      let isSpeaking = false;
      let silenceMs = 0;
      let speechBuffers: Float32Array[] = [];
      let currentSpeechMs = 0;
      /** 連續超過閾值的 frame 數 */
      let consecutiveSpeechFrames = 0;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let sumSq = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSq += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSq / inputData.length);

        // Update volume ref for visualizer
        currentVolumeRef.current = Math.min(1, rms * 15);

        const threshold = optionsRef.current?.silenceThreshold ?? DEFAULT_SILENCE_THRESHOLD;
        const silenceDuration = optionsRef.current?.silenceDurationMs ?? DEFAULT_SILENCE_DURATION_MS;

        const frameMs = (inputData.length / audioCtx.sampleRate) * 1000;

        if (rms > threshold) {
          if (!isSpeaking) {
            consecutiveSpeechFrames++;
            // 連續超過閾值 N frame 才判定為開始說話
            if (consecutiveSpeechFrames >= MIN_SPEECH_FRAMES) {
              isSpeaking = true;
              silenceMs = 0;
              currentSpeechMs = consecutiveSpeechFrames * frameMs;
            }
            // 不管有沒有開始，先緩存（避免丟掉前幾 frame）
            speechBuffers.push(new Float32Array(inputData));
          } else {
            silenceMs = 0;
            currentSpeechMs += frameMs;
            speechBuffers.push(new Float32Array(inputData));
          }
        } else {
          if (!isSpeaking) {
            // 還沒開始說話，重置連續計數和暫存
            consecutiveSpeechFrames = 0;
            // 保留最多 MIN_SPEECH_FRAMES 個 buffer 作 pre-buffer
            if (speechBuffers.length > MIN_SPEECH_FRAMES) {
              speechBuffers = speechBuffers.slice(-MIN_SPEECH_FRAMES);
            }
          }

          if (isSpeaking) {
            silenceMs += frameMs;
            speechBuffers.push(new Float32Array(inputData));

            if (silenceMs >= silenceDuration) {
              if (currentSpeechMs >= MIN_SPEECH_MS) {
                const totalLength = speechBuffers.reduce((acc, buf) => acc + buf.length, 0);
                const merged = new Float32Array(totalLength);
                let offset = 0;
                for (const buf of speechBuffers) {
                  merged.set(buf, offset);
                  offset += buf.length;
                }

                const wavBuffer = encodeWavFromFloat32(merged, audioCtx.sampleRate);
                const blob = new Blob([wavBuffer], { type: 'audio/wav' });
                onSpeechEndRef.current(blob);
              }

              isSpeaking = false;
              silenceMs = 0;
              currentSpeechMs = 0;
              consecutiveSpeechFrames = 0;
              speechBuffers = [];
            }
          }
        }
      };

      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      setIsListening(true);
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    } catch (e) {
      console.error("VAD start error", e);
    }
  }, [updateVolume]);

  const stop = useCallback(() => {
    if (processorRef.current) processorRef.current.disconnect();
    if (gainNodeRef.current) gainNodeRef.current.disconnect();
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        audioCtxRef.current.close();
      } catch (e) {
        console.error("Error closing AudioContext:", e);
      }
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    setIsListening(false);
    currentVolumeRef.current = 0;
    if (optionsRef.current?.onVolumeChange) {
      optionsRef.current.onVolumeChange(0);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch (e) { }
      }
    };
  }, []);

  return { isListening, start, stop };
}

function floatTo16BitPCM(float32Array: Float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
  }
  return buffer;
}

function writeString(dataview: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    dataview.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWavFromFloat32(float32Array: Float32Array, sampleRate: number) {
  const pcmBuffer = floatTo16BitPCM(float32Array);
  const wavBuffer = new ArrayBuffer(44 + pcmBuffer.byteLength);
  const view = new DataView(wavBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + float32Array.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, float32Array.length * 2, true);

  const bytes = new Uint8Array(wavBuffer, 44);
  const pcmBytes = new Uint8Array(pcmBuffer);
  bytes.set(pcmBytes);

  return wavBuffer;
}
