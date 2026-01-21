import { useEffect, useRef, useState } from 'react'
import './App.css'
import Papa from 'papaparse'
import {
  parseHtmlTable,
  parseLatexTable,
  parseMarkdownTable,
  convertToMarkdown,
  convertToLatex,
  convertToJson,
  convertToSheets,
} from './utils'

function App() {
  const [status, setStatus] = useState('')
  const [activeFormat, setActiveFormat] = useState('')
  const toastTimerRef = useRef<number | null>(null)
  const logDev = (...args: unknown[]) => {
    const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV
    if (isDev) {
      console.log('[TableMorph]', ...args)
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const convertToFormat = async (format: string) => {
    try {
      setActiveFormat(format)
      // Read from clipboard
      const clipboardItems = await navigator.clipboard.read()
      let data = ''
      let isHtml = false

      for (const item of clipboardItems) {
        if (item.types.includes('text/html')) {
          const html = await item.getType('text/html')
          data = await html.text()
          isHtml = true
          break
        } else if (item.types.includes('text/plain')) {
          const text = await item.getType('text/plain')
          data = await text.text()
          break
        }
      }

      if (!data) {
        setStatus('No data in clipboard')
        return
      }

      logDev('Clipboard raw data:', data)

      let tableData: string[][] = []
      let detectedFormat: 'html' | 'markdown' | 'latex' | 'tsv/csv' = 'tsv/csv'

      if (isHtml) {
        detectedFormat = 'html'
        tableData = parseHtmlTable(data)

        const looksEmpty = tableData.length === 0 || tableData.every(row => row.length <= 1)
        if (looksEmpty) {
          const doc = new DOMParser().parseFromString(data, 'text/html')
          const paragraphLines = Array.from(doc.body.querySelectorAll('p')).map(
            paragraph => paragraph.textContent?.trim() ?? ''
          )
          const htmlText = paragraphLines.filter(Boolean).join('\n') || (doc.body.textContent ?? '')
          const latexTable = parseLatexTable(htmlText)
          if (latexTable) {
            detectedFormat = 'latex'
            tableData = latexTable
          } else {
            const markdownTable = parseMarkdownTable(htmlText)
            if (markdownTable) {
              detectedFormat = 'markdown'
              tableData = markdownTable
            }
          }
        }
      } else {
        const latexTable = parseLatexTable(data)
        if (latexTable) {
          detectedFormat = 'latex'
          tableData = latexTable
        } else {
          const markdownTable = parseMarkdownTable(data)
          if (markdownTable) {
            detectedFormat = 'markdown'
            tableData = markdownTable
          } else {
            // Assume TSV or CSV
            detectedFormat = 'tsv/csv'
            const parsed = Papa.parse(data, { skipEmptyLines: true })
            tableData = parsed.data as string[][]
          }
        }
      }

      logDev('Detected input format:', detectedFormat)

      let result = ''

      if (format === 'markdown') {
        result = convertToMarkdown(tableData)
      } else if (format === 'latex') {
        result = convertToLatex(tableData)
      } else if (format === 'json') {
        result = convertToJson(tableData)
      } else if (format === 'sheets') {
        result = convertToSheets(tableData)
      }

      logDev('Converted output:', result)

      // Write back to clipboard
      await navigator.clipboard.writeText(result)
      logDev('Clipboard write: success')
      setStatus('Copied to Clipboard!')
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
      toastTimerRef.current = window.setTimeout(() => {
        setStatus('')
        setActiveFormat('')
      }, 1000)
    } catch (error) {
      setStatus('Error: ' + (error as Error).message)
    }
  }

  const getCardClass = (format: string, baseClass: string) =>
    `card ${baseClass}${activeFormat === format ? ' card--active' : ''}`

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__brand-icon material-symbols-outlined">grid_view</span>
          <h1 className="app__title">TableMorph</h1>
        </div>
        <button className="app__icon-button" type="button" aria-label="Settings">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>
      <main className="app__content">
        <div className="app__grid">
          <button
            className={getCardClass('markdown', 'card--markdown')}
            onClick={() => convertToFormat('markdown')}
          >
            <span className="card__icon card__icon--markdown material-symbols-outlined">format_quote</span>
            <span className="card__label">Markdown</span>
          </button>
          <button
            className={getCardClass('latex', 'card--latex')}
            onClick={() => convertToFormat('latex')}
          >
            <span className="card__icon card__icon--latex material-symbols-outlined">functions</span>
            <span className="card__label">LaTeX</span>
          </button>
          <button
            className={getCardClass('sheets', 'card--sheets')}
            onClick={() => convertToFormat('sheets')}
          >
            <span className="card__icon card__icon--sheets material-symbols-outlined">table_chart</span>
            <span className="card__label">Sheets</span>
          </button>
          <button
            className={getCardClass('json', 'card--json')}
            onClick={() => convertToFormat('json')}
          >
            <span className="card__icon card__icon--json material-symbols-outlined">data_object</span>
            <span className="card__label">JSON</span>
          </button>
        </div>
        {status ? (
          <div className="toast" role="status">
            <span className="material-symbols-outlined toast__icon">check</span>
            <span className="toast__text">{status}</span>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App