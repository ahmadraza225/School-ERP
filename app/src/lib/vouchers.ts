import { supabase } from './supabase'
import { fetchAll } from './data'
import type { Challan, ChallanLine, Student } from './types'
import type { VoucherData } from '../components/ChallanVoucher'

/** Load everything needed to print the given challans. */
export async function loadVouchers(challans: Challan[]): Promise<VoucherData[]> {
  const ids = challans.map(c => c.id)
  const sids = [...new Set(challans.map(c => c.student_id))]
  const lines: ChallanLine[] = []
  const students: Student[] = []
  const dues: { student_id: number; month: string; payment_id: number | null }[] = []
  for (let i = 0; i < ids.length; i += 200) {
    lines.push(...await fetchAll<ChallanLine>((a, b) => supabase.from('challan_lines').select('*')
      .in('challan_id', ids.slice(i, i + 200)).order('sort').range(a, b)))
  }
  for (let i = 0; i < sids.length; i += 200) {
    const part = sids.slice(i, i + 200)
    students.push(...await fetchAll<Student>((a, b) => supabase.from('students').select('*').in('id', part).range(a, b)))
    dues.push(...await fetchAll<typeof dues[number]>((a, b) => supabase.from('dues')
      .select('student_id, month, payment_id').in('student_id', part).range(a, b)))
  }
  const stMap = new Map(students.map(s => [s.id, s]))
  return challans.map(c => ({
    challan: c,
    student: stMap.get(c.student_id)!,
    lines: lines.filter(l => l.challan_id === c.id),
    history: dues.filter(d => d.student_id === c.student_id && d.month <= c.month)
      .map(d => ({ month: d.month, paid: d.payment_id != null })),
  }))
}
