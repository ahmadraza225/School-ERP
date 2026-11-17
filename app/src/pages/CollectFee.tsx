import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, check } from '../lib/supabase'
import { useLoad, useLookups } from '../lib/data'
import { useAuth, useRole } from '../lib/auth'
import { dmy, monthLabel, rs, today } from '../lib/format'
import type { Outstanding, Payment, Student } from '../lib/types'
import { Err } from '../components/CampusSelect'
import { Receipt, type ReceiptLine } from '../components/Receipt'

export default function CollectFee() {
  const { studentId } = useParams()
  const nav = useNavigate()
  const lk = useLookups()
  const role = useRole()
  const { profile } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [paidOn, setPaidOn] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<{ p: Payment; lines: ReceiptLine[] } | null>(null)

  useEffect(() => { setReceipt(null); setPaidOn(today()) }, [studentId])

  const student = useLoad(async () => studentId
    ? check(await supabase.from('students').select('*').eq('id', studentId).single()) as Student
    : null, [studentId])
  const dues = useLoad(async () => studentId
    ? check(await supabase.rpc('student_outstanding', { p_student_id: Number(studentId), p_as_of: paidOn })) as Outstanding[]
    : [], [studentId, paidOn])

  const search = async () => {
    setError(null)
    const term = q.trim().replace(/[,()%*]/g, ' ').trim()
    if (!term) return
    // A challan number looks like 2611-00042: the part after the dash is the student id.
    const ch = term.match(/^\d{4}-(\d+)$/)
    if (ch) return nav(`/collect/${Number(ch[1])}`)
    const res = await supabase.from('students').select('*')
      .or(`admission_no.eq.${term},name.ilike.%${term}%,father_name.ilike.%${term}%,phone.ilike.%${term}%`)
      .order('name').limit(30)
    if (res.error) return setError(res.error.message)
    const rows = res.data as Student[]
    if (rows.length === 1) { setResults([]); nav(`/collect/${rows[0].id}`) } else setResults(rows)
    if (!rows.length) setError('No student found')
  }

  const items = dues.data ?? []
  const fees = items.reduce((s, d) => s + d.amount, 0)
  const fine = items.reduce((s, d) => s + d.fine, 0)
  const s = student.data

  const collect = async () => {
    if (!s || !confirm(`Receive ${rs(fees + fine)} from ${s.name}?`)) return
    setBusy(true); setError(null)
    try {
      const pid = check(await supabase.rpc('collect_payment', { p_student_id: s.id, p_paid_on: paidOn })) as number
      const p = check(await supabase.from('payments').select('*').eq('id', pid).single()) as Payment
      const lines = check(await supabase.from('dues').select('month, description, amount, fine_charged')
        .eq('payment_id', pid).order('month')) as ReceiptLine[]
      setReceipt({ p, lines })
      dues.reload()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const waive = async (d: Outstanding) => {
    const amt = prompt(`Waive how much of the Rs ${d.fine} fine on ${monthLabel(d.month)}?`, String(d.fine))
    if (!amt) return
    const reason = prompt('Reason (optional)') ?? ''
    try {
      check(await supabase.rpc('waive_fine', { p_due_id: d.due_id, p_amount: Number(amt), p_reason: reason }))
      dues.reload()
    } catch (e) { setError((e as Error).message) }
  }

  const L = lk.data
  if (receipt && s && L) return (
    <>
      <div className="row no-print">
        <button onClick={() => { setReceipt(null); nav('/collect') }}>← Next student</button>
        <button className="primary" onClick={() => window.print()}>Print receipt</button>
      </div>
      <div className="msg ok no-print">Payment saved.</div>
      <Receipt p={receipt.p} lines={receipt.lines} student={s} settings={L.settings}
        campus={L.campuses.find(c => c.id === s.campus_id)} cls={L.classes.find(c => c.id === s.class_id)}
        by={profile?.full_name || profile?.email || ''} />
    </>
  )

  return (
    <>
      <h1>Collect fee</h1>
      <div className="row">
        <label>Find student<input value={q} onChange={e => setQ(e.target.value)} autoFocus
          onKeyDown={e => e.key === 'Enter' && search()} placeholder="Challan no, admission no, name or phone" style={{ width: 340 }} /></label>
        <button onClick={search}>Search</button>
      </div>
      <Err error={error || student.error || dues.error || lk.error} />
      {results.length > 1 && (
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table><tbody>{results.map(r => (
            <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { setResults([]); nav(`/collect/${r.id}`) }}>
              <td>{r.admission_no}</td><td><a href="#" onClick={e => e.preventDefault()}>{r.name}</a></td><td>{r.father_name}</td>
              <td>{L?.classes.find(c => c.id === r.class_id)?.name}</td><td>{L?.campuses.find(c => c.id === r.campus_id)?.name}</td>
            </tr>))}</tbody></table>
        </div>
      )}
      {s && L && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{s.name} <span className="muted">({s.admission_no})</span></h2>
          <p className="muted">Father: {s.father_name} · {L.classes.find(c => c.id === s.class_id)?.name} ·
            {' '}{L.campuses.find(c => c.id === s.campus_id)?.name}{s.status === 'left' && ' · LEFT SCHOOL'}</p>
          {role !== 'accountant' && (
            <div className="row"><label>Payment date<input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} /></label></div>
          )}
          {items.length === 0 ? <div className="msg ok">No dues. This student is fully paid.</div> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Month</th><th>Due date</th><th className="num">Fee</th><th className="num">Late fine</th><th></th></tr></thead>
                  <tbody>{items.map(d => (
                    <tr key={d.due_id}>
                      <td>{monthLabel(d.month)}</td><td>{dmy(d.due_date)}</td>
                      <td className="num">{d.amount.toLocaleString()}</td>
                      <td className="num">{d.fine.toLocaleString()}{d.fine_waived > 0 && <span className="muted"> (waived {d.fine_waived})</span>}</td>
                      <td>{role === 'owner' && d.fine > 0 && <a href="#" onClick={e => { e.preventDefault(); waive(d) }}>Waive fine</a>}</td>
                    </tr>))}
                    <tr><th>Total</th><th></th><th className="num">{rs(fees)}</th><th className="num">{rs(fine)}</th><th></th></tr>
                  </tbody>
                </table>
              </div>
              <p className="total-box">Amount to receive: {rs(fees + fine)}</p>
              <p className="muted">Full payment only. Fines are calculated as of {dmy(paidOn)}.</p>
              <button className="primary" disabled={busy} onClick={collect}>{busy ? 'Saving…' : `Receive ${rs(fees + fine)}`}</button>
            </>
          )}
        </div>
      )}
    </>
  )
}
