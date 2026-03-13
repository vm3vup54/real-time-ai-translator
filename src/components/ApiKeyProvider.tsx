import { createContext, useContext, useState, useCallback, type ReactNode, type FormEvent } from 'react';
import { KeyRound, ArrowRight, Trash2, ExternalLink } from 'lucide-react';

export type AiProvider = 'gemini' | 'openai';

interface ApiKeyContextType {
    provider: AiProvider;
    setProvider: (p: AiProvider) => void;
    geminiKey: string;
    openaiKey: string;
    setKey: (provider: AiProvider, key: string) => void;
    clearKeys: () => void;
    isKeySet: boolean;
    activeKey: string;
}

const ApiKeyContext = createContext<ApiKeyContextType | null>(null);

export function useApiKey() {
    const ctx = useContext(ApiKeyContext);
    if (!ctx) throw new Error('useApiKey must be used within ApiKeyProvider');
    return ctx;
}

export function ApiKeyProvider({ children }: { children: ReactNode }) {
    const [provider, setProviderState] = useState<AiProvider>(() => {
        return (localStorage.getItem('ai_provider') as AiProvider) || 'gemini';
    });
    
    // Check old gemini_api_key for backward compatibility
    const [geminiKey, setGeminiKey] = useState(() => {
        return localStorage.getItem('gemini_api_key') || '';
    });
    const [openaiKey, setOpenaiKey] = useState(() => {
        return localStorage.getItem('openai_api_key') || '';
    });

    const setProvider = useCallback((p: AiProvider) => {
        setProviderState(p);
        localStorage.setItem('ai_provider', p);
    }, []);

    const setKey = useCallback((p: AiProvider, key: string) => {
        const trimmed = key.trim();
        setProviderState(p);
        localStorage.setItem('ai_provider', p);
        if (p === 'gemini') {
            setGeminiKey(trimmed);
            if (trimmed) localStorage.setItem('gemini_api_key', trimmed);
        } else {
            setOpenaiKey(trimmed);
            if (trimmed) localStorage.setItem('openai_api_key', trimmed);
        }
    }, []);

    const clearKeys = useCallback(() => {
        setGeminiKey('');
        setOpenaiKey('');
        localStorage.removeItem('gemini_api_key');
        localStorage.removeItem('openai_api_key');
    }, []);

    const activeKey = provider === 'gemini' ? geminiKey : openaiKey;
    const isKeySet = !!activeKey;

    return (
        <ApiKeyContext.Provider value={{ provider, setProvider, geminiKey, openaiKey, setKey, clearKeys, isKeySet, activeKey }}>
            {activeKey ? children : <ApiKeyScreen onSubmit={setKey} />}
        </ApiKeyContext.Provider>
    );
}

/** Header 用的 API Key 與供應商狀態指示器 */
export function ApiKeyIndicator() {
    const { clearKeys, provider, setProvider } = useApiKey();
    return (
        <div className="flex items-center gap-2">
            <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AiProvider)}
                className="bg-zinc-800/80 border border-zinc-700/50 text-xs text-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
            </select>
            <button
                onClick={clearKeys}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/80 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-700/50 transition-all group"
                title="清除所有 API Key"
            >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400 group-hover:text-red-400 transition-colors" />
                <span className="hidden sm:inline">已設定</span>
                <Trash2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
        </div>
    );
}

function ApiKeyScreen({ onSubmit }: { onSubmit: (provider: AiProvider, key: string) => void }) {
    const { provider: initialProvider } = useApiKey();
    const [provider, setProvider] = useState<AiProvider>(initialProvider);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) {
            setError('請輸入 API Key');
            return;
        }
        if (provider === 'gemini' && !trimmed.startsWith('AIza')) {
            setError('Gemini API Key 格式不正確（應以 AIza 開頭）');
            return;
        }
        if (provider === 'openai' && !trimmed.startsWith('sk-')) {
            setError('OpenAI API Key 格式不正確（應以 sk- 開頭）');
            return;
        }
        onSubmit(provider, trimmed);
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/20">
                        <KeyRound className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">設定 API Key</h1>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        本應用需要 AI API Key 才能運作。<br />
                        Key 僅儲存在您的瀏覽器本機，不會上傳至任何伺服器。
                    </p>
                </div>

                <div className="flex gap-2 mb-6 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl">
                    <button
                        onClick={() => { setProvider('gemini'); setInput(''); setError(''); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${provider === 'gemini' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-300'}`}
                    >
                        Gemini AI
                    </button>
                    <button
                        onClick={() => { setProvider('openai'); setInput(''); setError(''); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${provider === 'openai' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-300'}`}
                    >
                        OpenAI
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setError(''); }}
                            placeholder={provider === 'gemini' ? 'AIza...' : 'sk-...'}
                            autoFocus
                            className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm font-mono"
                        />
                        {error && (
                            <p className="mt-2 text-red-400 text-xs">{error}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
                    >
                        開始使用 <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                <div className="mt-6 text-center">
                    {provider === 'gemini' ? (
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400 transition-colors">
                            還沒有 API Key？前往 Google AI Studio 取得
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    ) : (
                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400 transition-colors">
                            還沒有 API Key？前往 OpenAI Platform 取得
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

