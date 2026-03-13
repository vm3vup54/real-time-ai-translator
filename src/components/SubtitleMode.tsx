import { useState, useRef, useEffect } from 'react';
import { useVAD, VADOptions } from '../hooks/useVAD';
import { useMicDetect } from '../hooks/useMicDetect';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { processAudioForSubtitlesUnified } from '../services/ai';
import { useApiKey } from './ApiKeyProvider';
import { LANGUAGES, AUTO_DETECT, getSourceLanguages, findLanguage } from '../config/languages';
import {
  ArrowLeft, Mic, MicOff, Subtitles, Loader2, Zap, Radio,
  Monitor, MessageSquareText, RefreshCw, Settings2, MicVocal, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type DisplayMode = 'youtube' | 'chat';

export function SubtitleMode({ onBack }: { onBack: () => void }) {
  const { provider, activeKey } = useApiKey();
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLangs, setTargetLangs] = useState<string[]>(['en-US', 'ja-JP']);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('youtube');
  const [showVadSettings, setShowVadSettings] = useState(false);

  const bar1Ref = useRef<HTMLDivElement>(null);
  const bar2Ref = useRef<HTMLDivElement>(null);
  const bar3Ref = useRef<HTMLDivElement>(null);

  // ===== VAD 與全域音量參數 =====
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

  // ===== 麥克風偵測 =====
  const mic = useMicDetect();

  // ===== VAD 模式 state =====
  const [vadCards, setVadCards] = useState<Array<{ id: string, sourceText: string, detectedLang: string, translations: Record<string, string> }>>([]);
  const [processingCount, setProcessingCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ===== VAD 模式 =====
  const handleSpeechEnd = async (audioBlob: Blob) => {
    if (targetLangs.length === 0) return;

    setProcessingCount(p => p + 1);
    try {
      const result = await processAudioForSubtitlesUnified(provider, activeKey, audioBlob, targetLangs, sourceLang);

      if (result && result.source_text && result.translations) {
        setVadCards(prev => [...prev, {
          id: Date.now().toString(),
          sourceText: result.source_text,
          detectedLang: result.detected_language,
          translations: result.translations
        }]);
      }
    } catch (e) {
      console.error("Audio processing error:", e);
    } finally {
      setProcessingCount(p => Math.max(0, p - 1));
    }
  };

  const vad = useVAD(handleSpeechEnd, vadOptions);

  // 自動捲動到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [vadCards, processingCount]);

  // Cleanup
  useEffect(() => {
    return () => {
      vad.stop();
    };
  }, []);

  const isListening = vad.isListening;

  const toggleListening = () => {
    if (vad.isListening) vad.stop();
    else vad.start();
  };

  const toggleTargetLang = (code: string) => {
    if (code === 'auto') return;
    setTargetLangs(prev =>
      prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]
    );
  };



  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* 頂部控制列 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-white">即時字幕模式</h2>
            <p className="text-xs text-zinc-500">同步聆聽與多國語言翻譯</p>
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
            onClick={() => setShowVadSettings(v => !v)}
            className={`p-2 rounded-lg transition-colors ${showVadSettings
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            title="音訊參數設定"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 麥克風狀態提示 */}
      <AnimatePresence>
        {mic.error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{mic.error}</span>
              <button
                onClick={mic.recheck}
                className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-xs font-medium transition-colors"
              >
                重新偵測
              </button>
            </div>
          </motion.div>
        )}
        {mic.checking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              偵測麥克風中...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VAD 參數設定面板 */}
      <AnimatePresence>
        {showVadSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-300">全域音訊與過濾設定</span>
              </div>

              {/* 靜音閾值 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">靜音閾值 (越高越不容易被環境噪音觸發)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.005}
                      max={0.15}
                      step={0.005}
                      value={silenceThreshold}
                      onChange={(e) => setSilenceThreshold(parseFloat(e.target.value))}
                      disabled={isListening}
                      className="w-32 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                    />
                    <input
                      type="number"
                      min={0.005}
                      max={0.15}
                      step={0.005}
                      value={silenceThreshold}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0.005 && v <= 0.15) setSilenceThreshold(v);
                      }}
                      disabled={isListening}
                      className="w-20 bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded px-2 py-1 text-center focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* 靜音時長 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">斷句靜音時長 (ms，越短越快斷句)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={300}
                      max={3000}
                      step={100}
                      value={silenceDurationMs}
                      onChange={(e) => setSilenceDurationMs(parseInt(e.target.value))}
                      disabled={isListening}
                      className="w-32 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                    />
                    <input
                      type="number"
                      min={300}
                      max={3000}
                      step={100}
                      value={silenceDurationMs}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if (!isNaN(v) && v >= 300 && v <= 3000) setSilenceDurationMs(v);
                      }}
                      disabled={isListening}
                      className="w-20 bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded px-2 py-1 text-center focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                    <span className="text-[10px] text-zinc-600">ms</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 語言選擇與開始按鈕 */}
      <div className="flex items-center gap-4 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 uppercase whitespace-nowrap">講者語言</span>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            disabled={isListening}
            className="bg-zinc-950 border border-zinc-800 text-sm rounded-lg px-2 py-1 text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          >
            {getSourceLanguages().map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
        </div>

        <div className="w-px h-6 bg-zinc-800 hidden sm:block" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-500 uppercase whitespace-nowrap">翻譯目標</span>
          {LANGUAGES.filter(l => l.code !== sourceLang).map(l => (
            <button
              key={l.code}
              onClick={() => toggleTargetLang(l.code)}
              disabled={isListening}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${targetLangs.includes(l.code)
                ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                : 'bg-zinc-950 text-zinc-500 border border-transparent hover:text-zinc-400'
                }`}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-zinc-800 hidden sm:block" />

        {/* 麥克風指示器 */}
        <div className="flex items-center gap-1.5" title={mic.available ? '麥克風就緒' : mic.error || '偵測中'}>
          <MicVocal className={`w-4 h-4 ${mic.available ? 'text-emerald-400' : mic.checking ? 'text-zinc-500 animate-pulse' : 'text-red-400'}`} />
          <span className={`text-[10px] ${mic.available ? 'text-emerald-400' : 'text-red-400'}`}>
            {mic.available ? 'MIC OK' : mic.checking ? '...' : 'NO MIC'}
          </span>
        </div>

        <button
          onClick={toggleListening}
          disabled={!mic.available && !isListening}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${isListening
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
            : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'
            }`}
        >
          {isListening ? <><MicOff className="w-4 h-4" /> 停止</> : <><Mic className="w-4 h-4" /> 開始</>}
        </button>
      </div>


      {/* 主要內容區域 */}
      <div
        ref={scrollRef}
        className="flex-1 bg-zinc-950 rounded-2xl overflow-y-auto relative"
      >
        {displayMode === 'youtube' ? (
          <YouTubeDisplay
            vadCards={vadCards}
            processingCount={processingCount}
            isListening={isListening}
          />
        ) : (
          <ChatDisplay
            vadCards={vadCards}
            processingCount={processingCount}
            isListening={isListening}
          />
        )}

        {/* 聆聽中極簡聲波指示器 */}
        {isListening && processingCount === 0 && (
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pb-6 pt-12 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none">
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-6 py-2.5 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-4">
              <div className="flex items-center gap-1 h-5">
                <div ref={bar1Ref} className="w-1 bg-emerald-500 rounded-full" style={{ height: '20%', transition: 'height 50ms linear' }} />
                <div ref={bar2Ref} className="w-1 bg-emerald-500 rounded-full" style={{ height: '20%', transition: 'height 50ms linear' }} />
                <div ref={bar3Ref} className="w-1 bg-emerald-500 rounded-full" style={{ height: '20%', transition: 'height 50ms linear' }} />
              </div>
              <span className="font-semibold text-xs tracking-wide">聆聽中</span>
            </div>
          </div>
        )}

        {/* 空白狀態 */}
        {!isListening && vadCards.length === 0 && processingCount === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-8">
            <Subtitles className="w-16 h-16 mb-4 opacity-20" />
            <p className="mb-2">點擊「開始」以啟動即時翻譯</p>
            <p className="text-xs text-zinc-600">
              VAD 模式：靜音後自動斷句並輸出翻譯
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ======= YouTube 固定底部字幕 =======

interface DisplayProps {
  vadCards: Array<{ id: string; sourceText: string; detectedLang: string; translations: Record<string, string> }>;
  processingCount: number;
  isListening: boolean;
}

function YouTubeDisplay({ vadCards, processingCount, isListening }: DisplayProps) {
  // 取得最新要顯示的文字
  let sourceText = '';
  let translationText = '';

  // VAD 模式：顯示最後一個卡片
  if (vadCards.length > 0) {
    const last = vadCards[vadCards.length - 1];
    sourceText = last.sourceText;
    translationText = Object.values(last.translations).join(' | ');
  }

  const hasContent = sourceText || translationText || processingCount > 0;

  return (
    <div className="h-full flex flex-col justify-end p-6">
      {/* 歷史段落（半透明小字） */}
      <div className="flex-1 overflow-y-auto mb-4">
        {vadCards.slice(0, -1).map(card => (
          <div key={card.id} className="mb-3 opacity-40">
            <p className="text-base text-zinc-400">{card.sourceText}</p>
            <p className="text-xl text-zinc-300">{Object.values(card.translations).join(' | ')}</p>
          </div>
        ))}
      </div>

      {/* 底部固定字幕 */}
      <AnimatePresence mode="wait">
        {hasContent && (
          <motion.div
            key="subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="bg-zinc-900 rounded-2xl px-8 py-6 border border-zinc-800 shadow-2xl"
          >
            {processingCount > 0 && !sourceText && (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="text-zinc-400">辨識與翻譯中...</span>
              </div>
            )}
            {sourceText && (
              <p className="text-zinc-400 text-xl md:text-2xl mb-2">{sourceText}</p>
            )}
            {translationText && (
              <p className="text-white text-3xl md:text-5xl lg:text-6xl font-semibold leading-relaxed">
                {translationText}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ======= 聊天堆疊模式 (極簡高效版) =======

function ChatDisplay({ vadCards, processingCount }: DisplayProps) {
  // DOM 數量控制：為了效能，永遠只保留最後 6 句話在 DOM 樹上
  const visibleCards = vadCards.slice(-6);

  return (
    <div className="p-4 md:p-8 space-y-4">
      {/* VAD 模式的卡片 */}
      {visibleCards.map(card => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="bg-zinc-950 border border-zinc-900 rounded-xl p-5"
        >
          {/* 原文極致淡化 */}
          <div className="mb-2">
            <span className="inline-block text-zinc-600 text-[10px] font-bold uppercase tracking-wider mb-1 mr-2 opacity-50">
              {findLanguage(card.detectedLang)?.label || card.detectedLang}
            </span>
            <span className="text-sm text-zinc-500 break-words">{card.sourceText}</span>
          </div>

          {/* 翻譯高對比呈現 */}
          <div className="space-y-3 pt-2">
            {Object.entries(card.translations).map(([lang, text]) => (
              <div key={lang}>
                <span className="inline-block text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                  {findLanguage(lang)?.label || lang}
                </span>
                <p className="text-2xl md:text-3xl font-semibold text-zinc-100 break-words whitespace-pre-wrap leading-tight tracking-tight shadow-sm">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      ))}


      {/* 處理中提示（無背景模糊，純光影動畫） */}
      <AnimatePresence>
        {processingCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex items-center gap-3 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 h-full w-1 bg-zinc-700" />
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
            <span className="text-sm font-semibold text-zinc-300">處理翻譯中...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
