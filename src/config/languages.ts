export interface Language {
    code: string;
    label: string;
    voice: string;
    flag: string;
}

export const LANGUAGES: Language[] = [
    { code: 'zh-TW', label: '繁體中文', voice: 'Kore', flag: '🇹🇼' },
    { code: 'en-US', label: 'English', voice: 'Zephyr', flag: '🇺🇸' },
    { code: 'ja-JP', label: '日本語', voice: 'Puck', flag: '🇯🇵' },
    { code: 'ko-KR', label: '한국어', voice: 'Charon', flag: '🇰🇷' },
    { code: 'vi-VN', label: 'Tiếng Việt', voice: 'Aoede', flag: '🇻🇳' },
];

export const AUTO_DETECT: Language = {
    code: 'auto',
    label: '自動偵測 (Auto)',
    voice: '',
    flag: '🌐',
};

/** 取得含自動偵測選項的完整語言清單（用於來源語言選擇） */
export function getSourceLanguages(): Language[] {
    return [AUTO_DETECT, ...LANGUAGES];
}

/** 根據語言代碼找到語言物件 */
export function findLanguage(code: string): Language | undefined {
    if (code === 'auto') return AUTO_DETECT;
    return LANGUAGES.find((l) => l.code === code);
}
