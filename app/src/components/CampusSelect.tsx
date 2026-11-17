import type { Campus } from '../lib/types'

/** Campus filter: '' means both campuses. */
export function CampusSelect({ campuses, value, onChange, allLabel = 'Both campuses' }: {
  campuses: Campus[]; value: string; onChange: (v: string) => void; allLabel?: string | null
}) {
  return (
    <label>Campus
      <select value={value} onChange={e => onChange(e.target.value)}>
        {allLabel !== null && <option value="">{allLabel}</option>}
        {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  )
}

export const Err = ({ error }: { error: string | null | undefined }) =>
  error ? <div className="msg err">{error}</div> : null
