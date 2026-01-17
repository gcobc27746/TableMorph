import React, { useState } from 'react'
import './App.css'
import Papa from 'papaparse'
import { parseHtmlTable, convertToMarkdown, convertToLatex, convertToJson, convertToSheets } from './utils'

function App() {
  const [status, setStatus] = useState('')

  const convertToFormat = async (format: string) => {
    try {
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

      let tableData: string[][] = []

      if (isHtml) {
        tableData = parseHtmlTable(data)
      } else {
        // Assume TSV or CSV
        const parsed = Papa.parse(data, { skipEmptyLines: true })
        tableData = parsed.data as string[][]
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

      // Write back to clipboard
      await navigator.clipboard.writeText(result)
      setStatus('Copied!')
    } catch (error) {
      setStatus('Error: ' + (error as Error).message)
    }
  }

  return (
    <div className="App">
      <h1>TableMorph</h1>
      <button onClick={() => convertToFormat('markdown')}>Markdown</button>
      <button onClick={() => convertToFormat('latex')}>LaTeX</button>
      <button onClick={() => convertToFormat('sheets')}>Sheets</button>
      <button onClick={() => convertToFormat('json')}>JSON</button>
      <p>{status}</p>
    </div>
  )
}

export default App