import Papa from 'papaparse'
import { table as markdownTable } from 'markdown-table'
import jsonToLatexTable from 'json-to-latex-table'

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
  return jsonToLatexTable(tableData)
}

export const convertToJson = (tableData: string[][]): string => {
  return JSON.stringify(tableData, null, 2)
}

export const convertToSheets = (tableData: string[][]): string => {
  return Papa.unparse(tableData, { delimiter: '\t' })
}