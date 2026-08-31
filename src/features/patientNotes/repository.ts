import { isSupabaseConfigured, supabase } from '../../lib/supabase'

export interface PatientReminderNote {
  id: string
  patientId: string
  body: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'onur-demo-patient-reminder-notes-v1'

function readDemo(): PatientReminderNote[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as PatientReminderNote[]
  } catch {
    return []
  }
}

function writeDemo(records: PatientReminderNote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function cleanBody(body: string) {
  const clean = body.trim()
  if (!clean) throw new Error('Escribí el recordatorio antes de guardarlo.')
  if (clean.length > 1500) throw new Error('La nota no puede superar 1500 caracteres.')
  return clean
}

function fromRow(row: Record<string, unknown>): PatientReminderNote {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    body: String(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listPatientReminderNotes(patientId: string): Promise<PatientReminderNote[]> {
  if (!patientId) return []
  if (!isSupabaseConfigured || !supabase) {
    return readDemo().filter((note) => note.patientId === patientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  const { data, error } = await supabase
    .from('patient_reminder_notes')
    .select('id,patient_id,body,created_at,updated_at')
    .eq('patient_id', patientId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => fromRow(row as Record<string, unknown>))
}

export async function createPatientReminderNote(input: { patientId: string; body: string }) {
  const body = cleanBody(input.body)
  const now = new Date().toISOString()
  if (!isSupabaseConfigured || !supabase) {
    const note: PatientReminderNote = { id: crypto.randomUUID(), patientId: input.patientId, body, createdAt: now, updatedAt: now }
    writeDemo([note, ...readDemo()])
    return note
  }
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('La sesión profesional no está disponible.')
  const { data, error } = await supabase.from('patient_reminder_notes').insert({
    patient_id: input.patientId,
    body,
    created_by: auth.user.id,
    updated_by: auth.user.id,
  }).select('id,patient_id,body,created_at,updated_at').single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

export async function updatePatientReminderNote(input: { patientId: string; noteId: string; body: string }) {
  const body = cleanBody(input.body)
  const now = new Date().toISOString()
  if (!isSupabaseConfigured || !supabase) {
    const records = readDemo()
    const current = records.find((note) => note.id === input.noteId && note.patientId === input.patientId)
    if (!current) throw new Error('La nota ya no está disponible.')
    const updated = { ...current, body, updatedAt: now }
    writeDemo(records.map((note) => note.id === input.noteId ? updated : note))
    return updated
  }
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('La sesión profesional no está disponible.')
  const { data, error } = await supabase.from('patient_reminder_notes').update({ body, updated_by: auth.user.id })
    .eq('id', input.noteId).eq('patient_id', input.patientId).is('archived_at', null)
    .select('id,patient_id,body,created_at,updated_at').single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

export async function archivePatientReminderNote(input: { patientId: string; noteId: string }) {
  const now = new Date().toISOString()
  if (!isSupabaseConfigured || !supabase) {
    const records = readDemo()
    const exists = records.some((note) => note.id === input.noteId && note.patientId === input.patientId)
    if (!exists) throw new Error('La nota ya no está disponible.')
    writeDemo(records.filter((note) => note.id !== input.noteId))
    return
  }
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('La sesión profesional no está disponible.')
  const { error } = await supabase.from('patient_reminder_notes').update({
    archived_at: now,
    archived_by: auth.user.id,
    updated_by: auth.user.id,
  }).eq('id', input.noteId).eq('patient_id', input.patientId).is('archived_at', null)
  if (error) throw error
}
