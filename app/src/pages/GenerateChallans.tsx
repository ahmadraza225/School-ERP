import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, check } from '../lib/supabase'
import { useLookups } from '../lib/data'
import { monthLabel, thisMonth } from '../lib/format'
import { CampusSelect, Err } from '../components/CampusSelect'

export default function GenerateChallans() {
  const lk = useLookups()
  const [month, setMonth] = useState(thisMonth().slice(0, 7))
  const [campus, setCampus] = useState('')
  const [due, setDue] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const dueDay = lk.data?.settings.due_day ?? 10
  const defaultDue = `${month}-${String(dueDay).padStart(2, '0')}`
  const m = month + '-01'

  const run = async () => {
    if (!confirm(`Generate ${monthLabel(m)} challans for ${campus ? lk.data?.campuses.find(c => c.id === Number(campus))?.name : 'both campuses'}?`)) return
    setBusy(true); setError(null); setMsg(null)
    try {
      const n = check(await supabase.rpc('generate_challans', {
        p_month: m, p_campus_id: campus ? Number(campus) : null, p_due_date: due || defaultDue,
      })) as number
      setMsg(`${n} new challans created for ${monthLabel(m)}.` + (n === 0 ? ' (All students already had a challan for this month.)' : ''))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <h1>Generate monthly challans</h1>
      <div className="card" style={{ maxWidth: 680 }}>
        <p>Creates this month's tuition fee for every <b>active</b> student and a challan that also lists any
          unpaid previous months and their late fine. Students who already have a challan for the month are skipped,
          so it is safe to run again after adding new students.</p>
        <div className="row">
          <label>Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
          {lk.data && <CampusSelect campuses={lk.data.campuses} value={campus} onChange={setCampus} />}
          <label>Due date<input type="date" value={due || defaultDue} onChange={e => setDue(e.target.value)} /></label>
        </div>
        <Err error={error || lk.error} />
        {msg && <div className="msg ok">{msg} <Link to={`/challans?month=${m}`}>Print challans →</Link></div>}
        <button className="primary" disabled={busy || !lk.data} onClick={run}>{busy ? 'Generating…' : 'Generate challans'}</button>
      </div>
    </>
  )
}
