import { createClient } from '@supabase/supabase-js'

// Trim stray spaces/quotes that often sneak in when pasting keys into a hosting dashboard.
const clean = (v: unknown) => String(v ?? '').trim().replace(/^["']|["']$/g, '').trim()
const url = clean(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '')
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

// eslint-disable-next-line no-control-regex
const ascii = (v: string) => /^[\x21-\x7e]+$/.test(v)
/** Explains what is wrong with the keys, or null if they look fine. */
export const configProblem: string | null =
  !url || !key ? 'The Supabase URL or key is missing.'
  : !ascii(url) || !url.startsWith('https://') ? 'VITE_SUPABASE_URL is not valid. It should look like https://xxxx.supabase.co with nothing else.'
  : !ascii(key) ? 'VITE_SUPABASE_ANON_KEY contains an invalid character (often "…" when a shortened key was copied from the screen, or a space). Copy the full key with the copy button and paste it again.'
  : null
export const configured = configProblem === null
export const supabase = createClient(url || 'http://localhost', key || 'missing')

/** Throws the Supabase error message so pages can show it. */
export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}
