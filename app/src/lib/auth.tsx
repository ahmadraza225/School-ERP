import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthState { session: Session | null; profile: Profile | null; loading: boolean; error: string | null }
const Ctx = createContext<AuthState>({ session: null, profile: null, loading: true, error: null })

/** Rejects if the database does not answer in time, so the app never hangs on "Loading…". */
function withTimeout<T>(p: PromiseLike<T>, ms = 15000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, profile: null, loading: true, error: null })

  useEffect(() => {
    const load = async (session: Session | null) => {
      if (!session) return setState({ session: null, profile: null, loading: false, error: null })
      try {
        const res = await withTimeout(supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle())
        if (res.error) throw new Error(res.error.message)
        setState({ session, profile: res.data as Profile | null, loading: false, error: null })
      } catch (e) {
        setState({ session, profile: null, loading: false, error: (e as Error).message })
      }
    }
    withTimeout(supabase.auth.getSession())
      .then(({ data }) => load(data.session))
      .catch(e => setState({ session: null, profile: null, loading: false, error: (e as Error).message }))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setTimeout(() => load(s), 0) })
    return () => sub.subscription.unsubscribe()
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

/** Forget the saved login on this computer (used when it gets stuck). */
export function resetLogin() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
  location.reload()
}

export const useAuth = () => useContext(Ctx)
export const useRole = () => useContext(Ctx).profile?.role ?? 'pending'
