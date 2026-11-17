export type Role = 'owner' | 'principal' | 'accountant' | 'pending'
export interface Profile { id: string; email: string | null; full_name: string; role: Role }
export interface Settings {
  id: number; school_name: string; due_day: number; fine_per_day: number
  max_fine: number; voucher_notice: string
}
export interface Campus { id: number; name: string; address: string; phone: string }
export interface ClassRow { id: number; name: string; sort_order: number; monthly_fee: number }
export interface Student {
  id: number; admission_no: string; name: string; father_name: string; phone: string
  cnic: string; campus_id: number; class_id: number; family_code: string | null
  monthly_fee_override: number | null; status: 'active' | 'left'; notes: string
}
export interface Outstanding {
  due_id: number; month: string; description: string; amount: number
  due_date: string; fine: number; fine_waived: number
}
export interface Payment {
  id: number; student_id: number; paid_on: string; fees_total: number; fine_total: number
  total: number; collected_by: string | null; voided: boolean; void_reason: string | null
  created_at: string
}
export interface Challan {
  id: number; challan_no: string; student_id: number; month: string
  issue_date: string; due_date: string
}
export interface ChallanLine { challan_id: number; sort: number; description: string; amount: number }
