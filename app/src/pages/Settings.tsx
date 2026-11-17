import { useEffect, useState } from 'react'
import { supabase, check } from '../lib/supabase'
import { useLoad, useLookups } from '../lib/data'
import { useAuth } from '../lib/auth'
import type { Campus, Profile, Settings } from '../lib/types'
import { Err } from '../components/CampusSelect'

export default function SettingsPage() {
  const lk = useLookups()
  const { profile: me } = useAuth()
  const users = useLoad(async () => check(await supabase.from('profiles').select('*').order('created_at')) as Profile[])
  const [s, setS] = useState<Settings | null>(null)
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (lk.data) { setS(lk.data.settings); setCampuses(lk.data.campuses) } }, [lk.data])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null); setMsg(null)
    try { await fn(); setMsg(ok); lk.reload(); users.reload() } catch (e) { setError((e as Error).message) }
  }

  const saveSettings = () => run(async () => {
    const { id, ...rest } = s!
    check(await supabase.from('settings').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id))
  }, 'Settings saved. Fine changes apply to all unpaid fees from now on.')

  const saveCampuses = () => run(async () => { check(await supabase.from('campuses').upsert(campuses)) }, 'Campuses saved.')

  const setUser = (u: Profile, patch: Partial<Profile>) => run(async () => {
    check(await supabase.from('profiles').update(patch).eq('id', u.id))
  }, 'User updated.')

  return (
    <>
      <h1>Settings</h1>
      <Err error={error || lk.error || users.error} />
      {msg && <div className="msg ok">{msg}</div>}

      {s && (
        <div className="card" style={{ maxWidth: 720 }}>
          <h2 style={{ marginTop: 0 }}>School &amp; fee rules</h2>
          <div className="row">
            <label>School name<input value={s.school_name} onChange={e => setS({ ...s, school_name: e.target.value })} /></label>
            <label>Due day of month<input type="number" min={1} max={28} value={s.due_day} onChange={e => setS({ ...s, due_day: Number(e.target.value) })} /></label>
          </div>
          <div className="row">
            <label>Late fine per day (Rs)<input type="number" min={0} value={s.fine_per_day} onChange={e => setS({ ...s, fine_per_day: Number(e.target.value) })} /></label>
            <label>Maximum fine per month (Rs)<input type="number" min={0} value={s.max_fine} onChange={e => setS({ ...s, max_fine: Number(e.target.value) })} /></label>
          </div>
          <label>Notice printed on challans<textarea rows={2} value={s.voucher_notice} onChange={e => setS({ ...s, voucher_notice: e.target.value })} /></label>
          <div style={{ marginTop: 12 }}><button className="primary" onClick={saveSettings}>Save</button></div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 720 }}>
        <h2 style={{ marginTop: 0 }}>Campuses (printed on challans)</h2>
        {campuses.map((c, i) => (
          <div className="row" key={c.id}>
            {(['name', 'address', 'phone'] as const).map(k => (
              <label key={k}>{k[0].toUpperCase() + k.slice(1)}
                <input value={c[k]} onChange={e => setCampuses(campuses.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} /></label>
            ))}
          </div>
        ))}
        <button className="primary" onClick={saveCampuses}>Save campuses</button>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h2 style={{ marginTop: 0 }}>Users</h2>
        <p className="muted">To add a user: in Supabase open Authentication → Users → Add user (email + password). They then appear here as
          "pending" — give them a role.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Email</th><th>Name</th><th>Role</th></tr></thead>
            <tbody>{users.data?.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td><input defaultValue={u.full_name} onBlur={e => e.target.value !== u.full_name && setUser(u, { full_name: e.target.value })} /></td>
                <td>
                  <select value={u.role} disabled={u.id === me?.id} onChange={e => setUser(u, { role: e.target.value as Profile['role'] })}>
                    <option value="owner">Owner</option><option value="principal">Principal</option>
                    <option value="accountant">Accountant</option><option value="pending">No access</option>
                  </select>
                </td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
