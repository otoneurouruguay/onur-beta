import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { createEmptyClinicalEpisode, type ClinicalEpisodeRecord, type ClinicalEpisodeValues } from './types'

const EPISODES_KEY = 'onur-demo-clinical-episodes-v1'

function readEpisodes(): ClinicalEpisodeRecord[] {
  const raw = localStorage.getItem(EPISODES_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) as ClinicalEpisodeRecord[] } catch { return [] }
}

function writeEpisodes(records: ClinicalEpisodeRecord[]) {
  localStorage.setItem(EPISODES_KEY, JSON.stringify(records))
}

function rowToEpisode(row: Record<string, unknown>): ClinicalEpisodeRecord {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    treatmentCycleId: String(row.treatment_cycle_id),
    diagnosisCode: row.diagnosis_code as ClinicalEpisodeRecord['diagnosisCode'],
    certainty: row.diagnostic_certainty as ClinicalEpisodeRecord['certainty'],
    diagnosisSource: String(row.diagnosis_source ?? ''),
    onsetDate: String(row.onset_date ?? ''),
    phase: row.clinical_phase as ClinicalEpisodeRecord['phase'],
    course: row.clinical_course as ClinicalEpisodeRecord['course'],
    etiology: String(row.etiology ?? ''),
    laterality: row.laterality as ClinicalEpisodeRecord['laterality'],
    anamnesis: { ...createEmptyClinicalEpisode().anamnesis, ...((row.common_anamnesis ?? {}) as ClinicalEpisodeRecord['anamnesis']) },
    pathologyFindings: (row.pathology_findings ?? {}) as ClinicalEpisodeRecord['pathologyFindings'],
    measuredImpairments: String(row.measured_impairments ?? ''),
    activityLimitations: String(row.activity_limitations ?? ''),
    participationGoals: String(row.participation_goals ?? ''),
    precautions: String(row.precautions ?? ''),
    pendingData: String(row.pending_data ?? ''),
    clinicianNotes: String(row.clinician_notes ?? ''),
    status: row.status as ClinicalEpisodeRecord['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    reviewedAt: String(row.reviewed_at ?? ''),
    reviewedBy: String(row.reviewed_by ?? ''),
  }
}

export async function getClinicalEpisode(patientId: string, treatmentCycleId: string): Promise<ClinicalEpisodeRecord | null> {
  if (!patientId || !treatmentCycleId) return null
  if (!isSupabaseConfigured || !supabase) return readEpisodes().find((episode) => episode.patientId === patientId && episode.treatmentCycleId === treatmentCycleId) ?? null
  const { data, error } = await supabase.from('clinical_episodes').select('*').eq('patient_id', patientId).eq('treatment_cycle_id', treatmentCycleId).maybeSingle()
  if (error) throw error
  return data ? rowToEpisode(data) : null
}

export async function listClinicalEpisodes(patientId: string): Promise<ClinicalEpisodeRecord[]> {
  if (!isSupabaseConfigured || !supabase) return readEpisodes().filter((episode) => episode.patientId === patientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const { data, error } = await supabase.from('clinical_episodes').select('*').eq('patient_id', patientId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToEpisode)
}

export async function saveClinicalEpisode(patientId: string, values: ClinicalEpisodeValues): Promise<ClinicalEpisodeRecord> {
  const now = new Date().toISOString()
  if (!isSupabaseConfigured || !supabase) {
    const records = readEpisodes()
    const existing = records.find((episode) => episode.patientId === patientId && episode.treatmentCycleId === values.treatmentCycleId)
    const record: ClinicalEpisodeRecord = {
      ...values,
      id: existing?.id ?? crypto.randomUUID(),
      patientId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      reviewedAt: values.status === 'reviewed' ? now : existing?.reviewedAt ?? '',
      reviewedBy: values.status === 'reviewed' ? 'demo-professional' : existing?.reviewedBy ?? '',
    }
    writeEpisodes([...records.filter((episode) => episode.id !== record.id), record])
    return record
  }
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('Sesión profesional no disponible.')
  const payload = {
    patient_id: patientId,
    treatment_cycle_id: values.treatmentCycleId,
    diagnosis_code: values.diagnosisCode,
    diagnostic_certainty: values.certainty,
    diagnosis_source: values.diagnosisSource.trim() || null,
    onset_date: values.onsetDate || null,
    clinical_phase: values.phase,
    clinical_course: values.course,
    etiology: values.etiology.trim() || null,
    laterality: values.laterality,
    common_anamnesis: values.anamnesis,
    pathology_findings: values.pathologyFindings,
    measured_impairments: values.measuredImpairments.trim() || null,
    activity_limitations: values.activityLimitations.trim() || null,
    participation_goals: values.participationGoals.trim() || null,
    precautions: values.precautions.trim() || null,
    pending_data: values.pendingData.trim() || null,
    clinician_notes: values.clinicianNotes.trim() || null,
    status: values.status,
    reviewed_at: values.status === 'reviewed' ? now : null,
    reviewed_by: values.status === 'reviewed' ? auth.user.id : null,
    updated_by: auth.user.id,
  }
  const { data, error } = await supabase.from('clinical_episodes').upsert(payload, { onConflict: 'patient_id,treatment_cycle_id' }).select().single()
  if (error) throw error
  return rowToEpisode(data)
}
