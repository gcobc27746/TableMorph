import { describe, it, expect } from 'vitest'
import { parseHtmlTable, convertToMarkdown, convertToLatex, convertToJson, convertToSheets } from './utils'

describe('parseHtmlTable', () => {
  it('should parse simple HTML table', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>'
    const result = parseHtmlTable(html)
    expect(result).toEqual([['A', 'B'], ['C', 'D']])
  })
})

describe('convertToMarkdown', () => {
  it('should convert table data to Markdown', () => {
    const data = [['A', 'B'], ['C', 'D']]
    const result = convertToMarkdown(data)
    expect(result).toContain('| A | B |')
  })
})

describe('convertToLatex', () => {
  it('should convert table data to LaTeX', () => {
    const data = [['A', 'B'], ['C', 'D']]
    const result = convertToLatex(data)
    expect(result).toContain('\\begin{tabular}')
  })
})

describe('convertToJson', () => {
  it('should convert table data to JSON', () => {
    const data = [['A', 'B'], ['C', 'D']]
    const result = convertToJson(data)
    expect(JSON.parse(result)).toEqual(data)
  })
})

describe('convertToSheets', () => {
  it('should convert table data to TSV', () => {
    const data = [['A', 'B'], ['C', 'D']]
    const result = convertToSheets(data)
    expect(result).toBe('A\tB\nC\tD\n')
  })
})