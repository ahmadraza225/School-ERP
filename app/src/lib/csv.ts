import * as XLSX from 'xlsx'

/** Download rows as an Excel file. */
export function downloadXlsx(name: string, rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sheet1')
  XLSX.writeFile(wb, name)
}
