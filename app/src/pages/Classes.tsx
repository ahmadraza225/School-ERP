import { useEffect, useState } from 'react'
import { supabase, check } from '../lib/supabase'
import { useLookups } from '../lib/data'
import type { ClassRow } from '../lib/types'
import { Err } from '../components/CampusSelect'

export default function Classes() {
  const lk = useLookups()
  const [rows, setRows] = useState<ClassRow[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (lk.data) setRows(lk.data.classes) }, [lk.data])

  const upd = (i: number, k: keyof ClassRow, v: string) =>
    setRows(rows.map((r, j) => j === i ? { ...r, [k]: k === 'name' ? v : Number(v) } : r))

  const save = async () => {
    setBusy(true); setError(null); setMsg(null)
    try {
      const existing = rows.filter(r => r.id > 0)
      const added = rows.filter(r => r.id <= 0 && r.name.trim()).map(({ name, sort_order, monthly_fee }) => ({ name, sort_order, monthly_fee }))
      if (existing.length) check(await supabase.from('classes').upsert(existing))
      if (added.length) check(await supabase.from('classes').insert(added))
      setMsg('Saved. New fees apply to challans generated from now on; challans already generated keep their old amount.')
      lk.reload()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <h1>Classes &amp; monthly fees</h1>
      <p className="muted">The monthly fee is the same for both campuses. A student can also have a special fee on their own page.</p>
      <Err error={error || lk.error} />
      {msg && <div className="msg ok">{msg}</div>}
      <div className="table-wrap" style={{ maxWidth: 620 }}>
        <table>
          <thead><tr><th>Order</th><th>Class</th><th className="num">Monthly fee (Rs)</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.id || 'new' + i}>
              <td><input type="number" style={{ width: 70 }} value={r.sort_order} onChange={e => upd(i, 'sort_order', e.target.value)} /></td>
              <td><input value={r.name} onChange={e => upd(i, 'name', e.target.value)} /></td>
              <td className="num"><input type="number" min={0} style={{ width: 120, textAlign: 'right' }} value={r.monthly_fee} onChange={e => upd(i, 'monthly_fee', e.target.value)} /></td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => setRows([...rows, { id: -rows.length, name: '', sort_order: rows.length + 1, monthly_fee: 0 }])}>+ Add class</button>
        <button className="primary" disabled={busy} onClick={save}>Save changes</button>
      </div>
    </>
  )
}
