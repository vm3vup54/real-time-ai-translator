import { useState, useRef, useEffect, useCallback } from 'react';
import { generateTTS } from '../services/gemini';
import { processAudioBidirectionalUnified } from '../services/ai';
import { useVAD, VADOptions } from '../hooks/useVAD';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { useApiKey } from './ApiKeyProvider';
import { LANGUAGES, findLanguage } from '../config/languages';
import { ArrowLeft, Mic, Loader2, Download, Settings2, Square, Monitor, MessageSquareText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type DisplayMode = 'youtube' | 'chat';

export function InterpMode({ onBack }: { onBack: () => void }) {
  const { provider, activeKey } = useApiKey();
  const [langA, setLangA] = useState('zh-TW');
  const [langB, setLangB] = useState('en-US');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('youtube');

  const bar1Ref = useRef<HTMLDivElement>(null);
  const bar2Ref = useRef<HTMLDivElement>(null);
  const bar3Ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { silenceThreshold, setSilenceThreshold, silenceDurationMs, setSilenceDurationMs } = useAudioSettings();
  const vadOptions: VADOptions = {
    silenceThreshold,
    silenceDurationMs,
    onVolumeChange: (vol) => {
      // 透過 Ref 直接修改高度，不觸發 React 重新渲染
      if (bar1Ref.current) bar1Ref.current.style.height = `${Math.max(20, vol * 100)}%`;
      if (bar2Ref.current) bar2Ref.current.style.height = `${Math.max(20, vol * 80)}%`;
      if (bar3Ref.current) bar3Ref.current.style.height = `${Math.max(20, vol * 100)}%`;
    }
  };

  const [history, setHistory] = useState<Array<{
    id: string,
    type: 'A_TO_B' | 'B_TO_A',
    sourceText: string,
    translatedText: string
  }>>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** 強制停止一切：VAD、API 呼叫、音訊播放 */
  const forceStop = useCallback(() => {
    // 中斷進行中的 API 呼叫
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    // 停止音訊播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    setIsProcessing(false);
    setIsPlaying(false);
  }, []);

  const handleSpeechEnd = async (audioBlob: Blob) => {
    stop();
    setIsProcessing(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (controller.signal.aborted) return;

      // 取最後 2 筆上下文
      const recentContext = history.slice(-2).map(h => h.sourceText).join(' ');

      const result = await processAudioBidirectionalUnified(provider, activeKey, audioBlob, langA, langB, recentContext);
      if (controller.signal.aborted) return;

      if (result && result.source_text && result.translation) {
        const isA = result.detected_language.includes(langA.split('-')[0]);
        const direction: 'A_TO_B' | 'B_TO_A' = isA ? 'A_TO_B' : 'B_TO_A';

        const newEntry = {
          id: Date.now().toString(),
          type: direction,
          sourceText: result.source_text,
          translatedText: result.translation
        };

        setHistory(prev => [...prev, newEntry]);
        setIsPlaying(true);
        
        try {
          // 呼叫原生 TTS
          await generateTTS(result.translation, result.target_language);
        } catch (error) {
          console.error("TTS playback error:", error);
        } finally {
          setIsPlaying(false);
          setIsProcessing(false);
          start(); // 恢復監聽
        }
      } else {
        setIsProcessing(false);
        start();
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error("Audio processing error:", e);
      setIsProcessing(false);
      start();
    }
  };

  const { isListening, start, stop } = useVAD(handleSpeechEnd, vadOptions);

  useEffect(() => {
    return () => {
      stop();
      forceStop();
    };
  }, [stop, forceStop]);

  // 自動捲動到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isProcessing]);

  const toggleListening = () => {
    if (isListening || isProcessing || isPlaying) {
      // 完全停止：VAD + API + 音訊
      stop();
      forceStop();
    } else {
      start();
    }
  };

  const exportHistory = () => {
    const text = history.map(h =>
      `[${h.type === 'A_TO_B' ? '您 -> 對方' : '對方 -> 您'}]\n原文: ${h.sourceText}\n翻譯: ${h.translatedText}\n`
    ).join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interpretation_history_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const langAInfo = findLanguage(langA);
  const langBInfo = findLanguage(langB);
  const isActive = isListening || isProcessing || isPlaying;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* 頂部控制列 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-white">雙向口譯模式</h2>
            <p className="text-xs text-zinc-500">同步聆聽與雙向語音翻譯</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 顯示模式切換 */}
          <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
            <button
              onClick={() => setDisplayMode('youtube')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${displayMode === 'youtube'
                ? 'bg-zinc-700/50 text-zinc-200 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <Monitor className="w-3.5 h-3.5" /> 固定字幕
            </button>
            <button
              onClick={() => setDisplayMode('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${displayMode === 'chat'
                ? 'bg-zinc-700/50 text-zinc-200 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" /> 聊天堆疊
            </button>
          </div>

          {/* 音訊設定按鈕 */}
          <button
            onClick={() => setShowSettings(v => !v)}
            className={`p-2 rounded-lg transition-colors ${showSettings
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
          >
            <Settings2 className="w-4 h-4" />
          </button>

          <button
            onClick={exportHistory}
            disabled={history.length === 0}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> 匯出
          </button>
        </div>
      </div>

      {/* VAD 參數與語言設定面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-xs text-zinc-400">您的語言 (A)</label>
                  <select
                    value={langA}
                    onChange={(e) => setLangA(e.target.value)}
                    disabled={isActive}
                    className="w-full bg-zinc-950 border border-zinc-800 text-sm rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                  </select>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs text-zinc-400">對方的語言 (B)</label>
                  <select
                    value={langB}
                    onChange={(e) => setLangB(e.target.value)}
                    disabled={isActive}
                    className="w-full bg-zinc-950 border border-zinc-800 text-sm rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <label className="text-xs text-zinc-400">語音播放速度</label>
                <div className="flex gap-2">
                  {[0.8, 1.0, 1.2, 1.5].map(rate => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`px-3 py-1 rounded-md text-xs transition-colors ${playbackRate === rate ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 語言快顯與開始按鈕 */}
      <div className="flex items-center gap-4 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 mb-4">
        <div className="flex-1 flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">You</span>
            <span className="text-xs text-zinc-300 font-medium truncate">{langAInfo?.label}</span>
          </div>
          <div className="w-px h-4 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">Other</span>
            <span className="text-xs text-zinc-300 font-medium truncate">{langBInfo?.label}</span>
          </div>
        </div>

        <button
          onClick={toggleListening}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${isActive
            ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
            : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
            }`}
        >
          {isActive ? <><Square className="w-4 h-4 fill-white" /> 停止</> : <><Mic className="w-4 h-4" /> 開始口譯</>}
        </button>
      </div>

      {/* 主要內容區域 */}
      <div
        ref={scrollRef}
        className="flex-1 bg-zinc-950 rounded-2xl overflow-y-auto relative"
      >
        {displayMode === 'youtube' ? (
          <InterpYouTubeDisplay history={history} isProcessing={isProcessing} isPlaying={isPlaying} />
        ) : (
          <InterpChatDisplay history={history} isProcessing={isProcessing} isPlaying={isPlaying} />
        )}

        {/* 聆聽中極簡聲波狀態 */}
        {isListening && !isProcessing && !isPlaying && (
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pb-6 pt-12 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none">
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-6 py-2.5 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-4">
              <div className="flex items-center gap-1 h-5">
                <div ref={bar1Ref} className="w-1 bg-emerald-500 rounded-full" style={{ height: '20%', transition: 'height 50ms linear' }} />
                <div ref={bar2Ref} className="w-1 bg-emerald-500 rounded-full" style={{ height: '20%', transition: 'height 50ms linear' }} />
                <div ref={bar3Ref} className="w-1 bg-emerald-500 rounded-full" style={{ height: '20%', transition: 'height 50ms linear' }} />
              </div>
              <span className="font-semibold text-xs tracking-wide">聆聽中...</span>
            </div>
          </div>
        )}

        {/* 空白狀態 */}
        {history.length === 0 && !isProcessing && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
            <MessageSquareText className="w-16 h-16 mb-4 opacity-10" />
            <p className="text-sm">尚未有對話紀錄，點擊開始口譯</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ======= YouTube 固定底部字幕 (雙向口譯版) =======
function InterpYouTubeDisplay({ history, isProcessing, isPlaying }: { history: any[], isProcessing: boolean, isPlaying: boolean }) {
  const latest = history[history.length - 1];
  const previous = history.slice(-4, -1);

  return (
    <div className="h-full flex flex-col justify-end p-6">
      {/* 歷史段落 */}
      <div className="flex-1 overflow-y-auto mb-6 flex flex-col justify-end gap-5 overflow-hidden">
        {previous.map(item => (
          <div key={item.id} className="opacity-30 transition-opacity">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${item.type === 'A_TO_B' ? 'text-indigo-400 bg-indigo-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                {item.type === 'A_TO_B' ? 'You' : 'Other'}
              </span>
            </div>
            <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">{item.translatedText}</p>
          </div>
        ))}
      </div>

      {/* 底部當前字幕 */}
      <AnimatePresence mode="wait">
        {(latest || isProcessing) && (
          <motion.div
            key={latest?.id || 'processing'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 shadow-2xl relative overflow-hidden"
          >
            {isProcessing ? (
              <div className="flex items-center gap-4">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="text-zinc-400 font-medium">正在處理語音翻譯...</span>
              </div>
            ) : latest && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-[0.2em] px-3 py-1 rounded-full ${latest.type === 'A_TO_B' ? 'text-indigo-400 bg-indigo-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                    {latest.type === 'A_TO_B' ? 'You Spoke' : 'Other Spoke'}
                  </span>
                  {isPlaying && (
                    <div className="flex gap-1.5 px-3 py-1 bg-white/5 rounded-full items-center">
                      <div className="w-1 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                      <div className="w-1 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>
                  )}
                </div>
                <p className="text-zinc-500 text-xl md:text-2xl mb-4 font-medium italic opacity-60 leading-relaxed">「{latest.sourceText}」</p>
                <p className="text-white text-4xl md:text-6xl font-bold leading-tight tracking-tight shadow-sm">
                  {latest.translatedText}
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ======= 聊天堆疊模式 (雙向口譯版) =======
function InterpChatDisplay({ history, isProcessing }: { history: any[], isProcessing: boolean }) {
  // DOM 數量控制
  const visibleEntries = history.slice(-8);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {visibleEntries.map(item => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-800 transition-colors"
        >
          {/* 側邊標記條 */}
          <div className={`absolute top-0 left-0 h-full w-1 ${item.type === 'A_TO_B' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
          
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${item.type === 'A_TO_B' ? 'text-indigo-300 bg-indigo-500/10' : 'text-emerald-300 bg-emerald-500/10'}`}>
              {item.type === 'A_TO_B' ? 'You' : 'Other'}
            </span>
            <span className="text-[10px] text-zinc-700 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{new Date(parseInt(item.id)).toLocaleTimeString()}</span>
          </div>

          <p className="text-zinc-500 text-sm md:text-base mb-4 leading-relaxed max-w-2xl font-medium italic opacity-70">{item.sourceText}</p>
          <p className="text-2xl md:text-4xl font-bold text-zinc-100 leading-snug tracking-tight">
            {item.translatedText}
          </p>
        </motion.div>
      ))}

      {/* 處理中提示 */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex items-center gap-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 h-full w-1 bg-zinc-700" />
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">AI 正在轉譯中...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
