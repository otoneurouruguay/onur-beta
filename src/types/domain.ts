export type PatientStatus = 'active' | 'inactive'
export type SessionStatus = 'pending' | 'completed' | 'partial' | 'interrupted'
export type QualityStatus = 'ok' | 'review' | 'quarantine' | 'blocked'
export type SuggestionStatus = 'pending' | 'accepted' | 'edited' | 'discarded'

export interface PatientSummary {
  id: string
  fullName: string
  initials: string
  age: number
  insurer: string
  status: PatientStatus
  cycleLabel: string
  todaySession: string | null
  lastActivity: string
  portalAccess: 'enabled' | 'disabled'
}

export interface TodaySession {
  id: string
  patientId: string
  patientName: string
  title: string
  durationMinutes: number
  status: SessionStatus
  mode: 'Domiciliaria' | 'Presencial'
}

export interface StatisticalSuggestion {
  id: string
  patientName: string
  studyLabel: string
  ruleCode: string
  summary: string
  limitation: string
  createdAt: string
  status: SuggestionStatus
}
