import { useState } from 'react'
import { supabase, check } from '../lib/supabase'
import { fetchAll, useLoad, useLookups } from '../lib/data'
import { rs, today, thisMonth, monthLabel } from '../lib/format'
import { CampusSelect, Err } from '../components/CampusSelect'

interface PayRow { total: number; paid_on: string; students: { campus_id: number } }

export default function Dashboard() {
  const lk = useLookups()
  const [campus, setCampus] = useState('')

  const stats = useLoad(async () => {
    const month = thisMonth()
    const pays = await fetchAll<PayRow>((a, b) => supabase.from('payments')
      .select('total, paid_on, students!inner(campus_id)').eq('voided', false)
      .gte('paid_on', month).range(a, b))
    const def = check(await supabase.rpc('defaulters', { p_campus_id: campus ? Number(campus) : null })) as { total: number }[]
    const studentsQ = supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active')
    const { count } = campus ? await studentsQ.eq('campus_id', Number(campus)) : await studentsQ
    const mine = pays.filter(p => !campus || p.students.campus_id === Number(campus))
    const t = today()
    return {
      todayTotal: mine.filter(p => p.paid_on === t).reduce((s, p) => s + p.total, 0),
      todayCount: mine.filter(p => p.paid_on === t).length,
      monthTotal: mine.reduce((s, p) => s + p.total, 0),
      defCount: def.length,
      defTotal: def.reduce((s, d) => s + d.total, 0),
      students: count ?? 0,
    }
  }, [campus])

  const s = stats.data
  return (
    <>
      <h1>Dashboard</h1>
      <div className="row">
        {lk.data && <CampusSelect campuses={lk.data.campuses} value={campus} onChange={setCampus} />}
      </div>
      <Err error={stats.error || lk.error} />
      {s && (
        <div className="stats">
          <div className="stat"><div className="label">Collected today ({s.todayCount} receipts)</div><div className="value">{rs(s.todayTotal)}</div></div>
          <div className="stat"><div className="label">Collected in {monthLabel(thisMonth())}</div><div className="value">{rs(s.monthTotal)}</div></div>
          <div className="stat"><div className="label">Defaulters</div><div className="value">{s.defCount}</div></div>
          <div className="stat"><div className="label">Outstanding (with fines)</div><div className="value">{rs(s.defTotal)}</div></div>
          <div className="stat"><div className="label">Active students</div><div className="value">{s.students}</div></div>
        </div>
      )}
      {stats.loading && <p className="muted">Loading…</p>}
    </>
  )
}
