import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, check } from '../lib/supabase'
import { useLoad, useLookups } from '../lib/data'
import { dmy, rs, today } from '../lib/format'
import { downloadXlsx } from '../lib/csv'
import { CampusSelect, Err } from '../components/CampusSelect'

interface Def { student_id: number; admission_no: string; name: string; father_name: string; phone: string
  campus_id: number; class_id: number; months: number; fees: number; fine: number; total: number }

export default function Defaulters() {
  const lk = useLookups()
  const [campus, setCampus] = useState('')
  const [cls, setCls] = useState('')
  const [asOf, setAsOf] = useState(today())
  const list = useLoad(async () => check(await supabase.rpc('defaulters',
    { p_campus_id: campus ? Number(campus) : null, p_as_of: asOf })) as Def[], [campus, asOf])

  const rows = useMemo(() => (list.data ?? []).filter(r => !cls || r.class_id === Number(cls)), [list.data, cls])
  const classMap = new Map(lk.data?.classes.map(c => [c.id, c.name]))
  const campusMap = new Map(lk.data?.campuses.map(c => [c.id, c.name]))
  const sum = (k: 'fees' | 'fine' | 'total') => rows.reduce((s, r) => s + r[k], 0)

  const exportXlsx = () => downloadXlsx(`defaulters-${asOf}.xlsx`, rows.map(r => ({
    'Adm No': r.admission_no, Student: r.name, Father: r.father_name, Phone: r.phone,
    Class: classMap.get(r.class_id), Campus: campusMap.get(r.campus_id), 'Unpaid months': r.months,
    Fees: r.fees, Fine: r.fine, Total: r.total })))

  return (
    <>
      <h1>Defaulters</h1>
      <div className="row no-print">
        {lk.data && <CampusSelect campuses={lk.data.campuses} value={campus} onChange={setCampus} />}
        <label>Class
          <select value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">All classes</option>
            {lk.data?.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>As of<input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} /></label>
        <button onClick={() => window.print()}>Print</button>
        <button onClick={exportXlsx} disabled={!rows.length}>Export to Excel</button>
      </div>
      <p>Students with fees unpaid after the due date, as of {dmy(asOf)}: <b>{rows.length}</b> · Total <b>{rs(sum('total'))}</b></p>
      <Err error={list.error || lk.error} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Adm No</th><th>Student</th><th>Father</th><th>Phone</th><th>Class</th><th>Campus</th>
            <th className="num">Months</th><th className="num">Fees</th><th className="num">Fine</th><th className="num">Total</th><th className="no-print"></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.student_id}>
                <td>{r.admission_no}</td><td>{r.name}</td><td>{r.father_name}</td><td>{r.phone}</td>
                <td>{classMap.get(r.class_id)}</td><td>{campusMap.get(r.campus_id)}</td>
                <td className="num">{r.months}</td><td className="num">{r.fees.toLocaleString()}</td>
                <td className="num">{r.fine.toLocaleString()}</td><td className="num"><b>{r.total.toLocaleString()}</b></td>
                <td className="no-print"><Link to={`/collect/${r.student_id}`}>Collect</Link></td>
              </tr>
            ))}
            <tr><th colSpan={7}>Total</th><th className="num">{sum('fees').toLocaleString()}</th>
              <th className="num">{sum('fine').toLocaleString()}</th><th className="num">{sum('total').toLocaleString()}</th><th className="no-print"></th></tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
