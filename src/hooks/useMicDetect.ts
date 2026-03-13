import { useState, useEffect, useCallback } from 'react';

export interface MicStatus {
    /** 是否有可用麥克風 */
    available: boolean;
    /** 偵測中 */
    checking: boolean;
    /** 錯誤訊息 */
    error: string | null;
    /** 重新偵測 */
    recheck: () => void;
}

export function useMicDetect(): MicStatus {
    const [available, setAvailable] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const check = useCallback(async () => {
        setChecking(true);
        setError(null);
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const mics = devices.filter(d => d.kind === 'audioinput');
            if (mics.length === 0) {
                setAvailable(false);
                setError('未偵測到麥克風裝置');
            } else {
                // 嘗試取得權限確認可用
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
                setAvailable(true);
            }
        } catch (e: any) {
            setAvailable(false);
            if (e.name === 'NotAllowedError') {
                setError('麥克風權限被拒絕，請在瀏覽器設定中允許');
            } else if (e.name === 'NotFoundError') {
                setError('未偵測到麥克風裝置');
            } else {
                setError(`麥克風錯誤: ${e.message}`);
            }
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        check();

        // 監聽裝置變更
        const handleChange = () => check();
        navigator.mediaDevices.addEventListener('devicechange', handleChange);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleChange);
        };
    }, [check]);

    return { available, checking, error, recheck: check };
}
