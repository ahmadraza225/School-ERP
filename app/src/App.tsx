import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { configProblem, configured, supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import StudentForm from './pages/StudentForm'
import ImportStudents from './pages/ImportStudents'
import Classes from './pages/Classes'
import GenerateChallans from './pages/GenerateChallans'
import Challans from './pages/Challans'
import CollectFee from './pages/CollectFee'
import Defaulters from './pages/Defaulters'
import Payments from './pages/Payments'
import SettingsPage from './pages/Settings'

const ROLE_LABEL = { owner: 'Owner', principal: 'Principal', accountant: 'Accountant', pending: 'Pending' }

export default function App() {
  const { session, profile, loading } = useAuth()

  if (!configured) return (
    <div className="login card">
      <h1>Setup needed</h1>
      <p className="msg err">{configProblem}</p>
      <p>Fix it in Netlify: Project configuration → Environment variables, then Deploys → Trigger deploy.</p>
    </div>
  )
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>
  if (!session) return <Login />
  if (!profile || profile.role === 'pending') return (
    <div className="login card">
      <h1>Waiting for access</h1>
      <p>You are signed in as {session.user.email}, but the owner has not given you a role yet.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  )

  const isOwner = profile.role === 'owner'
  const isAdmin = isOwner || profile.role === 'principal'

  return (
    <div className="layout">
      <nav className="sidebar no-print">
        <div className="brand">Kid School System</div>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/collect">Collect Fee</NavLink>
        <NavLink to="/challans">Challans</NavLink>
        <NavLink to="/generate">Generate Challans</NavLink>
        <NavLink to="/defaulters">Defaulters</NavLink>
        <NavLink to="/payments">Payments Report</NavLink>
        <NavLink to="/students">Students</NavLink>
        {isAdmin && <NavLink to="/classes">Classes &amp; Fees</NavLink>}
        {isOwner && <NavLink to="/settings">Settings</NavLink>}
        <div className="who">
          {profile.full_name || profile.email}<br />
          <span className="muted">{ROLE_LABEL[profile.role]}</span><br />
          <a href="#" onClick={e => { e.preventDefault(); supabase.auth.signOut() }}>Sign out</a>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/collect" element={<CollectFee />} />
          <Route path="/collect/:studentId" element={<CollectFee />} />
          <Route path="/challans" element={<Challans />} />
          <Route path="/generate" element={<GenerateChallans />} />
          <Route path="/defaulters" element={<Defaulters />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/students" element={<Students />} />
          <Route path="/students/new" element={<StudentForm />} />
          <Route path="/students/import" element={<ImportStudents />} />
          <Route path="/students/:id" element={<StudentForm />} />
          {isAdmin && <Route path="/classes" element={<Classes />} />}
          {isOwner && <Route path="/settings" element={<SettingsPage />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}
