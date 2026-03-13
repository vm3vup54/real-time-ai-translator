# Real-time AI Translator (即時 AI 翻譯與雙向口譯)

這是一個基於 AI 技術開發的高效能即時翻譯與口譯系統，旨在提供接近零延遲、極簡且專業的使用體驗。

## ✨ 主要功能

- **即時字幕模式**：同步監聽麥克風語音，並即時產出多國語言翻譯字幕。
  - 支持 **固定字幕 (YouTube Style)** 與 **聊天堆疊 (Chat Style)** 顯示。
- **雙向口譯模式**：自動偵測雙方發言語言，實現無縫的雙向溝通。
  - 整合語音合成 (TTS) 技術，完成翻譯後自動播放語音。
- **高效能介面設計**：針對低延遲需求重構，移除不必要的毛玻璃效果與頻繁重新渲染，確保反應極速。
- **隱私優先**：API Key 僅儲存在本地瀏覽器緩存，不會傳送至任何伺服器。

## 🚀 快速開始

### 在線體驗
您可以直接訪問部署在 GitHub Pages 的版本：
[https://vm3vup54.github.io/real-time-ai-translator/](https://vm3vup54.github.io/real-time-ai-translator/)

### 本地執行

1.  **安裝依賴**：
    ```bash
    npm install
    ```

2.  **啟動開發伺服器**：
    ```bash
    npm run dev
    ```

3.  **配置 API Key**：
    開啟網頁後，點擊設定按鈕輸入您的 Gemini API Key 或 OpenAI API Key。

## 🛠️ 技術棧

- **Frontend**: React 19, Vite, Tailwind CSS 4
- **Animation**: Framer Motion
- **AI Integration**: Gemini 2.0 / OpenAI API
- **VAD**: Voice Activity Detection (客製化高效能實作)

---
*Created with ❤️ for seamless communication.*
