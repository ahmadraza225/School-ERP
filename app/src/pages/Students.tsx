import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAll, useLoad, useLookups } from '../lib/data'
import { rs } from '../lib/format'
import type { Student } from '../lib/types'
import { CampusSelect, Err } from '../components/CampusSelect'

export default function Students() {
  const lk = useLookups()
  const st = useLoad(() => fetchAll<Student>((a, b) =>
    supabase.from('students').select('*').order('admission_no').range(a, b)))
  const [campus, setCampus] = useState('')
  const [cls, setCls] = useState('')
  const [status, setStatus] = useState('active')
  const [q, setQ] = useState('')

  const rows = useMemo(() => (st.data ?? []).filter(s =>
    (!campus || s.campus_id === Number(campus)) &&
    (!cls || s.class_id === Number(cls)) &&
    (!status || s.status === status) &&
    (!q || `${s.admission_no} ${s.name} ${s.father_name} ${s.phone}`.toLowerCase().includes(q.toLowerCase()))
  ), [st.data, campus, cls, status, q])

  const classMap = new Map(lk.data?.classes.map(c => [c.id, c]))
  const campusMap = new Map(lk.data?.campuses.map(c => [c.id, c.name]))

  return (
    <>
      <h1>Students</h1>
      <div className="row">
        <Link to="/students/new"><button className="primary">+ Add student</button></Link>
        <Link to="/students/import"><button>Import from Excel / CSV</button></Link>
      </div>
      <Err error={st.error || lk.error} />
      <div className="row">
        <label>Search<input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, adm no, father, phone" /></label>
        {lk.data && <CampusSelect campuses={lk.data.campuses} value={campus} onChange={setCampus} />}
        <label>Class
          <select value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">All classes</option>
            {lk.data?.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Status
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="active">Active</option><option value="left">Left</option><option value="">All</option>
          </select>
        </label>
        <span className="muted">{rows.length} students</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Adm No</th><th>Name</th><th>Father</th><th>Phone</th><th>Class</th><th>Campus</th><th className="num">Monthly fee</th><th></th></tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id}>
                <td>{s.admission_no}</td>
                <td><Link to={`/students/${s.id}`}>{s.name}</Link>{s.status === 'left' && <> <span className="pill bad">Left</span></>}</td>
                <td>{s.father_name}</td><td>{s.phone}</td>
                <td>{classMap.get(s.class_id)?.name}</td>
                <td>{campusMap.get(s.campus_id)}</td>
                <td className="num">{rs(s.monthly_fee_override ?? classMap.get(s.class_id)?.monthly_fee)}{s.monthly_fee_override != null && ' *'}</td>
                <td><Link to={`/collect/${s.id}`}>Collect fee</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">* special fee set for this student</p>
    </>
  )
}
