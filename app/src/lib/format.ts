export const rs = (n: number | null | undefined) =>
  'Rs ' + (n ?? 0).toLocaleString('en-PK')

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** '2026-11-01' -> 'Nov 2026' */
export const monthLabel = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
/** '2026-11-10' -> '10/11/2026' */
export const dmy = (iso: string | null | undefined) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
/** Local date as YYYY-MM-DD. */
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const thisMonth = () => today().slice(0, 7) + '-01'
