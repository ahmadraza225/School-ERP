import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, check } from '../lib/supabase'
import { useLookups } from '../lib/data'
import type { Student } from '../lib/types'
import { Err } from '../components/CampusSelect'

const EMPTY = { admission_no: '', name: '', father_name: '', phone: '', cnic: '', campus_id: '', class_id: '',
  monthly_fee_override: '', status: 'active', notes: '' }

export default function StudentForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const lk = useLookups()
  const [f, setF] = useState<Record<string, string>>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('students').select('*').eq('id', id).single().then(res => {
      if (res.error) return setError(res.error.message)
      const s = res.data as Student
      setF({ ...s, campus_id: String(s.campus_id), class_id: String(s.class_id),
        monthly_fee_override: s.monthly_fee_override == null ? '' : String(s.monthly_fee_override) } as unknown as Record<string, string>)
    })
  }, [id])

  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    const row = {
      admission_no: f.admission_no.trim(), name: f.name.trim(), father_name: f.father_name.trim(),
      phone: f.phone.trim(), cnic: f.cnic.trim(), campus_id: Number(f.campus_id), class_id: Number(f.class_id),
      monthly_fee_override: f.monthly_fee_override === '' ? null : Number(f.monthly_fee_override),
      status: f.status, notes: f.notes,
    }
    try {
      if (id) check(await supabase.from('students').update(row).eq('id', id))
      else check(await supabase.from('students').insert(row))
      nav('/students')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <h1>{id ? 'Edit student' : 'Add student'}</h1>
      <Err error={error || lk.error} />
      <form className="card" onSubmit={save} style={{ maxWidth: 640 }}>
        <div className="row">
          <label>Admission No *<input value={f.admission_no} onChange={set('admission_no')} required /></label>
          <label>Student name *<input value={f.name} onChange={set('name')} required /></label>
        </div>
        <div className="row">
          <label>Father name<input value={f.father_name} onChange={set('father_name')} /></label>
          <label>Phone<input value={f.phone} onChange={set('phone')} /></label>
          <label>Father CNIC<input value={f.cnic} onChange={set('cnic')} /></label>
        </div>
        <div className="row">
          <label>Campus *
            <select value={f.campus_id} onChange={set('campus_id')} required>
              <option value="">Select…</option>
              {lk.data?.campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Class *
            <select value={f.class_id} onChange={set('class_id')} required>
              <option value="">Select…</option>
              {lk.data?.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="row">
          <label>Special monthly fee (leave empty to use class fee)
            <input type="number" min={0} value={f.monthly_fee_override} onChange={set('monthly_fee_override')} />
          </label>
          <label>Status
            <select value={f.status} onChange={set('status')}>
              <option value="active">Active</option><option value="left">Left school</option>
            </select>
          </label>
        </div>
        <label>Notes<textarea rows={2} value={f.notes} onChange={set('notes')} /></label>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={busy}>Save</button>
          <button type="button" onClick={() => nav('/students')}>Cancel</button>
        </div>
      </form>
    </>
  )
}
