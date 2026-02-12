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

const createDefaultWidths = (cols: number) => Array.from({ length: cols }, () => 160)

const columnLabel = (index: number) => {
  let result = ''
  let value = index
  while (value >= 0) {
    result = String.fromCharCode((value % 26) + 65) + result
    value = Math.floor(value / 26) - 1
  }
  return result
}

function EditorApp() {
  const [tableData, setTableData] = useState<TableData>(() => createEmptyTable(12, 6))
  const [colWidths, setColWidths] = useState<number[]>(() => createDefaultWidths(6))
  const [selected, setSelected] = useState<CellPosition[]>([{ row: 0, col: 0 }])
  const [activeCell, setActiveCell] = useState<CellPosition>({ row: 0, col: 0 })
  const [status, setStatus] = useState('')
  const [exportFormat, setExportFormat] = useState<OutputFormat>('markdown')

  const rows = tableData.length
  const cols = tableData[0]?.length ?? 0

  const selectedSet = useMemo(
    () => new Set(selected.map(item => `${item.row}-${item.col}`)),
    [selected]
  )

  const showStatus = (message: string) => {
    setStatus(message)
    window.setTimeout(() => setStatus(''), 1500)
  }

  const setCellValue = (row: number, col: number, value: string) => {
    setTableData(prev => {
      const next = prev.map(r => r.map(cell => ({ ...cell })))
      next[row][col].value = value
      return next
    })
  }

  const addRow = () => {
    setTableData(prev => [...prev.map(r => r.map(cell => ({ ...cell }))), Array.from({ length: cols }, () => ({ value: '' }))])
    showStatus('已新增一列')
  }

  const addColumn = () => {
    setTableData(prev => prev.map(r => [...r.map(cell => ({ ...cell })), { value: '' }]))
    setColWidths(prev => [...prev, 160])
    showStatus('已新增一欄')
  }

  const clearGrid = () => {
    setTableData(createEmptyTable(12, 6))
    setColWidths(createDefaultWidths(6))
    setSelected([{ row: 0, col: 0 }])
    setActiveCell({ row: 0, col: 0 })
    showStatus('表格已清空')
  }

  const normalizeSelectionToRect = (selection: CellPosition[]) => {
    const minRow = Math.min(...selection.map(item => item.row))
    const maxRow = Math.max(...selection.map(item => item.row))
    const minCol = Math.min(...selection.map(item => item.col))
    const maxCol = Math.max(...selection.map(item => item.col))
    return { minRow, maxRow, minCol, maxCol }
  }

  const mergeSelected = () => {
    if (selected.length < 2) {
      showStatus('請先多選儲存格再合併')
      return
    }

    const rect = normalizeSelectionToRect(selected)
    const expectedCount = (rect.maxRow - rect.minRow + 1) * (rect.maxCol - rect.minCol + 1)
    if (selected.length !== expectedCount) {
      showStatus('目前僅支援矩形範圍合併')
      return
    }

    setTableData(prev => {
      const next = prev.map(r => r.map(cell => ({ ...cell })))
      for (let r = rect.minRow; r <= rect.maxRow; r++) {
        for (let c = rect.minCol; c <= rect.maxCol; c++) {
          const cell = next[r][c]
          if (cell.isSpanned || (cell.colspan && cell.colspan > 1) || (cell.rowspan && cell.rowspan > 1)) {
            showStatus('選取範圍包含已合併儲存格')
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

      setSelected([{ row: rect.minRow, col: rect.minCol }])
      setActiveCell({ row: rect.minRow, col: rect.minCol })
      return next
    })

    showStatus('已完成合併')
  }

  const unmergeSelected = () => {
    if (selected.length !== 1) {
      showStatus('請先選取單一儲存格')
      return
    }

    const target = selected[0]
    setTableData(prev => {
      const next = prev.map(r => r.map(cell => ({ ...cell })))
      const cell = next[target.row][target.col]
      const rowspan = cell.rowspan ?? 1
      const colspan = cell.colspan ?? 1

      if (rowspan === 1 && colspan === 1) {
        showStatus('此儲存格未合併')
        return prev
      }

      for (let r = target.row; r < target.row + rowspan; r++) {
        for (let c = target.col; c < target.col + colspan; c++) {
          next[r][c] = r === target.row && c === target.col ? { value: cell.value } : { value: '' }
        }
      }
      return next
    })

    showStatus('已取消合併')
  }

  const buildOutput = (format: OutputFormat) => {
    if (format === 'markdown') return convertToMarkdown(tableData)
    if (format === 'latex') return convertToLatex(tableData)
    if (format === 'json') return convertToJson(tableData)
    return convertToSheets(tableData)
  }

  const copyOutput = async () => {
    const output = buildOutput(exportFormat)
    await navigator.clipboard.writeText(output)
    showStatus(`已複製 ${exportFormat.toUpperCase()} 到剪貼簿`)
  }

  const selectCell = (row: number, col: number, append: boolean) => {
    setActiveCell({ row, col })
    if (append) {
      setSelected(prev => {
        if (prev.some(item => item.row === row && item.col === col)) {
          return prev.filter(item => !(item.row === row && item.col === col))
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
      const nextWidth = Math.max(100, startWidth + event.clientX - clientX)
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
      <header className="editor__topbar">
        <div className="editor__brand">
          <div className="editor__brand-icon material-symbols-outlined">table_rows</div>
          <h1>TableMorph</h1>
        </div>
        <div className="editor__actions">
          <button onClick={addRow}><span className="material-symbols-outlined">add_box</span>Add Row</button>
          <button onClick={addColumn}><span className="material-symbols-outlined">view_column</span>Add Column</button>
          <button onClick={mergeSelected}><span className="material-symbols-outlined">merge_type</span>Merge</button>
          <button onClick={unmergeSelected}><span className="material-symbols-outlined">call_split</span>Split</button>
          <button className="danger" onClick={clearGrid}><span className="material-symbols-outlined">delete_sweep</span>Clear Grid</button>
        </div>
      </header>

      <main className="editor__main">
        <div className="editor__grid-wrap">
          <table className="editor__table">
            <colgroup>
              <col style={{ width: '52px' }} />
              {Array.from({ length: cols }).map((_, colIndex) => (
                <col key={colIndex} style={{ width: `${colWidths[colIndex] ?? 160}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="corner" />
                {Array.from({ length: cols }).map((_, colIndex) => (
                  <th key={colIndex}>
                    <span>{columnLabel(colIndex)}</span>
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
                  <td className="row-num">{rowIndex + 1}</td>
                  {Array.from({ length: cols }).map((_, colIndex) => {
                    const cell = tableData[rowIndex][colIndex] as CellInfo
                    if (cell.isSpanned) return null

                    const cellKey = `${rowIndex}-${colIndex}`
                    const isSelected = selectedSet.has(cellKey)
                    const isActive = activeCell.row === rowIndex && activeCell.col === colIndex

                    return (
                      <td
                        key={cellKey}
                        rowSpan={cell.rowspan ?? 1}
                        colSpan={cell.colspan ?? 1}
                        className={`${isSelected ? 'cell-selected' : ''} ${isActive ? 'cell-active' : ''}`.trim()}
                        onClick={event => selectCell(rowIndex, colIndex, event.shiftKey || event.ctrlKey || event.metaKey)}
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

        <aside className="editor__sidebar">
          <h2>Export Options</h2>
          <p>編輯完成後選擇格式並直接複製到剪貼簿。</p>
          <label htmlFor="export-format">Format</label>
          <select
            id="export-format"
            value={exportFormat}
            onChange={event => setExportFormat(event.target.value as OutputFormat)}
          >
            <option value="markdown">Markdown</option>
            <option value="latex">LaTeX</option>
            <option value="json">JSON</option>
            <option value="sheets">CSV / TSV</option>
          </select>
          <button className="editor__copy" onClick={copyOutput}>Copy to Clipboard</button>

          <div className="editor__meta">
            <div><span>Rows</span><strong>{rows}</strong></div>
            <div><span>Columns</span><strong>{cols}</strong></div>
            <div><span>Selected</span><strong>{selected.length}</strong></div>
          </div>
        </aside>
      </main>

      {status ? <div className="editor__toast">{status}</div> : null}
    </div>
  )
}

export default EditorApp
