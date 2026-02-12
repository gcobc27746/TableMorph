import { useMemo, useState } from 'react'
import './editor.css'
import {
  convertToJson,
  convertToLatex,
  convertToMarkdown,
  convertToSheets,
  type CellInfo,
  type TableData,
} from './utils'

type OutputFormat = 'markdown' | 'latex' | 'json' | 'sheets'

type CellPosition = { row: number; col: number }

const createEmptyTable = (rows: number, cols: number): TableData =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ value: '' })))

const createDefaultWidths = (cols: number) => Array.from({ length: cols }, () => 140)

const isSelectionValid = (selection: CellPosition[]) => selection.length >= 2

function EditorApp() {
  const [tableData, setTableData] = useState<TableData>(() => createEmptyTable(5, 5))
  const [colWidths, setColWidths] = useState<number[]>(() => createDefaultWidths(5))
  const [selected, setSelected] = useState<CellPosition[]>([])
  const [status, setStatus] = useState('')

  const rows = tableData.length
  const cols = tableData[0]?.length ?? 0

  const selectedSet = useMemo(
    () => new Set(selected.map(item => `${item.row}-${item.col}`)),
    [selected]
  )

  const showStatus = (message: string) => {
    setStatus(message)
    window.setTimeout(() => setStatus(''), 1200)
  }

  const setCellValue = (row: number, col: number, value: string) => {
    setTableData(prev => {
      const next = prev.map(r => r.map(cell => ({ ...cell })))
      next[row][col].value = value
      return next
    })
  }

  const addRow = () => {
    setTableData(prev => {
      const next = prev.map(r => r.map(cell => ({ ...cell })))
      next.push(Array.from({ length: cols }, () => ({ value: '' })))
      return next
    })
  }

  const addColumn = () => {
    setTableData(prev => {
      const next = prev.map(r => [...r.map(cell => ({ ...cell })), { value: '' }])
      return next
    })
    setColWidths(prev => [...prev, 140])
  }

  const normalizeSelectionToRect = (selection: CellPosition[]) => {
    const rowsOnly = selection.map(item => item.row)
    const colsOnly = selection.map(item => item.col)
    const minRow = Math.min(...rowsOnly)
    const maxRow = Math.max(...rowsOnly)
    const minCol = Math.min(...colsOnly)
    const maxCol = Math.max(...colsOnly)
    return { minRow, maxRow, minCol, maxCol }
  }

  const mergeSelected = () => {
    if (!isSelectionValid(selected)) {
      showStatus('請至少選取兩個儲存格')
      return
    }

    const rect = normalizeSelectionToRect(selected)
    const expectedCount = (rect.maxRow - rect.minRow + 1) * (rect.maxCol - rect.minCol + 1)
    if (selected.length !== expectedCount) {
      showStatus('目前只支援矩形範圍合併')
      return
    }

    setTableData(prev => {
      const next = prev.map(r => r.map(cell => ({ ...cell })))

      for (let r = rect.minRow; r <= rect.maxRow; r++) {
        for (let c = rect.minCol; c <= rect.maxCol; c++) {
          const cell = next[r][c]
          if (cell.isSpanned || (cell.colspan && cell.colspan > 1) || (cell.rowspan && cell.rowspan > 1)) {
            showStatus('範圍包含既有合併儲存格，無法再次合併')
            return prev
          }
        }
      }

      const master = next[rect.minRow][rect.minCol]
      master.colspan = rect.maxCol - rect.minCol + 1
      master.rowspan = rect.maxRow - rect.minRow + 1

      for (let r = rect.minRow; r <= rect.maxRow; r++) {
        for (let c = rect.minCol; c <= rect.maxCol; c++) {
          if (r === rect.minRow && c === rect.minCol) continue
          next[r][c] = { value: '', isSpanned: true }
        }
      }

      showStatus('已完成合併')
      setSelected([{ row: rect.minRow, col: rect.minCol }])
      return next
    })
  }

  const unmergeSelected = () => {
    if (selected.length !== 1) {
      showStatus('請先選取單一合併儲存格')
      return
    }

    const target = selected[0]
    setTableData(prev => {
      const next = prev.map(r => r.map(cell => ({ ...cell })))
      const cell = next[target.row][target.col]
      const rowspan = cell.rowspan ?? 1
      const colspan = cell.colspan ?? 1

      if (rowspan === 1 && colspan === 1) {
        showStatus('這個儲存格沒有合併')
        return prev
      }

      for (let r = target.row; r < target.row + rowspan; r++) {
        for (let c = target.col; c < target.col + colspan; c++) {
          if (r === target.row && c === target.col) {
            next[r][c] = { value: cell.value }
          } else {
            next[r][c] = { value: '' }
          }
        }
      }

      showStatus('已取消合併')
      return next
    })
  }

  const copyOutput = async (format: OutputFormat) => {
    let output = ''
    if (format === 'markdown') output = convertToMarkdown(tableData)
    if (format === 'latex') output = convertToLatex(tableData)
    if (format === 'json') output = convertToJson(tableData)
    if (format === 'sheets') output = convertToSheets(tableData)

    await navigator.clipboard.writeText(output)
    showStatus(`已複製 ${format.toUpperCase()} 到剪貼簿`)
  }

  const selectCell = (row: number, col: number, isMulti: boolean) => {
    const id = `${row}-${col}`
    if (isMulti) {
      setSelected(prev => {
        if (prev.some(item => item.row === row && item.col === col)) {
          return prev.filter(item => `${item.row}-${item.col}` !== id)
        }
        return [...prev, { row, col }]
      })
      return
    }

    setSelected([{ row, col }])
  }

  const resizeColumn = (index: number, clientX: number) => {
    const startWidth = colWidths[index]
    const onMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.max(80, startWidth + event.clientX - clientX)
      setColWidths(prev => prev.map((width, i) => (i === index ? nextWidth : width)))
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div className="editor">
      <header className="editor__header">
        <h1>Table Editor</h1>
        <p>可調整欄寬、編輯內容、合併儲存格，並輸出到剪貼簿。</p>
      </header>

      <section className="editor__toolbar">
        <button onClick={addRow}>+ Row</button>
        <button onClick={addColumn}>+ Column</button>
        <button onClick={mergeSelected}>Merge</button>
        <button onClick={unmergeSelected}>Unmerge</button>
        <div className="editor__spacer" />
        <button onClick={() => copyOutput('markdown')}>Copy Markdown</button>
        <button onClick={() => copyOutput('latex')}>Copy LaTeX</button>
        <button onClick={() => copyOutput('json')}>Copy JSON</button>
        <button onClick={() => copyOutput('sheets')}>Copy CSV/TSV</button>
      </section>

      <div className="editor__sheet-wrap">
        <table className="editor__sheet">
          <colgroup>
            {Array.from({ length: cols }).map((_, colIndex) => (
              <col key={colIndex} style={{ width: `${colWidths[colIndex] ?? 140}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, colIndex) => (
                <th key={colIndex}>
                  <span>{String.fromCharCode(65 + colIndex)}</span>
                  <div
                    className="editor__resizer"
                    onMouseDown={event => resizeColumn(colIndex, event.clientX)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: cols }).map((_, colIndex) => {
                  const cell = tableData[rowIndex][colIndex] as CellInfo
                  if (cell.isSpanned) return null

                  const key = `${rowIndex}-${colIndex}`
                  const isSelected = selectedSet.has(key)

                  return (
                    <td
                      key={key}
                      rowSpan={cell.rowspan ?? 1}
                      colSpan={cell.colspan ?? 1}
                      className={isSelected ? 'is-selected' : ''}
                      onClick={event => selectCell(rowIndex, colIndex, event.shiftKey || event.metaKey || event.ctrlKey)}
                    >
                      <input
                        value={cell.value}
                        onChange={event => setCellValue(rowIndex, colIndex, event.target.value)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status ? <div className="editor__status">{status}</div> : null}
    </div>
  )
}

export default EditorApp
