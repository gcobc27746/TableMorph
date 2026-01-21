import Papa from 'papaparse'
import { markdownTable } from 'markdown-table'

export const parseHtmlTable = (html: string): string[][] => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return []

  const rows = Array.from(table.rows)
  return rows.map(row => Array.from(row.cells).map(cell => cell.textContent || ''))
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

export const parseLatexTable = (text: string): string[][] | null => {
  if (!text.includes('\\begin{tabular}')) return null

  const tabularMatch = text.match(/\\begin\{tabular\}[\s\S]*?\\end\{tabular\}/)
  const tabularBody = tabularMatch ? tabularMatch[0] : text

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

  const parsed = rows.map(row => row.split('&').map(cell => cell.trim()))
  return parsed.length ? parsed : null
}

export const convertToMarkdown = (tableData: string[][]): string => {
  return markdownTable(tableData)
}

export const convertToLatex = (tableData: string[][]): string => {
  if (tableData.length === 0) return ''

  const columnCount = Math.max(...tableData.map(row => row.length))
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

  const rows = tableData.map(row => {
    const padded = Array.from({ length: columnCount }, (_, index) => row[index] ?? '')
    return `${padded.map(cell => escapeLatex(cell)).join(' & ')} \\\\`
  })

  return [`\\begin{tabular}{${columnSpec}}`, ...rows, '\\end{tabular}'].join('\n')
}

export const convertToJson = (tableData: string[][]): string => {
  return JSON.stringify(tableData, null, 2)
}

export const convertToSheets = (tableData: string[][]): string => {
  return Papa.unparse(tableData, { delimiter: '\t' })
}