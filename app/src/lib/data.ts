import { useCallback, useEffect, useState } from 'react'
import { supabase, check } from './supabase'
import type { Campus, ClassRow, Settings } from './types'

/** Small hook: runs an async loader, exposes data/error/reload. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)
  const reload = useCallback(() => {
    setLoading(true)
    run().then(d => { setData(d); setError(null) })
      .catch(e => setError(String(e.message ?? e)))
      .finally(() => setLoading(false))
  }, [run])
  useEffect(reload, [reload])
  return { data, error, loading, reload }
}

export interface Lookups { settings: Settings; campuses: Campus[]; classes: ClassRow[] }

export async function loadLookups(): Promise<Lookups> {
  const [s, c, k] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('campuses').select('*').order('id'),
    supabase.from('classes').select('*').order('sort_order'),
  ])
  return { settings: check(s) as Settings, campuses: check(c) as Campus[], classes: check(k) as ClassRow[] }
}

export const useLookups = () => useLoad(loadLookups)

/** Fetch every row of a query in chunks of 1000 (Supabase's page limit). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const res = await build(from, from + 999)
    const rows = (check(res) ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}
