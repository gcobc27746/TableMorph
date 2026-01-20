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