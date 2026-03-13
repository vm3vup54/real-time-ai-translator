/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { SubtitleMode } from './components/SubtitleMode';
import { InterpMode } from './components/InterpMode';
import { ApiKeyProvider, ApiKeyIndicator } from './components/ApiKeyProvider';
import { AudioSettingsProvider } from './hooks/useAudioSettings';
import { Mic, MessageSquare, Subtitles } from 'lucide-react';
import { motion } from 'motion/react';

function AppContent() {
  const [mode, setMode] = useState<'home' | 'subtitle' | 'interp'>('home');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      <header className="border-b border-zinc-800/50 bg-zinc-900/60 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setMode('home')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-zinc-100 leading-tight tracking-tight">AI 即時翻譯</h1>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Powered by Gemini</p>
            </div>
          </div>
          <ApiKeyIndicator />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {mode === 'home' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto mt-12"
          >
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4"
              >
                選擇模式
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-zinc-400 text-lg"
              >
                體驗由 Gemini 驅動的即時串流翻譯與雙向口譯功能。
              </motion.p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode('subtitle')}
                className="group relative p-8 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 transition-all hover:shadow-2xl hover:shadow-indigo-500/10 text-left overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Subtitles className="w-10 h-10 text-indigo-400 mb-6" />
                <h3 className="text-xl font-semibold text-white mb-2">即時字幕模式</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                  持續聆聽並即時將語音同步翻譯成多國語言字幕。非常適合演講與簡報場合。
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">串流模式</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">VAD 斷句</span>
                </div>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode('interp')}
                className="group relative p-8 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 transition-all hover:shadow-2xl hover:shadow-emerald-500/10 text-left overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <MessageSquare className="w-10 h-10 text-emerald-400 mb-6" />
                <h3 className="text-xl font-semibold text-white mb-2">雙向口譯模式</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                  自動偵測雙方語言並進行雙向翻譯，並以自然語音 (TTS) 播放翻譯結果。適合會議問答與交流。
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">語音播放</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">可匯出紀錄</span>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}

        {mode === 'subtitle' && <SubtitleMode onBack={() => setMode('home')} />}
        {mode === 'interp' && <InterpMode onBack={() => setMode('home')} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ApiKeyProvider>
      <AudioSettingsProvider>
        <AppContent />
      </AudioSettingsProvider>
    </ApiKeyProvider>
  );
}
