import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase, check } from '../lib/supabase'
import { useLookups } from '../lib/data'
import { Err } from '../components/CampusSelect'

// Accepted column names (case/spacing ignored) for each field.
const COLS: Record<string, string[]> = {
  admission_no: ['admissionno', 'admno', 'admission', 'admissionnumber', 'rollno'],
  name: ['studentname', 'name', 'student'],
  father_name: ['fathername', 'father', 'parentname', 'guardian'],
  phone: ['phone', 'mobile', 'contact', 'fatherphone', 'phoneno'],
  cnic: ['cnic', 'fathercnic'],
  campus: ['campus', 'branch'],
  class: ['class', 'grade'],
  monthly_fee_override: ['monthlyfee', 'specialfee', 'fee'],
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

interface Parsed { row: number; data: Record<string, unknown> | null; problem: string }

export default function ImportStudents() {
  const lk = useLookups()
  const [parsed, setParsed] = useState<Parsed[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const findCampus = (v: string) => {
    const n = norm(v)
    return lk.data?.campuses.find(c => norm(c.name) === n
      || (n.includes('boy') && norm(c.name).includes('boy'))
      || (n.includes('girl') && norm(c.name).includes('girl')))
  }
  const findClass = (v: string) => {
    const n = norm(v)
    if (!n) return undefined
    return lk.data?.classes.find(c => {
      const inside = (c.name.match(/\((.*)\)/)?.[1] ?? '')
      const names = [norm(c.name), norm(c.name.replace(/\(.*\)/, '')), norm(inside), norm(inside).replace(/th$/, '')]
      return names.includes(n) || names.includes('class' + n) || norm(c.name) === 'class' + n
    })
  }

  const onFile = async (file: File) => {
    setMsg(null); setError(null)
    const wb = XLSX.read(await file.arrayBuffer())
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    const out: Parsed[] = raw.map((r, i) => {
      const get = (field: string) => {
        const key = Object.keys(r).find(k => COLS[field].includes(norm(k)))
        return key ? String(r[key]).trim() : ''
      }
      const campus = findCampus(get('campus'))
      const cls = findClass(get('class'))
      const fee = get('monthly_fee_override')
      const problems = [
        !get('admission_no') && 'missing admission no',
        !get('name') && 'missing name',
        !campus && `unknown campus "${get('campus')}"`,
        !cls && `unknown class "${get('class')}"`,
        fee && isNaN(Number(fee)) && `fee "${fee}" is not a number`,
      ].filter(Boolean).join(', ')
      return {
        row: i + 2, problem: problems,
        data: problems ? null : {
          admission_no: get('admission_no'), name: get('name'), father_name: get('father_name'),
          phone: get('phone'), cnic: get('cnic'), campus_id: campus!.id, class_id: cls!.id,
          monthly_fee_override: fee ? Number(fee) : null,
        },
      }
    })
    setParsed(out)
  }

  const good = parsed.filter(p => p.data)
  const bad = parsed.filter(p => !p.data)

  const doImport = async () => {
    setBusy(true); setError(null)
    try {
      for (let i = 0; i < good.length; i += 500) {
        check(await supabase.from('students')
          .upsert(good.slice(i, i + 500).map(p => p.data!), { onConflict: 'admission_no' }))
      }
      setMsg(`${good.length} students imported. Existing admission numbers were updated.`)
      setParsed([])
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <h1>Import students</h1>
      <div className="card">
        <p>Upload an Excel (.xlsx) or CSV file. The first row must be headings. Columns used:</p>
        <p><b>Admission No</b>, <b>Student Name</b>, Father Name, Phone, Father CNIC, <b>Campus</b> (Boys / Girls), <b>Class</b> (e.g. Nursery, 5, Class 5, First Year), Monthly Fee (only if different from class fee).</p>
        <p className="muted">Bold columns are required. Re-importing a file updates students with the same admission number.</p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      <Err error={error || lk.error} />
      {msg && <div className="msg ok">{msg}</div>}
      {parsed.length > 0 && (
        <div className="card">
          <p><b>{good.length}</b> rows ready, <b>{bad.length}</b> rows with problems (they will be skipped).</p>
          {bad.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table><thead><tr><th>Row</th><th>Problem</th></tr></thead>
                <tbody>{bad.map(b => <tr key={b.row}><td>{b.row}</td><td>{b.problem}</td></tr>)}</tbody></table>
            </div>
          )}
          <button className="primary" disabled={!good.length || busy} onClick={doImport}>
            {busy ? 'Importing…' : `Import ${good.length} students`}
          </button>
        </div>
      )}
    </>
  )
}
