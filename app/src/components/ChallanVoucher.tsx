import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { dmy, monthLabel, rs } from '../lib/format'
import type { Campus, Challan, ChallanLine, ClassRow, Settings, Student } from '../lib/types'

export interface VoucherData {
  challan: Challan; lines: ChallanLine[]; student: Student
  history: { month: string; paid: boolean }[]
}

const COPIES = [
  { label: 'SCHOOL COPY', color: '#6a3fd1', soft: '#f1ecfd' },
  { label: 'PARENT COPY', color: '#1e8e4e', soft: '#e9f7ef' },
]

function QR({ text }: { text: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => { QRCode.toDataURL(text, { margin: 0, width: 120 }).then(setSrc) }, [text])
  return src ? <img src={src} alt="" style={{ width: 56, height: 56 }} /> : null
}

/** Last 12 months ending at the challan month. */
function last12(month: string) {
  const [y, m] = month.split('-').map(Number)
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(y, m - 12 + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
}

export function ChallanVoucher({ v, settings, campus, cls }: {
  v: VoucherData; settings: Settings; campus?: Campus; cls?: ClassRow
}) {
  const total = v.lines.reduce((s, l) => s + l.amount, 0)
  const hist = new Map(v.history.map(h => [h.month, h.paid]))
  const months = last12(v.challan.month)

  return (
    <div className="voucher-sheet print-page">
      {COPIES.map(c => (
        <div className="voucher" key={c.label}>
          <span className="tag" style={{ background: c.color }}>{c.label}</span>
          <div className="school">{settings.school_name}</div>
          <div className="addr">{campus?.name}{campus?.address && ` · ${campus.address}`}{campus?.phone && ` · ${campus.phone}`}</div>
          <div className="vtitle" style={{ color: c.color }}>
            <span>FEE VOUCHER · {monthLabel(v.challan.month).toUpperCase()}</span>
            <span className="no">No. {v.challan.challan_no}</span>
          </div>
          <div className="payable" style={{ background: c.soft, borderColor: c.color + '55' }}>
            <div><div className="small">PAYABLE BY {dmy(v.challan.due_date)}</div><div className="big">{rs(total)}</div></div>
            <div className="after">After due date<br /><b>+ Rs {settings.fine_per_day}/day</b><br /><span className="small">(max Rs {settings.max_fine.toLocaleString()} per month)</span></div>
          </div>
          <div className="info">
            <div><span>STUDENT</span>{v.student.name}</div>
            <div><span>ADMISSION NO.</span>{v.student.admission_no}</div>
            <div><span>FATHER</span>{v.student.father_name}</div>
            <div><span>CLASS</span>{cls?.name}</div>
          </div>
          <table className="lines">
            <thead><tr><th>FEE</th><th className="num">AMOUNT</th></tr></thead>
            <tbody>
              {v.lines.map(l => <tr key={l.sort}><td>{l.description}</td><td className="num">{l.amount.toLocaleString()}</td></tr>)}
              <tr className="tot"><td>Total payable</td><td className="num">{rs(total)}</td></tr>
            </tbody>
          </table>
          <div className="hist">
            <div className="small">FEE HISTORY <span className="legend"><i className="paid" /> paid <i className="due" /> unpaid</span></div>
            <div className="bars">
              {months.map(m => (
                <div key={m}><i className={hist.has(m) ? (hist.get(m) ? 'paid' : 'due') : ''} />{monthLabel(m).slice(0, 3)}</div>
              ))}
            </div>
          </div>
          <div className="notice">
            <QR text={v.challan.challan_no} />
            <div><b>Notice:</b> {settings.voucher_notice}<br />Pay at the school counter. Due <b>{dmy(v.challan.due_date)}</b></div>
          </div>
          <div className="sign"><span>Authorized signature</span><span>School stamp</span></div>
        </div>
      ))}
    </div>
  )
}
