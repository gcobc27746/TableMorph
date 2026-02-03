import { describe, it, expect } from 'vitest'
import {
  parseHtmlTable,
  parseMarkdownTable,
  parseLatexTable,
  convertToMarkdown,
  convertToLatex,
  convertToJson,
  convertToSheets,
  flattenTableData,
  type TableData,
} from '../src/utils'

describe('parseHtmlTable', () => {
  it('should parse simple HTML table', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>'
    const result = parseHtmlTable(html)
    expect(flattenTableData(result)).toEqual([['A', 'B'], ['C', 'D']])
  })

  it('should parse HTML table with colspan', () => {
    const html = '<table><tr><td colspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr></table>'
    const result = parseHtmlTable(html)
    expect(result[0][0].colspan).toBe(2)
    expect(result[0][0].value).toBe('A')
    expect(result[0][1].isSpanned).toBe(true)
    expect(result[0][2].value).toBe('B')
  })

  it('should parse HTML table with rowspan', () => {
    const html = '<table><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></table>'
    const result = parseHtmlTable(html)
    expect(result[0][0].rowspan).toBe(2)
    expect(result[0][0].value).toBe('A')
    expect(result[1][0].isSpanned).toBe(true)
    expect(result[1][1].value).toBe('C')
  })

  it('should parse HTML table with both colspan and rowspan', () => {
    const html = '<table><tr><td></td><td colspan="2">a</td><td colspan="2">b</td></tr><tr><td rowspan="2">t</td><td>c</td><td>d</td><td>e</td><td>f</td></tr><tr><td>g</td><td>h</td><td>j</td><td>k</td></tr><tr><td>r</td><td>i</td><td>o</td><td>o</td><td>o</td></tr></table>'
    const result = parseHtmlTable(html)
    expect(result[0][1].colspan).toBe(2)
    expect(result[0][1].value).toBe('a')
    expect(result[0][3].colspan).toBe(2)
    expect(result[0][3].value).toBe('b')
    expect(result[1][0].rowspan).toBe(2)
    expect(result[1][0].value).toBe('t')
    expect(result[2][0].isSpanned).toBe(true)
  })
})

describe('convertToMarkdown', () => {
  it('should convert table data to Markdown', () => {
    const data = [['A', 'B'], ['C', 'D']]
    const result = convertToMarkdown(data)
    expect(result).toContain('| A | B |')
  })

  it('should convert table with colspan to Markdown', () => {
    const html = '<table><tr><td colspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToMarkdown(tableData)
    // Markdown doesn't support colspan, so it should use empty cells
    expect(result).toContain('A')
  })

  it('should convert table with rowspan to Markdown', () => {
    const html = '<table><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToMarkdown(tableData)
    expect(result).toContain('A')
  })

  it('should handle newlines in cells by converting to <br> tags', () => {
    const data = [['Line1\nLine2', 'B'], ['C', 'D']]
    const result = convertToMarkdown(data)
    expect(result).toContain('<br>')
    expect(result).toContain('Line1')
    expect(result).toContain('Line2')
    // 確保表格結構完整（每行只有一個 | 開頭）
    const lines = result.split('\n')
    const tableRows = lines.filter(line => line.trim().startsWith('|'))
    // 應該有正確的表格行數（不包括分隔符行）
    expect(tableRows.length).toBeGreaterThanOrEqual(2)
  })

  it('should handle Windows-style newlines (\\r\\n)', () => {
    const data = [['Line1\r\nLine2', 'B'], ['C', 'D']]
    const result = convertToMarkdown(data)
    expect(result).toContain('<br>')
    expect(result).not.toContain('\r\n')
  })

  it('should handle Mac-style newlines (\\r)', () => {
    const data = [['Line1\rLine2', 'B'], ['C', 'D']]
    const result = convertToMarkdown(data)
    expect(result).toContain('<br>')
    expect(result).not.toContain('\r')
  })
})

describe('parseMarkdownTable', () => {
  it('should parse Markdown table', () => {
    const markdown = `| A | B |\n| --- | --- |\n| C | D |`
    const result = parseMarkdownTable(markdown)
    expect(result).toEqual([['A', 'B'], ['C', 'D']])
  })
})

describe('parseLatexTable', () => {
  it('should parse LaTeX table with multicolumn and multirow', () => {
    const latex = `\\begin{tabular}{lllll}
                   & \\multicolumn{2}{l}{a} & \\multicolumn{2}{l}{b} \\\\
\\multirow{2}{*}{t} & c         & d         & e         & f         \\\\
                   & g         & h         & j         & k         \\\\
r                  & i         & o         & o         & o        
\\end{tabular}`
    const result = parseLatexTable(latex)
    expect(result).not.toBeNull()
    if (result && Array.isArray(result) && result.length > 0) {
      // 檢查是否正確解析了合併儲存格
      if (typeof result[0][0] !== 'string') {
        const tableData = result as TableData
        expect(tableData[0][1].colspan).toBe(2)
        expect(tableData[0][1].value).toBe('a')
        expect(tableData[0][3].colspan).toBe(2)
        expect(tableData[0][3].value).toBe('b')
        expect(tableData[1][0].rowspan).toBe(2)
        expect(tableData[1][0].value).toBe('t')
        expect(tableData[2][0].isSpanned).toBe(true)
      }
    }
  })

  it('should parse LaTeX table and convert to Markdown correctly', () => {
    const latex = `\\begin{tabular}{lllll}
                   & \\multicolumn{2}{l}{a} & \\multicolumn{2}{l}{b} \\\\
\\multirow{2}{*}{t} & c         & d         & e         & f         \\\\
                   & g         & h         & j         & k         \\\\
r                  & i         & o         & o         & o        
\\end{tabular}`
    const parsed = parseLatexTable(latex)
    expect(parsed).not.toBeNull()
    if (parsed) {
      const markdown = convertToMarkdown(parsed)
      // 應該不包含 LaTeX 命令
      expect(markdown).not.toContain('\\multicolumn')
      expect(markdown).not.toContain('\\multirow')
      // 應該包含實際內容
      expect(markdown).toContain('a')
      expect(markdown).toContain('t')
      
      // 驗證第一行第一個儲存格是空的（因為 LaTeX 行以 & 開頭）
      if (typeof parsed[0][0] !== 'string') {
        const tableData = parsed as TableData
        expect(tableData[0][0].value).toBe('')
        // 第二個儲存格應該是 'a'，且 colspan=2
        expect(tableData[0][1].value).toBe('a')
        expect(tableData[0][1].colspan).toBe(2)
        // 第三個儲存格應該是被 colspan 佔用的
        expect(tableData[0][2].isSpanned).toBe(true)
        // 第四個儲存格應該是 'b'，且 colspan=2
        expect(tableData[0][3].value).toBe('b')
        expect(tableData[0][3].colspan).toBe(2)
      }
    }
  })
})

describe('convertToLatex', () => {
  it('should convert table data to LaTeX', () => {
    const data = [['A', 'B'], ['C', 'D']]
    const result = convertToLatex(data)
    expect(result).toContain('\\begin{tabular}')
  })

  it('should convert table with colspan to LaTeX', () => {
    const html = '<table><tr><td colspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToLatex(tableData)
    expect(result).toContain('\\multicolumn{2}{l}{A}')
  })

  it('should convert table with rowspan to LaTeX', () => {
    const html = '<table><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToLatex(tableData)
    expect(result).toContain('\\multirow{2}{*}{A}')
    expect(result).toContain('\\usepackage{multirow}')
  })

  it('should convert complex merged cells table to LaTeX', () => {
    const html = '<table><tr><td></td><td colspan="2">a</td><td colspan="2">b</td></tr><tr><td rowspan="2">t</td><td>c</td><td>d</td><td>e</td><td>f</td></tr><tr><td>g</td><td>h</td><td>j</td><td>k</td></tr><tr><td>r</td><td>i</td><td>o</td><td>o</td><td>o</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToLatex(tableData)
    expect(result).toContain('\\multicolumn{2}{l}{a}')
    expect(result).toContain('\\multicolumn{2}{l}{b}')
    expect(result).toContain('\\multirow{2}{*}{t}')
    expect(result).toContain('\\usepackage{multirow}')
  })

  it('should handle multiline text in cells using tabular environment', () => {
    const data = [['Line1\nLine2', 'B'], ['C', 'D']]
    const result = convertToLatex(data)
    expect(result).toContain('\\begin{tabular}[c]{@{}l@{}}')
    expect(result).toContain('Line1\\\\')
    expect(result).toContain('Line2')
    expect(result).toContain('\\end{tabular}')
  })

  it('should handle multiline text with multicolumn', () => {
    const html = '<table><tr><td colspan="2">Line1\nLine2</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToLatex(tableData)
    expect(result).toContain('\\multicolumn{2}{l}{\\begin{tabular}[c]{@{}l@{}}')
    expect(result).toContain('Line1\\\\')
    expect(result).toContain('Line2')
    expect(result).toContain('\\end{tabular}}')
  })

  it('should handle multiline text with multirow', () => {
    const html = '<table><tr><td rowspan="2">Line1\nLine2</td><td>B</td></tr><tr><td>C</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToLatex(tableData)
    expect(result).toContain('\\multirow{2}{*}{\\begin{tabular}[c]{@{}l@{}}')
    expect(result).toContain('Line1\\\\')
    expect(result).toContain('Line2')
    expect(result).toContain('\\end{tabular}}')
    expect(result).toContain('\\usepackage{multirow}')
  })

  it('should handle Windows-style newlines (\\r\\n) in cells', () => {
    const data = [['Line1\r\nLine2', 'B'], ['C', 'D']]
    const result = convertToLatex(data)
    expect(result).toContain('\\begin{tabular}[c]{@{}l@{}}')
    expect(result).toContain('Line1\\\\')
    expect(result).toContain('Line2')
    expect(result).not.toContain('\r\n')
  })

  it('should handle Mac-style newlines (\\r) in cells', () => {
    const data = [['Line1\rLine2', 'B'], ['C', 'D']]
    const result = convertToLatex(data)
    expect(result).toContain('\\begin{tabular}[c]{@{}l@{}}')
    expect(result).toContain('Line1\\\\')
    expect(result).toContain('Line2')
    expect(result).not.toContain('\r')
  })

  it('should not add tabular environment for cells without newlines', () => {
    const data = [['Single Line', 'B'], ['C', 'D']]
    const result = convertToLatex(data)
    expect(result).not.toContain('\\begin{tabular}[c]{@{}l@{}}')
    expect(result).toContain('Single Line')
  })

  it('should handle complex table with multiline cells matching expected format', () => {
    // 這個測試對應使用者提供的範例表格
    const html = '<table><tr><td></td><td colspan="2">a</td><td colspan="2">b\nA</td></tr><tr><td rowspan="2">t</td><td>c\nR</td><td>d</td><td>e</td><td>f</td></tr><tr><td>g</td><td>h</td><td>j</td><td>k</td></tr><tr><td>r</td><td>i</td><td>o</td><td>o</td><td>o</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToLatex(tableData)
    
    // 檢查 multicolumn 與多行文字的組合
    expect(result).toContain('\\multicolumn{2}{l}{a}')
    expect(result).toContain('\\multicolumn{2}{l}{\\begin{tabular}[c]{@{}l@{}}b\\\\')
    expect(result).toContain('A\\end{tabular}}')
    
    // 檢查 multirow 與多行文字的組合
    expect(result).toContain('\\multirow{2}{*}{t}')
    expect(result).toContain('\\begin{tabular}[c]{@{}l@{}}c\\\\')
    expect(result).toContain('R\\end{tabular}')
    
    // 檢查最後一行沒有尾隨的 \\
    const lines = result.split('\n')
    const lastTableRow = lines.find(line => line.trim().startsWith('r'))
    expect(lastTableRow).toBeTruthy()
    if (lastTableRow) {
      expect(lastTableRow.trim()).not.toMatch(/\\\\\s*$/)
    }
    
    expect(result).toContain('\\usepackage{multirow}')
  })

  it('should escape special LaTeX characters in multiline cells', () => {
    const data = [['Line1 & Line2\nLine3 % Line4', 'B'], ['C', 'D']]
    const result = convertToLatex(data)
    expect(result).toContain('Line1 \\& Line2\\\\')
    expect(result).toContain('Line3 \\% Line4')
  })
})

describe('convertToJson', () => {
  it('should convert table data to JSON', () => {
    const data = [['A', 'B'], ['C', 'D']]
    const result = convertToJson(data)
    const parsed = JSON.parse(result)
    expect(parsed[0][0].value).toBe('A')
    expect(parsed[0][1].value).toBe('B')
  })

  it('should convert table with merged cells to JSON with metadata', () => {
    const html = '<table><tr><td colspan="2">A</td><td>B</td></tr><tr><td rowspan="2">C</td><td>D</td><td>E</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToJson(tableData)
    const parsed = JSON.parse(result)
    expect(parsed[0][0].colspan).toBe(2)
    expect(parsed[1][0].rowspan).toBe(2)
  })
})

describe('convertToSheets', () => {
  it('should convert table data to TSV', () => {
    const data = [['A', 'B'], ['C', 'D']]
    const result = convertToSheets(data)
    expect(result).toBe('A\tB\r\nC\tD')
  })

  it('should convert table with merged cells to TSV with empty cells', () => {
    const html = '<table><tr><td colspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr></table>'
    const tableData = parseHtmlTable(html)
    const result = convertToSheets(tableData)
    // TSV doesn't support merged cells, so colspan areas should have empty cells
    expect(result).toContain('A')
    expect(result).toContain('\t') // Should have tabs for empty cells
  })
})
