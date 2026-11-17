import { useMemo, useState } from 'react'
import { supabase, check } from '../lib/supabase'
import { fetchAll, useLoad, useLookups } from '../lib/data'
import { useRole } from '../lib/auth'
import { dmy, rs, today } from '../lib/format'
import { downloadXlsx } from '../lib/csv'
import type { Payment, Profile, Student } from '../lib/types'
import { CampusSelect, Err } from '../components/CampusSelect'
import { Receipt, type ReceiptLine } from '../components/Receipt'

type Row = Payment & { students: Student }

export default function Payments() {
  const lk = useLookups()
  const role = useRole()
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [campus, setCampus] = useState('')
  const [showVoid, setShowVoid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ p: Row; lines: ReceiptLine[] } | null>(null)

  const list = useLoad(() => fetchAll<Row>((a, b) => supabase.from('payments').select('*, students(*)')
    .gte('paid_on', from).lte('paid_on', to).order('id').range(a, b)), [from, to])
  const staff = useLoad(async () => (await supabase.from('profiles').select('*')).data as Profile[] ?? [])

  const rows = useMemo(() => (list.data ?? []).filter(p =>
    (!campus || p.students.campus_id === Number(campus)) && (showVoid || !p.voided)), [list.data, campus, showVoid])
  const live = rows.filter(r => !r.voided)
  const sum = (k: 'fees_total' | 'fine_total' | 'total') => live.reduce((s, r) => s + r[k], 0)
  const who = (id: string | null) => { const p = staff.data?.find(s => s.id === id); return p ? (p.full_name || p.email || '') : '' }
  const classMap = new Map(lk.data?.classes.map(c => [c.id, c]))
  const campusMap = new Map(lk.data?.campuses.map(c => [c.id, c]))

  const byCollector = useMemo(() => {
    const m = new Map<string, number>()
    live.forEach(r => m.set(who(r.collected_by) || 'Unknown', (m.get(who(r.collected_by) || 'Unknown') ?? 0) + r.total))
    return [...m]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, staff.data])

  const voidIt = async (p: Row) => {
    const reason = prompt(`Void receipt R-${String(p.id).padStart(6, '0')} (${rs(p.total)})? The fees become unpaid again. Reason:`)
    if (!reason) return
    try { check(await supabase.rpc('void_payment', { p_payment_id: p.id, p_reason: reason })); list.reload() }
    catch (e) { setError((e as Error).message) }
  }

  const showReceipt = async (p: Row) => {
    const lines = check(await supabase.from('dues').select('month, description, amount, fine_charged')
      .eq('payment_id', p.id).order('month')) as ReceiptLine[]
    setReceipt({ p, lines })
  }

  if (receipt && lk.data) return (
    <>
      <div className="row no-print">
        <button onClick={() => setReceipt(null)}>← Back</button>
        <button className="primary" onClick={() => window.print()}>Print receipt</button>
      </div>
      {receipt.p.voided && <p className="muted no-print">This receipt was voided; its month lines are no longer linked.</p>}
      <Receipt p={receipt.p} lines={receipt.lines} student={receipt.p.students} settings={lk.data.settings}
        campus={campusMap.get(receipt.p.students.campus_id)} cls={classMap.get(receipt.p.students.class_id)} by={who(receipt.p.collected_by)} />
    </>
  )

  return (
    <>
      <h1>Payments report</h1>
      <div className="row no-print">
        <label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        {lk.data && <CampusSelect campuses={lk.data.campuses} value={campus} onChange={setCampus} />}
        <label style={{ flexDirection: 'row', alignItems: 'center' }}>
          <input type="checkbox" checked={showVoid} onChange={e => setShowVoid(e.target.checked)} /> Show voided
        </label>
        <button onClick={() => window.print()}>Print</button>
        <button disabled={!rows.length} onClick={() => downloadXlsx(`payments-${from}-to-${to}.xlsx`, rows.map(r => ({
          Receipt: 'R-' + String(r.id).padStart(6, '0'), Date: r.paid_on, 'Adm No': r.students.admission_no,
          Student: r.students.name, Class: classMap.get(r.students.class_id)?.name, Campus: campusMap.get(r.students.campus_id)?.name,
          Fees: r.fees_total, Fine: r.fine_total, Total: r.total, 'Received by': who(r.collected_by), Voided: r.voided ? 'yes' : '' })))}>
          Export to Excel</button>
      </div>
      <Err error={error || list.error || lk.error} />
      <div className="stats">
        <div className="stat"><div className="label">Receipts</div><div className="value">{live.length}</div></div>
        <div className="stat"><div className="label">Fees</div><div className="value">{rs(sum('fees_total'))}</div></div>
        <div className="stat"><div className="label">Fines</div><div className="value">{rs(sum('fine_total'))}</div></div>
        <div className="stat"><div className="label">Total collected</div><div className="value">{rs(sum('total'))}</div></div>
      </div>
      {byCollector.length > 0 && <p>By staff: {byCollector.map(([n, t]) => `${n}: ${rs(t)}`).join(' · ')}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Receipt</th><th>Date</th><th>Adm No</th><th>Student</th><th>Class</th><th>Campus</th>
            <th className="num">Fees</th><th className="num">Fine</th><th className="num">Total</th><th>By</th><th className="no-print"></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} style={r.voided ? { textDecoration: 'line-through', color: '#999' } : undefined}>
              <td>R-{String(r.id).padStart(6, '0')}</td><td>{dmy(r.paid_on)}</td><td>{r.students.admission_no}</td>
              <td>{r.students.name}</td><td>{classMap.get(r.students.class_id)?.name}</td><td>{campusMap.get(r.students.campus_id)?.name}</td>
              <td className="num">{r.fees_total.toLocaleString()}</td><td className="num">{r.fine_total.toLocaleString()}</td>
              <td className="num"><b>{r.total.toLocaleString()}</b></td><td>{who(r.collected_by)}</td>
              <td className="no-print">
                <a href="#" onClick={e => { e.preventDefault(); showReceipt(r) }}>Receipt</a>
                {role === 'owner' && !r.voided && <> · <a href="#" onClick={e => { e.preventDefault(); voidIt(r) }}>Void</a></>}
              </td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </>
  )
}
