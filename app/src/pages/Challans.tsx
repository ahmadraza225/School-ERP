import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAll, useLoad, useLookups } from '../lib/data'
import { dmy, monthLabel, thisMonth } from '../lib/format'
import { loadVouchers } from '../lib/vouchers'
import type { Challan, Student } from '../lib/types'
import { CampusSelect, Err } from '../components/CampusSelect'
import { ChallanVoucher, type VoucherData } from '../components/ChallanVoucher'

type Row = Challan & { students: Pick<Student, 'name' | 'admission_no' | 'father_name' | 'campus_id' | 'class_id'> }

export default function Challans() {
  const [params] = useSearchParams()
  const lk = useLookups()
  const [month, setMonth] = useState((params.get('month') ?? thisMonth()).slice(0, 7))
  const [campus, setCampus] = useState('')
  const [cls, setCls] = useState('')
  const [q, setQ] = useState('')
  const [vouchers, setVouchers] = useState<VoucherData[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = useLoad(() => fetchAll<Row>((a, b) => supabase.from('challans')
    .select('*, students(name, admission_no, father_name, campus_id, class_id)')
    .eq('month', month + '-01').order('challan_no').range(a, b)), [month])

  const rows = useMemo(() => (list.data ?? []).filter(r =>
    (!campus || r.students.campus_id === Number(campus)) &&
    (!cls || r.students.class_id === Number(cls)) &&
    (!q || `${r.challan_no} ${r.students.name} ${r.students.admission_no}`.toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => a.students.class_id - b.students.class_id || a.students.name.localeCompare(b.students.name)),
  [list.data, campus, cls, q])

  const print = async (which: Row[]) => {
    setBusy(true); setError(null)
    try {
      setVouchers(await loadVouchers(which))
      setTimeout(() => window.print(), 300)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const classMap = new Map(lk.data?.classes.map(c => [c.id, c]))
  const campusMap = new Map(lk.data?.campuses.map(c => [c.id, c]))

  if (vouchers && lk.data) return (
    <>
      <div className="row no-print">
        <button onClick={() => setVouchers(null)}>← Back</button>
        <button className="primary" onClick={() => window.print()}>Print {vouchers.length} challans</button>
        <span className="muted">Paper: A4 landscape, 2 copies per page (school + parent).</span>
      </div>
      {vouchers.map(v => (
        <ChallanVoucher key={v.challan.id} v={v} settings={lk.data!.settings}
          campus={campusMap.get(v.student.campus_id)} cls={classMap.get(v.student.class_id)} />
      ))}
    </>
  )

  return (
    <>
      <h1>Challans</h1>
      <Err error={error || list.error || lk.error} />
      <div className="row">
        <label>Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
        {lk.data && <CampusSelect campuses={lk.data.campuses} value={campus} onChange={setCampus} />}
        <label>Class
          <select value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">All classes</option>
            {lk.data?.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Search<input value={q} onChange={e => setQ(e.target.value)} placeholder="Challan no, name, adm no" /></label>
        <button className="primary" disabled={!rows.length || busy} onClick={() => print(rows)}>
          {busy ? 'Preparing…' : `Print all ${rows.length}`}
        </button>
      </div>
      {!list.loading && !list.data?.length && (
        <p className="muted">No challans for {monthLabel(month + '-01')} yet. <Link to="/generate">Generate them →</Link></p>
      )}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Challan No</th><th>Adm No</th><th>Student</th><th>Father</th><th>Class</th><th>Campus</th><th>Due</th><th></th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id}>
                <td>{r.challan_no}</td><td>{r.students.admission_no}</td><td>{r.students.name}</td>
                <td>{r.students.father_name}</td><td>{classMap.get(r.students.class_id)?.name}</td>
                <td>{campusMap.get(r.students.campus_id)?.name}</td><td>{dmy(r.due_date)}</td>
                <td><a href="#" onClick={e => { e.preventDefault(); print([r]) }}>Print</a> · <Link to={`/collect/${r.student_id}`}>Collect</Link></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  )
}
