import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import {
  dhiArgentina,
  emptyAssessmentResponses,
  getAssessmentInstrument,
  scoreAssessment,
  type AssessmentDomainCode,
  type AssessmentInstrumentCode,
  type AssessmentResponseMap,
} from './questions'

export type AssessmentPhase = 'initial' | 'final' | 'follow_up'
export type AssessmentStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled'
export type AssessmentDeliveryMode = 'portal' | 'in_person'

export interface AssessmentRecord {
  id: string
  patientId: string
  patientName: string
  treatmentCycleId: string
  instrumentCode: AssessmentInstrumentCode
  instrumentVersion: number
  phase: AssessmentPhase
  deliveryMode: AssessmentDeliveryMode
  status: AssessmentStatus
  dueDate: string
  responses: AssessmentResponseMap
  totalScore: number | null
  subscaleScores: Record<AssessmentDomainCode, number>
  answeredCount: number
  assignedAt: string
  startedAt: string
  completedAt: string
  assessmentDate: string
  createdAt: string
}

export interface AssessmentAssignmentInput {
  patientId: string
  treatmentCycleId: string
  instrumentCode: AssessmentInstrumentCode
  instrumentVersion: number
  phase: AssessmentPhase
  deliveryMode: AssessmentDeliveryMode
  dueDate: string
}

const STORAGE_KEY = 'onur-demo-assessments-v3'

function read() {
  localStorage.removeItem('onur-demo-assessments-v2')
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return [] as AssessmentRecord[]
  try { return JSON.parse(raw) as AssessmentRecord[] } catch { return [] }
}

function write(items: AssessmentRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function responseMap(value: unknown, code: string, version: number): AssessmentResponseMap {
  const instrument = getAssessmentInstrument(code, version) ?? dhiArgentina
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return Object.fromEntries(instrument.questions.map((question) => {
    const answer = raw[question.id]
    return [question.id, typeof answer === 'number' && [0, 2, 4].includes(answer) ? answer : null]
  }))
}

function fromRow(row: Record<string, unknown>): AssessmentRecord {
  const patient = (row.patients ?? {}) as Record<string, unknown>
  const code = String(row.instrument_code ?? 'DHI_AR_25') as AssessmentInstrumentCode
  const version = Number(row.instrument_version ?? 1)
  const responses = responseMap(row.responses, code, version)
  const score = scoreAssessment(responses, getAssessmentInstrument(code, version) ?? dhiArgentina)
  const rawSubscales = row.subscale_scores && typeof row.subscale_scores === 'object' ? row.subscale_scores as Record<string, unknown> : {}
  const completedAt = String(row.completed_at ?? '')
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    patientName: String(patient.full_name ?? ''),
    treatmentCycleId: String(row.treatment_cycle_id ?? ''),
    instrumentCode: code,
    instrumentVersion: version,
    phase: row.phase as AssessmentPhase,
    deliveryMode: String(row.delivery_mode ?? 'portal') as AssessmentDeliveryMode,
    status: String(row.status ?? 'assigned') as AssessmentStatus,
    dueDate: String(row.due_date ?? ''),
    responses,
    totalScore: row.total_score === null || row.total_score === undefined ? null : Number(row.total_score),
    subscaleScores: {
      physical: Number(rawSubscales.physical ?? score.subscales.physical),
      emotional: Number(rawSubscales.emotional ?? score.subscales.emotional),
      functional: Number(rawSubscales.functional ?? score.subscales.functional),
    },
    answeredCount: Number(row.answered_count ?? score.answeredCount),
    assignedAt: String(row.assigned_at ?? row.created_at ?? ''),
    startedAt: String(row.started_at ?? ''),
    completedAt,
    assessmentDate: String(row.assessment_date ?? (completedAt ? completedAt.slice(0, 10) : '')),
    createdAt: String(row.created_at ?? ''),
  }
}

function sortAssessments(items: AssessmentRecord[]) {
  return items.sort((a, b) => (b.completedAt || b.assignedAt).localeCompare(a.completedAt || a.assignedAt))
}

export async function listPatientAssessments(patientId: string): Promise<AssessmentRecord[]> {
  if (!isSupabaseConfigured || !supabase) return sortAssessments(read().filter((item) => item.patientId === patientId))
  const { data, error } = await supabase.from('patient_assessments').select('*, patients(full_name)').eq('patient_id', patientId).order('assigned_at', { ascending: false })
  if (error) throw error
  return sortAssessments((data ?? []).map(fromRow))
}

export async function listProfessionalAssessments(): Promise<AssessmentRecord[]> {
  if (!isSupabaseConfigured || !supabase) return sortAssessments(read())
  const { data, error } = await supabase.from('patient_assessments').select('*, patients(full_name)').order('assigned_at', { ascending: false })
  if (error) throw error
  return sortAssessments((data ?? []).map(fromRow))
}

export async function listCurrentPatientAssessments(): Promise<AssessmentRecord[]> {
  if (!isSupabaseConfigured || !supabase) return sortAssessments(read().filter((item) => item.patientId === 'ana-p'))
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('Sesión de paciente no disponible.')
  const { data: patient, error: patientError } = await supabase.from('patients').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
  if (patientError) throw patientError
  if (!patient) return []
  return listPatientAssessments(patient.id)
}

export async function getAssessment(id: string): Promise<AssessmentRecord | null> {
  if (!isSupabaseConfigured || !supabase) return read().find((item) => item.id === id) ?? null
  const { data, error } = await supabase.from('patient_assessments').select('*, patients(full_name)').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? fromRow(data) : null
}

export async function createAssessmentAssignment(input: AssessmentAssignmentInput): Promise<AssessmentRecord> {
  const instrument = getAssessmentInstrument(input.instrumentCode, input.instrumentVersion)
  if (!instrument) throw new Error('El cuestionario seleccionado no está disponible.')
  if (!input.treatmentCycleId) throw new Error('Seleccioná un ciclo de tratamiento.')
  if (!isSupabaseConfigured || !supabase) {
    const items = read()
    if (items.some((item) => item.patientId === input.patientId && item.treatmentCycleId === input.treatmentCycleId && item.instrumentCode === input.instrumentCode && item.phase === input.phase && ['assigned', 'in_progress'].includes(item.status))) {
      throw new Error('Ya existe un cuestionario pendiente para ese momento del ciclo.')
    }
    const now = new Date().toISOString()
    const record: AssessmentRecord = {
      id: crypto.randomUUID(), patientId: input.patientId, patientName: 'Paciente', treatmentCycleId: input.treatmentCycleId,
      instrumentCode: input.instrumentCode, instrumentVersion: input.instrumentVersion, phase: input.phase,
      deliveryMode: input.deliveryMode, status: 'assigned', dueDate: input.dueDate, responses: emptyAssessmentResponses(instrument),
      totalScore: null, subscaleScores: { physical: 0, emotional: 0, functional: 0 }, answeredCount: 0,
      assignedAt: now, startedAt: '', completedAt: '', assessmentDate: '', createdAt: now,
    }
    write([...items, record])
    return record
  }
  const { data, error } = await supabase.rpc('create_assessment_assignment', {
    target_patient_id: input.patientId,
    target_treatment_cycle_id: input.treatmentCycleId,
    phase_input: input.phase,
    delivery_mode_input: input.deliveryMode,
    due_date_input: input.dueDate || null,
  })
  if (error?.code === '23505') throw new Error('Ya existe un cuestionario pendiente para ese momento del ciclo.')
  if (error) throw error
  return fromRow(data)
}

export async function cancelAssessment(id: string): Promise<AssessmentRecord> {
  const record = await getAssessment(id)
  if (!record) throw new Error('Cuestionario no encontrado.')
  if (!['assigned', 'in_progress'].includes(record.status)) throw new Error('El cuestionario ya no se puede cancelar.')
  if (!isSupabaseConfigured || !supabase) {
    const updated: AssessmentRecord = { ...record, status: 'cancelled' }
    write(read().map((item) => item.id === id ? updated : item))
    return updated
  }
  const { data, error } = await supabase.rpc('cancel_assessment', { target_assessment_id: id })
  if (error) throw error
  return fromRow(data)
}

export async function savePatientAssessmentDraft(id: string, responses: AssessmentResponseMap): Promise<AssessmentRecord> {
  const record = await getAssessment(id)
  if (!record) throw new Error('Cuestionario no encontrado.')
  const instrument = getAssessmentInstrument(record.instrumentCode, record.instrumentVersion) ?? dhiArgentina
  const score = scoreAssessment(responses, instrument)
  if (!isSupabaseConfigured || !supabase) {
    const updated = { ...record, responses, answeredCount: score.answeredCount, status: 'in_progress' as const, startedAt: record.startedAt || new Date().toISOString() }
    write(read().map((item) => item.id === id ? updated : item))
    return updated
  }
  const compact = Object.fromEntries(Object.entries(responses).filter(([, value]) => value !== null))
  const { data, error } = await supabase.rpc('save_patient_assessment_draft', { target_assessment_id: id, responses_input: compact })
  if (error) throw error
  return fromRow(data)
}

export async function completeAssessment(id: string, responses: AssessmentResponseMap): Promise<AssessmentRecord> {
  const record = await getAssessment(id)
  if (!record) throw new Error('Cuestionario no encontrado.')
  const instrument = getAssessmentInstrument(record.instrumentCode, record.instrumentVersion) ?? dhiArgentina
  const score = scoreAssessment(responses, instrument)
  if (!score.complete) throw new Error(`Completá las ${instrument.questions.length} respuestas antes de finalizar.`)
  if (!isSupabaseConfigured || !supabase) {
    const completedAt = new Date().toISOString()
    const updated: AssessmentRecord = { ...record, responses, answeredCount: score.answeredCount, totalScore: score.total, subscaleScores: score.subscales, status: 'completed', startedAt: record.startedAt || completedAt, completedAt, assessmentDate: completedAt.slice(0, 10) }
    write(read().map((item) => item.id === id ? updated : item))
    return updated
  }
  const { data, error } = await supabase.rpc('complete_assessment', { target_assessment_id: id, responses_input: responses })
  if (error) throw error
  return fromRow(data)
}

export function assessmentComparison(items: AssessmentRecord[], cycleId: string, instrumentCode: AssessmentInstrumentCode = 'DHI_AR_25') {
  const cycle = items.filter((item) => item.treatmentCycleId === cycleId && item.instrumentCode === instrumentCode && item.instrumentVersion === 1 && item.status === 'completed' && item.totalScore !== null)
  const initial = cycle.filter((item) => item.phase === 'initial').sort((a, b) => a.completedAt.localeCompare(b.completedAt))[0]
  const final = cycle.filter((item) => item.phase === 'final').sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
  if (!initial || !final) return null
  const initialTotal = Number(initial.totalScore)
  const finalTotal = Number(final.totalScore)
  return {
    initial,
    final,
    initialTotal,
    finalTotal,
    difference: finalTotal - initialTotal,
    maximumScore: dhiArgentina.maximumScore,
    subscaleDifferences: {
      physical: final.subscaleScores.physical - initial.subscaleScores.physical,
      emotional: final.subscaleScores.emotional - initial.subscaleScores.emotional,
      functional: final.subscaleScores.functional - initial.subscaleScores.functional,
    },
  }
}
