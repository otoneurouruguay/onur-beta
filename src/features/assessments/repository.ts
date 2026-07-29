import { isSupabaseConfigured, supabase } from '../../lib/supabase'

export type AssessmentPhase = 'initial' | 'final' | 'follow_up'
export type AssessmentResponse = number | 'not_applicable' | null
export interface AssessmentRecord {
  id: string; patientId: string; patientName: string; treatmentCycleId: string; sourceDocumentId: string
  instrumentCode: string; instrumentVersion: number; phase: AssessmentPhase; assessmentDate: string
  responses: AssessmentResponse[]; totalScore: number; answeredCount: number; applicableCount: number
  generalRating: number | null; fallsCount: number | null; walkingAidUsed: boolean | null; createdAt: string
}
export interface AssessmentInput {
  patientId: string; treatmentCycleId: string; sourceDocumentId: string; phase: AssessmentPhase
  assessmentDate: string; responses: AssessmentResponse[]; generalRating: number | null
  fallsCount: number | null; walkingAidUsed: boolean | null
}

const STORAGE_KEY = 'onur-demo-assessments-v2'
const seed: AssessmentRecord[] = [{
  id: 'assessment-ana-initial', patientId: 'ana-p', patientName: 'Ana Pereira', treatmentCycleId: 'cycle-ana-2', sourceDocumentId: '', instrumentCode: 'ONUR_PERCEPCION_18', instrumentVersion: 2, phase: 'initial', assessmentDate: '2026-07-02', responses: [3,2,2,3,2,1,2,2,2,2,3,1,2,2,2,2,2,3], totalScore: 38, answeredCount: 18, applicableCount: 18, generalRating: 4, fallsCount: 0, walkingAidUsed: false, createdAt: '2026-07-02T12:00:00.000Z',
}]

function read() { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return seed; try { return JSON.parse(raw) as AssessmentRecord[] } catch { return seed } }
function write(items: AssessmentRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) }
function responseValue(value: unknown): AssessmentResponse { return typeof value === 'number' ? value : value === 'not_applicable' ? value : null }
function fromRow(row: Record<string, unknown>): AssessmentRecord {
  const patient = (row.patients ?? {}) as Record<string, unknown>
  const responseMap = (row.responses ?? {}) as Record<string, unknown>
  const version = Number(row.instrument_version ?? 1)
  const length = version >= 2 ? 18 : 12
  const responses = Array.from({ length }, (_, index) => responseValue(responseMap[String(index + 1)]))
  const fallbackApplicable = responses.filter((value) => typeof value === 'number').length
  return { id: String(row.id), patientId: String(row.patient_id), patientName: String(patient.full_name ?? ''), treatmentCycleId: String(row.treatment_cycle_id ?? ''), sourceDocumentId: String(row.source_document_id ?? ''), instrumentCode: String(row.instrument_code ?? 'ONUR_PERCEPCION_12'), instrumentVersion: version, phase: row.phase as AssessmentPhase, assessmentDate: String(row.assessment_date), responses, totalScore: Number(row.total_score), answeredCount: Number(row.answered_count), applicableCount: Number(row.applicable_count ?? fallbackApplicable), generalRating: row.general_rating === null || row.general_rating === undefined ? null : Number(row.general_rating), fallsCount: row.falls_count === null || row.falls_count === undefined ? null : Number(row.falls_count), walkingAidUsed: row.walking_aid_used === null || row.walking_aid_used === undefined ? null : Boolean(row.walking_aid_used), createdAt: String(row.created_at) }
}

export async function listPatientAssessments(patientId: string): Promise<AssessmentRecord[]> {
  if (!isSupabaseConfigured || !supabase) return read().filter((item) => item.patientId === patientId).sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate))
  const { data, error } = await supabase.from('patient_assessments').select('*, patients(full_name)').eq('patient_id', patientId).order('assessment_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function listProfessionalAssessments(): Promise<AssessmentRecord[]> {
  if (!isSupabaseConfigured || !supabase) return read().sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate))
  const { data, error } = await supabase.from('patient_assessments').select('*, patients(full_name)').order('assessment_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function listCurrentPatientAssessments(): Promise<AssessmentRecord[]> {
  if (!isSupabaseConfigured || !supabase) return read().filter((item) => item.patientId === 'ana-p').sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate))
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('Sesión de paciente no disponible.')
  const { data: patient, error: patientError } = await supabase.from('patients').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
  if (patientError) throw patientError
  if (!patient) return []
  return listPatientAssessments(patient.id)
}

export async function createAssessment(input: AssessmentInput): Promise<AssessmentRecord> {
  const values = input.responses.slice(0, 18)
  const applicable = values.filter((value): value is number => typeof value === 'number')
  const answered = values.filter((value) => value !== null)
  const total = applicable.reduce((sum, value) => sum + value, 0)
  if (!isSupabaseConfigured || !supabase) {
    const names: Record<string, string> = { 'ana-p': 'Ana Pereira', 'luis-s': 'Luis Silva', 'marta-r': 'Marta Rodríguez', 'jorge-m': 'Jorge Martínez', 'elena-f': 'Elena Fernández' }
    const record: AssessmentRecord = { id: crypto.randomUUID(), patientId: input.patientId, patientName: names[input.patientId] ?? 'Paciente', treatmentCycleId: input.treatmentCycleId, sourceDocumentId: input.sourceDocumentId, instrumentCode: 'ONUR_PERCEPCION_18', instrumentVersion: 2, phase: input.phase, assessmentDate: input.assessmentDate, responses: values, totalScore: total, answeredCount: answered.length, applicableCount: applicable.length, generalRating: input.generalRating, fallsCount: input.fallsCount, walkingAidUsed: input.walkingAidUsed, createdAt: new Date().toISOString() }
    write([...read(), record])
    return record
  }
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('Sesión profesional no disponible.')
  const responses = Object.fromEntries(values.map((value, index) => [String(index + 1), value]))
  const { data, error } = await supabase.from('patient_assessments').insert({ patient_id: input.patientId, treatment_cycle_id: input.treatmentCycleId || null, source_document_id: input.sourceDocumentId || null, instrument_code: 'ONUR_PERCEPCION_18', instrument_version: 2, phase: input.phase, assessment_date: input.assessmentDate, responses, total_score: total, answered_count: answered.length, applicable_count: applicable.length, general_rating: input.generalRating, falls_count: input.fallsCount, walking_aid_used: input.walkingAidUsed, created_by: auth.user.id }).select('*, patients(full_name)').single()
  if (error) throw error
  return fromRow(data)
}

export function assessmentComparison(items: AssessmentRecord[], cycleId: string) {
  const cycle = items.filter((item) => item.treatmentCycleId === cycleId && item.instrumentCode === 'ONUR_PERCEPCION_18' && item.instrumentVersion === 2 && item.answeredCount === 18)
  const initial = cycle.filter((item) => item.phase === 'initial').sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate))[0]
  const final = cycle.filter((item) => item.phase === 'final').sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate))[0]
  if (!initial || !final) return null
  const pairs = initial.responses.map((initialValue, index) => ({ initialValue, finalValue: final.responses[index] })).filter((pair): pair is { initialValue: number; finalValue: number } => typeof pair.initialValue === 'number' && typeof pair.finalValue === 'number')
  if (!pairs.length) return null
  const initialComparableTotal = pairs.reduce((sum, pair) => sum + pair.initialValue, 0)
  const finalComparableTotal = pairs.reduce((sum, pair) => sum + pair.finalValue, 0)
  return { initial, final, initialComparableTotal, finalComparableTotal, difference: finalComparableTotal - initialComparableTotal, comparedCount: pairs.length, maximumScore: pairs.length * 3 }
}
