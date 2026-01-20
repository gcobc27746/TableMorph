TableMorph 系統規格書 (V3 完整版)
以下內容整合了先前的格式需求、套件選用，以及最新的開發與測試流程。
1. 專案概述 (Project Overview)
• 專案名稱：TableMorph
• 目標：開發一個 Chrome 瀏覽器擴充功能，讓使用者透過點擊按鈕，自動從剪貼簿讀取表格數據（Excel, Google Sheets, Markdown, LaTeX 等），並利用成熟第三方套件將其轉換為目標格式，最後自動覆蓋回剪貼簿。
• 核心價值：無需打開轉換網站，直接在瀏覽器側邊完成「讀取 -> 轉換 -> 複製」的自動化流程。
2. 功能需求 (Functional Requirements)
• 智慧讀取 (Smart Input)：
• 偵測剪貼簿內容。若為 HTML 格式（從網頁或 Google Sheets 複製），優先解析 HTML Table。
• 若為純文字，則視為 TSV 或 CSV。
• 多格式輸出支援：
• Markdown：生成標準 GFM 表格。
• LaTeX：生成符合學術標準的 tabular 代碼。
• Excel/Google Sheets (TSV)：還原為 Tab 分隔格式。
• JSON：轉為物件陣列。
• 自動化流程：一鍵觸發「讀取 -> 套件轉換 -> 寫入」全自動流程。
3. 技術規格與套件選用 (Technical Stack & Libraries)
• 開發環境：Vite + TypeScript + React (基於 Manifest V3)。
• 核心解析與轉換套件：
• PapaParse：處理 TSV/CSV 數據解析。
• Turndown：將 HTML 表格轉為 Markdown。
• markdown-table：生成格式完美的 Markdown 字串。
• 內建 LaTeX 轉換器：生成 LaTeX 表格代碼。
4. 系統架構與資料流 (System Architecture)
1. 讀取 (Read)：透過 navigator.clipboard.read() 獲取數據。
2. 預處理 (Normalize)：由 PapaParse 或 Turndown 將輸入轉為二維陣列 (2D Array)。
3. 轉換 (Transform)：按用戶需求套用對應 Formatter。
4. 寫入 (Write)：呼叫 navigator.clipboard.writeText() 覆蓋剪貼簿。
5. 詳細介面設計 (UI Design)
• Popup 佈局：包含四個主功能按鈕（Markdown, LaTeX, Sheets, JSON）。
• 狀態回饋：成功時按鈕變色並顯示「Copied!」。
6. 權限與安全 (Permissions & Security)
• 權限：clipboardRead, clipboardWrite。
• 隱私：所有數據皆在本地端處理，不涉及伺服器上傳。
7. 開發流程 (Development Workflow)
• 初始化：使用 Vite 建立 TypeScript 專案並配置 @crxjs/vite-plugin。
• 開發階段：執行 npm run dev 啟動 HMR。
• 調試：使用 Chrome DevTools 對 Popup 與 Service Worker 進行檢查。
8. 測試策略 (Testing Strategy)
• 手動測試：在 chrome://extensions 載入 dist 資料夾，實測不同表格內容的轉換效果。
• 自動化測試：
• 使用 Vitest 測試核心轉換函數。
• 使用 Playwright 模擬用戶在瀏覽器點擊按鈕的 E2E 流程。