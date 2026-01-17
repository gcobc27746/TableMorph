# TableMorph
一個 Chrome 瀏覽器擴充功能，讓使用者透過點擊按鈕，自動從剪貼簿讀取表格數據（Excel, Google Sheets, Markdown, LaTeX 等），並利用成熟第三方套件將其轉換為目標格式，最後自動覆蓋回剪貼簿。

## 安裝與使用
1. 安裝依賴：`npm install`
2. 開發模式：`npm run dev`
3. 建置：`npm run build`
4. 在 Chrome 中載入 `dist` 資料夾作為擴充功能。

## 功能
- 從剪貼簿讀取 HTML 表格或純文字表格。
- 轉換為 Markdown、LaTeX、JSON 或 TSV 格式。
- 自動寫回剪貼簿。

## 測試
- 單元測試：`npm test`
- E2E 測試：`npx playwright test`
