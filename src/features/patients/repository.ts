import { patients as demoSeed } from '../../data/demo'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { PatientSummary } from '../../types/domain'
import { createPortalAccount as enablePatientPortal } from '../access/repository'
import type { PatientFormValues } from './schema'

export interface PatientRecord extends PatientSummary {
  documentNumber: string
  birthDate: string
  affiliateNumber: string
  phone: string
  privateNotes: string
  username: string
}

export interface SavePatientResult {
  patient: PatientRecord
  warning?: string
}

export interface DeletePatientResult {
  warning?: string
}

const STORAGE_KEY = 'onur-demo-patients-v1'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function ageFrom(date: string) {
  if (!date) return 0
  const birth = new Date(`${date}T12:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

function seedRecords(): PatientRecord[] {
  return demoSeed.map((patient) => ({
    ...patient,
    documentNumber: '', birthDate: '', affiliateNumber: '', phone: '', privateNotes: '', username: '',
  }))
}

function readDemo() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return seedRecords()
  try {
    return (JSON.parse(stored) as PatientRecord[]).map((patient) => ({
      ...patient,
      documentNumber: patient.documentNumber ?? '',
    }))
  } catch {
    return seedRecords()
  }
}

function writeDemo(records: PatientRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function fromRow(row: Record<string, unknown>): PatientRecord {
  const fullName = String(row.full_name)
  const birthDate = String(row.birth_date ?? '')
  return {
    id: String(row.id), fullName, initials: initials(fullName), age: ageFrom(birthDate),
    insurer: String(row.insurer ?? 'Sin mutualista'), status: row.status as 'active' | 'inactive',
    cycleLabel: 'Sin ciclo activo', todaySession: null, lastActivity: 'Sin actividad',
    portalAccess: 'disabled', birthDate, affiliateNumber: String(row.affiliate_number ?? ''),
    documentNumber: '', phone: String(row.phone ?? ''), privateNotes: '', username: '',
  }
}

export async function listPatients(): Promise<PatientRecord[]> {
  if (!isSupabaseConfigured || !supabase) return readDemo()
  const { data, error } = await supabase.from('patients').select('*').order('full_name')
  if (error) throw error
  return (data ?? []).map((row) => fromRow(row))
}

export async function getPatient(id: string): Promise<PatientRecord | null> {
  if (!isSupabaseConfigured || !supabase) return readDemo().find((patient) => patient.id === id) ?? null
  const { data, error } = await supabase.from('patients').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const patient = fromRow(data)
  const [{ data: note }, { data: portal }] = await Promise.all([
    supabase.from('patient_private_notes').select('notes, document_number').eq('patient_id', id).maybeSingle(),
    supabase.from('patient_portal_accounts').select('username_normalized, enabled').eq('patient_id', id).maybeSingle(),
  ])
  patient.privateNotes = note?.notes ?? ''
  patient.documentNumber = note?.document_number ?? ''
  patient.username = portal?.username_normalized ?? ''
  patient.portalAccess = portal?.enabled ? 'enabled' : 'disabled'
  return patient
}

export async function createPatient(values: PatientFormValues): Promise<SavePatientResult> {
  if (!isSupabaseConfigured || !supabase) {
    const record: PatientRecord = {
      id: crypto.randomUUID(), fullName: values.fullName, initials: initials(values.fullName),
      age: ageFrom(values.birthDate ?? ''), insurer: values.insurer || 'Sin mutualista', status: values.status,
      cycleLabel: 'Sin ciclo activo', todaySession: null, lastActivity: 'Creado recién',
      portalAccess: values.createPortalAccount ? 'enabled' : 'disabled', birthDate: values.birthDate ?? '',
      affiliateNumber: values.affiliateNumber ?? '', phone: values.phone ?? '', privateNotes: values.privateNotes ?? '',
      documentNumber: values.documentNumber ?? '', username: values.createPortalAccount ? values.username ?? '' : '',
    }
    writeDemo([...readDemo(), record])
    if (values.createPortalAccount) {
      await enablePatientPortal(record.id, values.username ?? '', values.temporaryCi ?? '')
    }
    return { patient: record }
  }
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw authError ?? new Error('La sesión profesional no está disponible.')
  const { data, error } = await supabase.from('patients').insert({
    professional_id: authData.user.id, full_name: values.fullName, birth_date: values.birthDate || null,
    insurer: values.insurer || null, affiliate_number: values.affiliateNumber || null,
    phone: values.phone || null, status: values.status,
  }).select().single()
  if (error) throw error
  if (values.privateNotes || values.documentNumber) {
    const { error: noteError } = await supabase.from('patient_private_notes').insert({
      patient_id: data.id,
      updated_by: authData.user.id,
      notes: values.privateNotes ?? '',
      document_number: values.documentNumber || null,
    })
    if (noteError) throw noteError
  }
  let warning: string | undefined
  if (values.createPortalAccount) {
    try {
      await enablePatientPortal(data.id, values.username ?? '', values.temporaryCi ?? '')
    } catch {
      warning = 'El paciente fue creado, pero no se pudo habilitar su cuenta de portal.'
    }
  }
  return { patient: (await getPatient(data.id)) ?? fromRow(data), warning }
}

export async function updatePatient(id: string, values: PatientFormValues): Promise<SavePatientResult> {
  if (!isSupabaseConfigured || !supabase) {
    const records = readDemo()
    const current = records.find((patient) => patient.id === id)
    if (!current) throw new Error('Paciente no encontrado.')
    const updated: PatientRecord = { ...current, fullName: values.fullName, initials: initials(values.fullName), age: ageFrom(values.birthDate ?? ''), documentNumber: values.documentNumber ?? '', birthDate: values.birthDate ?? '', insurer: values.insurer || 'Sin mutualista', affiliateNumber: values.affiliateNumber ?? '', phone: values.phone ?? '', privateNotes: values.privateNotes ?? '', status: values.status, portalAccess: values.createPortalAccount ? 'enabled' : current.portalAccess, username: values.createPortalAccount ? values.username ?? current.username : current.username }
    writeDemo(records.map((patient) => patient.id === id ? updated : patient))
    if (values.createPortalAccount) {
      await enablePatientPortal(id, values.username ?? '', values.temporaryCi ?? '')
    }
    return { patient: updated }
  }
  const { error } = await supabase.from('patients').update({ full_name: values.fullName, birth_date: values.birthDate || null, insurer: values.insurer || null, affiliate_number: values.affiliateNumber || null, phone: values.phone || null, status: values.status }).eq('id', id)
  if (error) throw error
  const { data: authData } = await supabase.auth.getUser()
  const { error: noteError } = await supabase.from('patient_private_notes').upsert({
    patient_id: id,
    updated_by: authData.user?.id,
    notes: values.privateNotes ?? '',
    document_number: values.documentNumber || null,
  }, { onConflict: 'patient_id' })
  if (noteError) throw noteError
  let warning: string | undefined
  if (values.createPortalAccount) {
    try {
      await enablePatientPortal(id, values.username ?? '', values.temporaryCi ?? '')
    } catch {
      warning = 'Los datos del paciente se guardaron, pero no se pudo habilitar el acceso domiciliario.'
    }
  }
  const patient = await getPatient(id)
  if (!patient) throw new Error('Paciente no encontrado después de actualizar.')
  return { patient, warning }
}

export async function deletePatient(id: string): Promise<DeletePatientResult> {
  if (!isSupabaseConfigured || !supabase) {
    const records = readDemo()
    if (!records.some((patient) => patient.id === id)) throw new Error('Paciente no encontrado.')
    writeDemo(records.filter((patient) => patient.id !== id))
    return {}
  }

  const { data, error } = await supabase.functions.invoke<{ success?: boolean; warning?: string; error?: string }>('delete-patient', {
    body: { patient_id: id },
  })

  if (error) throw new Error('No fue posible eliminar el paciente. Intentá nuevamente.')
  if (!data?.success) throw new Error(data?.error ?? 'No fue posible eliminar el paciente.')
  return { warning: data.warning }
}
