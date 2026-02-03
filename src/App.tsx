import { useEffect, useRef, useState } from 'react'
import './App.css'
import Papa from 'papaparse'
import logoUrl from './images/TableMorph.png'
import {
  parseHtmlTable,
  parseJsonTable,
  parseLatexTable,
  parseMarkdownTable,
  convertToMarkdown,
  convertToLatex,
  convertToJson,
  convertToSheets,
  expandTableData,
  type TableData,
} from './utils'

function App() {
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
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
      
      // Save original clipboard content for potential restoration
      let originalHtmlData: string | null = null
      let originalPlainData: string | null = null

      for (const item of clipboardItems) {
        if (item.types.includes('text/html') && !isHtml) {
          const html = await item.getType('text/html')
          data = await html.text()
          originalHtmlData = data
          isHtml = true
        }
        if (item.types.includes('text/plain') && !originalPlainData) {
          const text = await item.getType('text/plain')
          const plainText = await text.text()
          originalPlainData = plainText
          if (!data) {
            data = plainText
          }
        }
      }

      if (!data) {
        setStatus('No data in clipboard')
        return
      }

      logDev('Clipboard raw data:', data)

      let tableData: TableData | string[][] = []
      let detectedFormat: 'html' | 'markdown' | 'latex' | 'json' | 'tsv/csv' = 'tsv/csv'

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
            // parseLatexTable 現在返回 TableData 或 string[][]
            if (latexTable.length > 0 && typeof latexTable[0][0] === 'string') {
              tableData = expandTableData(latexTable as string[][])
            } else {
              tableData = latexTable as TableData
            }
          } else {
            const markdownTable = parseMarkdownTable(htmlText)
            if (markdownTable) {
              detectedFormat = 'markdown'
              tableData = expandTableData(markdownTable)
            }
          }
        }
      } else {
        const jsonTable = parseJsonTable(data)
        if (jsonTable) {
          detectedFormat = 'json'
          // parseJsonTable 現在返回 TableData 或 string[][]
          if (jsonTable.length > 0 && typeof jsonTable[0][0] === 'string') {
            tableData = expandTableData(jsonTable as string[][])
          } else {
            tableData = jsonTable as TableData
          }
        } else {
          const latexTable = parseLatexTable(data)
          if (latexTable) {
            detectedFormat = 'latex'
            // parseLatexTable 現在返回 TableData 或 string[][]
            if (latexTable.length > 0 && typeof latexTable[0][0] === 'string') {
              tableData = expandTableData(latexTable as string[][])
            } else {
              tableData = latexTable as TableData
            }
          } else {
            const markdownTable = parseMarkdownTable(data)
            if (markdownTable) {
              detectedFormat = 'markdown'
              tableData = expandTableData(markdownTable)
            } else {
              // Assume TSV or CSV - but validate it's actually a table
              // First check if data looks like code (JSON, etc.) - reject if so
              const looksLikeCode = 
                (data.includes('{') && data.includes('}')) ||
                (data.includes('[') && data.includes(']')) ||
                (data.includes('"') && data.includes(':')) ||
                data.trim().startsWith('{') ||
                data.trim().startsWith('[')
              
              if (looksLikeCode) {
                // Looks like code, not a table - reject
                detectedFormat = 'tsv/csv'
                tableData = []
              } else {
                const parsed = Papa.parse(data, { skipEmptyLines: true })
                const parsedData = parsed.data as string[][]
                
                // Validate TSV/CSV: must be a real table
                // A real table should have at least 2 columns consistently
                const maxColumns = parsedData.length > 0 
                  ? Math.max(...parsedData.map(row => row.length), 0)
                  : 0
                const minColumns = parsedData.length > 0
                  ? Math.min(...parsedData.map(row => row.length), Infinity)
                  : 0
                
                // Check if it's a real table: need at least 2 columns consistently
                // Single column data or inconsistent structure is not a table
                const hasConsistentColumns = maxColumns >= 2 && minColumns >= 2
                
                if (hasConsistentColumns && parsedData.length > 0) {
                  detectedFormat = 'tsv/csv'
                  tableData = expandTableData(parsedData)
                } else {
                  // Not a valid table format
                  detectedFormat = 'tsv/csv'
                  tableData = []
                }
              }
            }
          }
        }
      }

      logDev('Detected input format:', detectedFormat)

      // Validate detected format and table data before conversion
      const isValidTableData = (() => {
        if (tableData.length === 0) return false
        
        // Check if it's TableData (CellInfo[][]) or string[][]
        const firstRow = tableData[0]
        if (firstRow.length === 0) return false
        
        const firstCell = firstRow[0]
        if (typeof firstCell === 'string') {
          // It's string[][]
          return (tableData as string[][]).some(row => 
            row.length > 0 && row.some(cell => String(cell).trim().length > 0)
          )
        } else {
          // It's TableData
          return (tableData as TableData).some(row => 
            row.length > 0 && row.some(cell => cell.value.trim().length > 0)
          )
        }
      })()

      if (!isValidTableData) {
        // Restore original clipboard content
        const restoreData: Record<string, Blob> = {}
        if (originalHtmlData) {
          restoreData['text/html'] = new Blob([originalHtmlData], { type: 'text/html' })
        }
        if (originalPlainData) {
          restoreData['text/plain'] = new Blob([originalPlainData], { type: 'text/plain' })
        }

        if (Object.keys(restoreData).length > 0) {
          try {
            await navigator.clipboard.write([new ClipboardItem(restoreData)])
            logDev('Clipboard restored to original content')
          } catch (restoreError) {
            logDev('Failed to restore clipboard:', restoreError)
          }
        }

        setStatus('Conversion failed')
        setIsError(true)
        if (toastTimerRef.current !== null) {
          window.clearTimeout(toastTimerRef.current)
        }
        toastTimerRef.current = window.setTimeout(() => {
          setStatus('')
          setIsError(false)
          setActiveFormat('')
        }, 2000)
        return
      }

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

      // Check if result is empty
      if (!result || result.trim().length === 0) {
        // Restore original clipboard content
        const restoreData: Record<string, Blob> = {}
        if (originalHtmlData) {
          restoreData['text/html'] = new Blob([originalHtmlData], { type: 'text/html' })
        }
        if (originalPlainData) {
          restoreData['text/plain'] = new Blob([originalPlainData], { type: 'text/plain' })
        }
        
        if (Object.keys(restoreData).length > 0) {
          try {
            await navigator.clipboard.write([new ClipboardItem(restoreData)])
            logDev('Clipboard restored to original content')
          } catch (restoreError) {
            logDev('Failed to restore clipboard:', restoreError)
          }
        }
        
        setStatus('Conversion failed')
        setIsError(true)
        if (toastTimerRef.current !== null) {
          window.clearTimeout(toastTimerRef.current)
        }
        toastTimerRef.current = window.setTimeout(() => {
          setStatus('')
          setIsError(false)
          setActiveFormat('')
        }, 2000)
        return
      }

      // Write back to clipboard
      await navigator.clipboard.writeText(result)
      logDev('Clipboard write: success')
      setStatus('Copied to Clipboard!')
      setIsError(false)
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
      toastTimerRef.current = window.setTimeout(() => {
        setStatus('')
        setIsError(false)
        setActiveFormat('')
      }, 1000)
    } catch (error) {
      setStatus('轉換失敗')
      setIsError(true)
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
      toastTimerRef.current = window.setTimeout(() => {
        setStatus('')
        setIsError(false)
        setActiveFormat('')
      }, 2000)
    }
  }

  const getCardClass = (format: string, baseClass: string) =>
    `card ${baseClass}${activeFormat === format ? ' card--active' : ''}`

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <img className="app__brand-logo" src={logoUrl} alt="TableMorph logo" />
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
          <div className={`toast ${isError ? 'toast--error' : ''}`} role="status">
            <span className="material-symbols-outlined toast__icon">
              {isError ? 'close' : 'check'}
            </span>
            <span className="toast__text">{status}</span>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App