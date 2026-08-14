/**
 * Type definitions for NgajarYuk Next
 * Auto-generated from legacy Laravel models
 */

export interface Profile {
  id: string
  name: string
  phone_num?: string | null
  is_admin: boolean
  mapel?: Record<string, string[]> | null
  created_at: string
  updated_at: string
}

export interface Student {
  id: number
  name: string
  progul?: string | null
  grade: string
  created_at: string
  updated_at: string
}

export interface Absensi {
  id: number
  user_id?: string | null
  nama: string
  unit: string
  lokasi: string
  alamat?: string | null
  foto?: string | null
  akurasi?: string | null
  waktu: string
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: number
  student_id: number
  day: number
  month: number
  year: number
  value: 'S' | 'I' | 'A'
  created_at: string
  updated_at: string
}

export interface Note {
  id: number
  class: string
  subject: string
  teacher_id?: string | null
  date: string
  time: string
  note: string
  checked: boolean
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: number
  class_name: string
  day: string
  period: number
  subject: string
  subject_display: string
  teacher?: string | null
  start_time?: string | null
  end_time?: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceSummary {
  S: number
  I: number
  A: number
}

export interface MapelAssignment {
  [className: string]: string[]
}
