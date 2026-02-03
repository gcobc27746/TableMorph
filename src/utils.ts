import Papa from 'papaparse'
import { markdownTable } from 'markdown-table'

// 儲存格資訊介面，支援合併儲存格
export interface CellInfo {
  value: string
  colspan?: number  // 橫向合併的列數
  rowspan?: number  // 縱向合併的行數
  isSpanned?: boolean  // 標記此儲存格是否被 rowspan 佔用
}

export type TableData = CellInfo[][]

// 將 CellInfo[][] 轉換為 string[][]（向後兼容）
export const flattenTableData = (tableData: TableData): string[][] => {
  return tableData.map(row => row.map(cell => cell.value))
}

// 將 string[][] 轉換為 CellInfo[][]
export const expandTableData = (tableData: string[][]): TableData => {
  return tableData.map(row => row.map(value => ({ value })))
}

export const parseHtmlTable = (html: string): TableData => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return []

  const rows = Array.from(table.rows)
  const result: TableData = []
  
  // 追蹤每個位置是否被 rowspan 佔用 [row][col] = true 表示被佔用
  const spannedCells: boolean[][] = []
  
  // 先計算最大列數
  let maxCols = 0
  for (const row of rows) {
    let colCount = 0
    for (const cell of Array.from(row.cells)) {
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10) || 1
      colCount += colspan
    }
    maxCols = Math.max(maxCols, colCount)
  }
  
  // 初始化 spannedCells
  for (let r = 0; r < rows.length; r++) {
    spannedCells[r] = new Array(maxCols).fill(false)
  }
  
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const cells = Array.from(row.cells)
    const resultRow: CellInfo[] = []
    
    let colIndex = 0
    
    for (const cell of cells) {
      // 跳過被 rowspan 佔用的位置
      while (colIndex < maxCols && spannedCells[rowIndex] && spannedCells[rowIndex][colIndex]) {
        resultRow.push({ value: '', isSpanned: true })
        colIndex++
      }
      
      if (colIndex >= maxCols) break
      
      let textContent = cell.textContent || ''
      
      // 清理文字內容：移除多餘的空白和換行符
      // 1. 統一換行符為 \n
      textContent = textContent
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
      
      // 2. 清理每行的前導和尾隨空白，但保留換行結構
      const lines = textContent.split('\n')
      const cleanedLines = lines.map(line => line.trim())
      textContent = cleanedLines.join('\n')
      
      // 3. 將多個連續的換行符合併為單一換行符（移除空行）
      textContent = textContent.replace(/\n{2,}/g, '\n')
      
      // 4. 清理開頭和結尾的空白和換行符
      textContent = textContent.trim()
      
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10) || 1
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10) || 1
      
      const cellInfo: CellInfo = {
        value: textContent,
      }
      
      if (colspan > 1) {
        cellInfo.colspan = colspan
      }
      
      if (rowspan > 1) {
        cellInfo.rowspan = rowspan
        
        // 標記後續行中此位置被佔用
        for (let r = rowIndex + 1; r < rowIndex + rowspan && r < rows.length; r++) {
          for (let c = colIndex; c < colIndex + colspan && c < maxCols; c++) {
            if (!spannedCells[r]) {
              spannedCells[r] = new Array(maxCols).fill(false)
            }
            spannedCells[r][c] = true
          }
        }
      }
      
      resultRow.push(cellInfo)
      
      // 處理 colspan：在當前行添加空白儲存格
      for (let c = 1; c < colspan; c++) {
        resultRow.push({ value: '', isSpanned: true })
      }
      
      colIndex += colspan
    }
    
    // 填充剩餘的列
    while (resultRow.length < maxCols) {
      resultRow.push({ value: '', isSpanned: true })
    }
    
    result.push(resultRow)
  }
  
  return result
}

const isMarkdownSeparator = (line: string): boolean => {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return false
  return /^(\|?\s*:?-+:?\s*)+(\|\s*:?-+:?\s*)+\|?$/.test(trimmed)
}

export const parseMarkdownTable = (text: string): string[][] | null => {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length < 2 || !isMarkdownSeparator(lines[1])) return null

  const rows = lines.filter((_, index) => index !== 1)
  const parsed = rows.map(line => {
    let cells = line.split('|')
    if (cells.length && cells[0].trim() === '') cells = cells.slice(1)
    if (cells.length && cells[cells.length - 1].trim() === '') cells = cells.slice(0, -1)
    return cells.map(cell => cell.trim())
  })

  return parsed.length ? parsed : null
}

export const parseLatexTable = (text: string): TableData | string[][] | null => {
  if (!text.includes('\\begin{tabular}')) return null

  const tabularMatch = text.match(/\\begin\{tabular\}[\s\S]*?\\end\{tabular\}/)
  const tabularBody = tabularMatch ? tabularMatch[0] : text

  // 提取列規格
  const colSpecMatch = tabularBody.match(/\\begin\{tabular\}\{([^}]*)\}/)
  const colSpec = colSpecMatch ? colSpecMatch[1] : ''
  const columnCount = colSpec.length || 5 // 預設值

  // 分割行
  const rows = tabularBody
    .split(/\\\\/g)
    .map(line =>
      line
        .replace(/\\hline/g, '')
        .replace(/\\begin\{tabular\}\{[^}]*\}/g, '')
        .replace(/\\end\{tabular\}/g, '')
        .trim()
    )
    .filter(line => line.length > 0)

  if (rows.length === 0) return null

  const result: TableData = []
  
  // 追蹤 rowspan 狀態：記錄每個位置被 rowspan 佔用的行數
  const rowspanActive: boolean[][] = []
  for (let r = 0; r < rows.length; r++) {
    rowspanActive[r] = new Array(columnCount).fill(false)
  }
  
  // 解析儲存格的輔助函數
  const parseCell = (cellText: string): { content: string; colspan: number; rowspan: number } => {
    let content = cellText.trim()
    let colspan = 1
    let rowspan = 1
    
    // 解析嵌套的 multirow + multicolumn：\multirow{num}{*}{\multicolumn{num}{align}{content}}
    const nestedMatch = content.match(/\\multirow\{(\d+)\}\{[^}]*\}\{\\multicolumn\{(\d+)\}\{[^}]*\}\{([^}]*)\}\}/)
    if (nestedMatch) {
      rowspan = parseInt(nestedMatch[1], 10)
      colspan = parseInt(nestedMatch[2], 10)
      content = nestedMatch[3]
    } else {
      // 解析 multirow：\multirow{num}{*}{content} 或 \multirow{num}{width}{content}
      const multirowMatch = content.match(/\\multirow\{(\d+)\}\{[^}]*\}\{([^}]*)\}/)
      if (multirowMatch) {
        rowspan = parseInt(multirowMatch[1], 10)
        content = multirowMatch[2]
        
        // 檢查 multirow 內部是否有 multicolumn
        const innerMulticolumnMatch = content.match(/\\multicolumn\{(\d+)\}\{[^}]*\}\{([^}]*)\}/)
        if (innerMulticolumnMatch) {
          colspan = parseInt(innerMulticolumnMatch[1], 10)
          content = innerMulticolumnMatch[2]
        }
      } else {
        // 解析 multicolumn：\multicolumn{num}{align}{content}
        const multicolumnMatch = content.match(/\\multicolumn\{(\d+)\}\{[^}]*\}\{([^}]*)\}/)
        if (multicolumnMatch) {
          colspan = parseInt(multicolumnMatch[1], 10)
          content = multicolumnMatch[2]
        }
      }
    }
    
    // 清理 LaTeX 轉義字符
    content = content
      .replace(/\\textbackslash\{\}/g, '\\')
      .replace(/\\&/g, '&')
      .replace(/\\%/g, '%')
      .replace(/\\\$/g, '$')
      .replace(/\\#/g, '#')
      .replace(/\\_/g, '_')
      .replace(/\\\{/g, '{')
      .replace(/\\\}/g, '}')
      .replace(/\\textasciitilde\{\}/g, '~')
      .replace(/\\textasciicircum\{\}/g, '^')
      .trim()
    
    return { content, colspan, rowspan }
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const resultRow: CellInfo[] = []
    
    // 分割儲存格（使用 & 分隔）
    // 注意：不過濾空字串，因為空儲存格在 LaTeX 表格中是有效的（以 & 開頭表示第一個儲存格為空）
    const cells = row.split('&').map(cell => cell.trim())
    
    let colIndex = 0
    let cellIndex = 0  // LaTeX 儲存格的索引
    
    // 處理所有列
    while (colIndex < columnCount) {
      // 如果當前位置被 rowspan 佔用，插入佔位符
      // 注意：在 LaTeX 中，被 rowspan 佔用的位置在後續行中不會有對應的儲存格
      // 但如果 LaTeX 行以 & 開頭，第一個空儲存格對應的是被 rowspan 佔用的位置，應該跳過
      if (rowspanActive[rowIndex] && rowspanActive[rowIndex][colIndex]) {
        resultRow.push({ value: '', isSpanned: true })
        colIndex++
        // 如果 LaTeX 中還有儲存格，且第一個是空字串，跳過它（因為它對應被 rowspan 佔用的位置）
        if (cellIndex < cells.length && cells[cellIndex].length === 0) {
          cellIndex++
        }
        continue
      }
      
      // 當前位置沒有被 rowspan 佔用，處理 LaTeX 中的儲存格
      if (cellIndex >= cells.length) {
        // LaTeX 儲存格用完了，填充剩餘位置為空
        resultRow.push({ value: '', isSpanned: true })
        colIndex++
        continue
      }
      
      const cellText = cells[cellIndex]
      cellIndex++
      
      // 如果儲存格為空，創建空儲存格
      if (cellText.length === 0) {
        resultRow.push({ value: '' })
        colIndex++
        continue
      }
      
      const { content, colspan, rowspan } = parseCell(cellText)
      
      const cellInfo: CellInfo = {
        value: content,
      }
      
      if (colspan > 1) {
        cellInfo.colspan = colspan
      }
      
      if (rowspan > 1) {
        cellInfo.rowspan = rowspan
        
        // 標記後續行中此位置被佔用
        for (let r = rowIndex + 1; r < rowIndex + rowspan && r < rows.length; r++) {
          for (let c = colIndex; c < colIndex + colspan && c < columnCount; c++) {
            rowspanActive[r][c] = true
          }
        }
      }
      
      resultRow.push(cellInfo)
      
      // 處理 colspan：在當前行添加空白儲存格
      for (let c = 1; c < colspan; c++) {
        resultRow.push({ value: '', isSpanned: true })
      }
      
      colIndex += colspan
    }
    
    // 填充剩餘的列
    while (resultRow.length < columnCount) {
      resultRow.push({ value: '', isSpanned: true })
    }
    
    result.push(resultRow)
  }
  
  return result.length > 0 ? result : null
}

export const parseJsonTable = (text: string): TableData | string[][] | null => {
  const trimmed = text.trim()
  if (!trimmed.startsWith('[')) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return null

    if (parsed.length === 0) return []

    if (Array.isArray(parsed[0])) {
      const rows = parsed as unknown[][]
      
      // 檢查第一行第一個元素是否為對象且有 value 屬性（TableData 格式）
      const firstRow = rows[0]
      const firstCell = Array.isArray(firstRow) ? firstRow[0] : undefined
      const isTableDataFormat = 
        typeof firstCell === 'object' && 
        firstCell !== null && 
        'value' in firstCell
      
      if (isTableDataFormat) {
        // 這是 TableData 格式，直接返回
        return rows.map(row =>
          Array.isArray(row) 
            ? row.map(cell => {
                if (typeof cell === 'object' && cell !== null && 'value' in cell) {
                  // 提取 CellInfo 對象
                  const cellObj = cell as Record<string, unknown>
                  const cellInfo: CellInfo = {
                    value: String(cellObj.value ?? '')
                  }
                  if (cellObj.colspan && typeof cellObj.colspan === 'number') {
                    cellInfo.colspan = cellObj.colspan
                  }
                  if (cellObj.rowspan && typeof cellObj.rowspan === 'number') {
                    cellInfo.rowspan = cellObj.rowspan
                  }
                  if (cellObj.isSpanned === true) {
                    cellInfo.isSpanned = true
                  }
                  return cellInfo
                }
                // 如果不是對象，轉換為字符串並創建 CellInfo
                return { value: String(cell ?? '') }
              })
            : [{ value: String(row ?? '') }]
        ) as TableData
      } else {
        // 這是 string[][] 格式
        return rows.map(row =>
          Array.isArray(row) ? row.map(cell => String(cell ?? '')) : [String(row ?? '')]
        )
      }
    }

    if (typeof parsed[0] === 'object' && parsed[0] !== null) {
      const objects = parsed as Record<string, unknown>[]
      const headers = Array.from(
        objects.reduce((set, item) => {
          Object.keys(item).forEach(key => set.add(key))
          return set
        }, new Set<string>())
      )
      const rows = objects.map(item => headers.map(key => String(item[key] ?? '')))
      return [headers, ...rows]
    }
  } catch {
    return null
  }

  return null
}

export const convertToMarkdown = (tableData: TableData | string[][]): string => {
  // 如果是 string[][]，轉換為 TableData
  const data: TableData = Array.isArray(tableData) && tableData.length > 0 && typeof tableData[0][0] === 'string'
    ? expandTableData(tableData as string[][])
    : (tableData as TableData)
  
  // 將 TableData 轉換為二維陣列，處理合併儲存格
  const flattened: string[][] = []
  
  // 處理換行符的輔助函數：將換行符替換為 HTML <br> 標籤，並清理換行後的前導空白
  const processNewlines = (value: string): string => {
    // 如果沒有換行符，直接返回
    if (!value.includes('\n') && !value.includes('\r')) {
      return value
    }
    
    // 先統一處理換行符：將所有換行符統一為 \n
    let normalized = value
      .replace(/\r\n/g, '\n')  // Windows 換行符
      .replace(/\r/g, '\n')      // Mac 換行符
    
    // 清理換行後的前導空白：將 "換行符 + 空白" 替換為 "換行符"
    normalized = normalized.replace(/\n\s+/g, '\n')
    
    // 將換行符替換為 <br>
    return normalized.replace(/\n/g, '<br>')
  }
  
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex]
    const flattenedRow: string[] = []
    
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = row[colIndex]
      
      // 如果是被 rowspan 佔用的位置，輸出空字串
      if (cell.isSpanned) {
        flattenedRow.push('')
      } else {
        // 處理換行符：替換為 <br> 標籤以保持 Markdown 表格結構
        const processedValue = processNewlines(cell.value)
        flattenedRow.push(processedValue)
        
        // 處理 colspan：在後續位置添加空字串
        const colspan = cell.colspan || 1
        for (let c = 1; c < colspan; c++) {
          flattenedRow.push('')
        }
        colIndex += colspan - 1
      }
    }
    
    flattened.push(flattenedRow)
  }
  
  return markdownTable(flattened)
}

export const convertToLatex = (tableData: TableData | string[][]): string => {
  // 如果是 string[][]，轉換為 TableData
  const data: TableData = Array.isArray(tableData) && tableData.length > 0 && typeof tableData[0][0] === 'string'
    ? expandTableData(tableData as string[][])
    : (tableData as TableData)
  
  if (data.length === 0) return ''

  const columnCount = Math.max(...data.map(row => row.length), 0)
  const columnSpec = Array.from({ length: columnCount }, () => 'l').join('')

  const escapeLatex = (value: string): string =>
    value
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}')

  // 處理多行文字：將換行符轉換為 LaTeX 表格中的多行格式
  const processMultilineCell = (value: string): string => {
    // 統一處理換行符：將所有換行符統一為 \n
    const normalized = value
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
    
    // 如果沒有換行符，直接返回 escape 後的值
    if (!normalized.includes('\n')) {
      return escapeLatex(value)
    }
    
    // 將每行分別 escape，然後用 \\ 連接
    const lines = normalized.split('\n').map(line => escapeLatex(line))
    const multilineContent = lines.join('\\\\')
    
    // 使用 tabular 環境包裝多行內容
    return `\\begin{tabular}[c]{@{}l@{}}${multilineContent}\\end{tabular}`
  }

  // 追蹤每個位置是否被 rowspan 佔用
  const rowspanActive: boolean[][] = []
  const hasRowspan = data.some(row => row.some(cell => cell.rowspan && cell.rowspan > 1))
  
  // 初始化 rowspanActive
  for (let r = 0; r < data.length; r++) {
    rowspanActive[r] = new Array(columnCount).fill(false)
  }
  
  // 標記所有被 rowspan 佔用的位置
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex]
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = row[colIndex]
      if (cell.rowspan && cell.rowspan > 1) {
        for (let r = rowIndex + 1; r < rowIndex + cell.rowspan && r < data.length; r++) {
          const colspan = cell.colspan || 1
          for (let c = colIndex; c < colIndex + colspan && c < columnCount; c++) {
            rowspanActive[r][c] = true
          }
        }
      }
    }
  }
  
  const rows: string[] = []
  
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex]
    const cells: string[] = []
    
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      // 如果此位置被 rowspan 佔用，輸出空儲存格（LaTeX 表格中需要保持列數一致）
      if (rowspanActive[rowIndex] && rowspanActive[rowIndex][colIndex]) {
        cells.push('')
        continue
      }
      
      const cell = row[colIndex]
      
      // 如果此儲存格被標記為 spanned（由 colspan 產生），跳過
      if (!cell || cell.isSpanned) {
        continue
      }
      
      // 處理多行文字：如果包含換行符，使用 tabular 環境包裝
      let cellContent = processMultilineCell(cell.value)
      const colspan = cell.colspan || 1
      const rowspan = cell.rowspan || 1
      
      // 處理 rowspan 和 colspan 的組合
      // 如果同時有 rowspan 和 colspan，先處理 multicolumn，再用 multirow 包裹
      if (rowspan > 1 && colspan > 1) {
        cellContent = `\\multirow{${rowspan}}{*}{\\multicolumn{${colspan}}{l}{${cellContent}}}`
      } else if (rowspan > 1) {
        cellContent = `\\multirow{${rowspan}}{*}{${cellContent}}`
      } else if (colspan > 1) {
        cellContent = `\\multicolumn{${colspan}}{l}{${cellContent}}`
      }
      
      cells.push(cellContent)
      
      // 跳過 colspan 佔用的後續列
      colIndex += colspan - 1
    }
    
    // 最後一行不需要尾隨的 \\
    const rowContent = cells.join(' & ')
    if (rowIndex < data.length - 1) {
      rows.push(rowContent + ' \\\\')
    } else {
      rows.push(rowContent)
    }
  }

  const tabularContent = [`\\begin{tabular}{${columnSpec}}`, ...rows, '\\end{tabular}'].join('\n')
  const result = `\\begin{table}[]\n${tabularContent}\n\\end{table}`
  
  // 如果有使用 rowspan，添加套件提示
  if (hasRowspan) {
    return `% Please add the following required packages to your document preamble:\n% \\usepackage{multirow}\n${result}`
  }
  
  return result
}

export const convertToJson = (tableData: TableData | string[][]): string => {
  // 如果是 string[][]，轉換為 TableData
  const data: TableData = Array.isArray(tableData) && tableData.length > 0 && typeof tableData[0][0] === 'string'
    ? expandTableData(tableData as string[][])
    : (tableData as TableData)
  
  // 保存完整合併資訊
  // JSON.stringify 會自動處理換行符的轉義（\n），所以不需要手動處理
  const result = data.map(row =>
    row.map(cell => {
      const obj: Record<string, unknown> = { value: cell.value }
      if (cell.colspan) obj.colspan = cell.colspan
      if (cell.rowspan) obj.rowspan = cell.rowspan
      if (cell.isSpanned) obj.isSpanned = cell.isSpanned
      return obj
    })
  )
  
  return JSON.stringify(result, null, 2)
}

export const convertToSheets = (tableData: TableData | string[][]): string => {
  // 如果是 string[][]，轉換為 TableData
  const data: TableData = Array.isArray(tableData) && tableData.length > 0 && typeof tableData[0][0] === 'string'
    ? expandTableData(tableData as string[][])
    : (tableData as TableData)
  
  // 將 TableData 轉換為二維陣列，處理合併儲存格
  const flattened: string[][] = []
  
  // 處理換行符的輔助函數：將 <br> 標籤轉換為換行符
  const processBrTags = (value: string): string => {
    // 將 <br> 或 <br/> 標籤轉換為換行符
    return value
      .replace(/<br\s*\/?>/gi, '\n')  // 處理 <br> 和 <br/>
      .replace(/\r\n/g, '\n')          // 統一 Windows 換行符
      .replace(/\r/g, '\n')            // 統一 Mac 換行符
  }
  
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex]
    const flattenedRow: string[] = []
    
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = row[colIndex]
      
      // 如果是被 rowspan 佔用的位置，輸出空字串
      if (cell.isSpanned) {
        flattenedRow.push('')
      } else {
        // 處理 <br> 標籤：轉換為換行符，這樣試算表應用程式才能正確顯示換行
        const processedValue = processBrTags(cell.value)
        flattenedRow.push(processedValue)
        
        // 處理 colspan：在後續位置添加空字串
        const colspan = cell.colspan || 1
        for (let c = 1; c < colspan; c++) {
          flattenedRow.push('')
        }
        colIndex += colspan - 1
      }
    }
    
    flattened.push(flattenedRow)
  }
  
  return Papa.unparse(flattened, { delimiter: '\t' })
}