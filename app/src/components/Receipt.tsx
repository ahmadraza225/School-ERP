import { dmy, monthLabel, rs } from '../lib/format'
import type { Campus, ClassRow, Payment, Settings, Student } from '../lib/types'

export interface ReceiptLine { month: string; description: string; amount: number; fine_charged: number | null }

export function Receipt({ p, lines, student, settings, campus, cls, by }: {
  p: Payment; lines: ReceiptLine[]; student: Student; settings: Settings
  campus?: Campus; cls?: ClassRow; by?: string
}) {
  return (
    <div className="receipt">
      <h3>{settings.school_name}</h3>
      <div className="muted">{campus?.name}{campus?.phone && ` · ${campus.phone}`}</div>
      <h2 style={{ marginTop: 12 }}>Fee Receipt {p.voided && <span className="pill bad">VOID</span>}</h2>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>Receipt No: <b>R-{String(p.id).padStart(6, '0')}</b></div>
        <div>Date: <b>{dmy(p.paid_on)}</b></div>
      </div>
      <p>Student: <b>{student.name}</b> ({student.admission_no}) · Father: {student.father_name} · Class: {cls?.name}</p>
      <table>
        <thead><tr><th>Month</th><th className="num">Fee</th><th className="num">Late fine</th></tr></thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.month + l.description}><td>{monthLabel(l.month)}</td>
              <td className="num">{l.amount.toLocaleString()}</td><td className="num">{(l.fine_charged ?? 0).toLocaleString()}</td></tr>
          ))}
          <tr><th>Total received</th><th className="num">{rs(p.fees_total)}</th><th className="num">{rs(p.fine_total)}</th></tr>
        </tbody>
      </table>
      <p className="total-box">Paid: {rs(p.total)}</p>
      <p className="muted">Remaining dues: Rs 0 · Received by: {by ?? '-'}</p>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 36 }}>
        <span>________________<br />Signature</span><span>________________<br />School stamp</span>
      </div>
    </div>
  )
}
