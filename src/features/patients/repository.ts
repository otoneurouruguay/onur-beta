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

interface PatientCycleSummaryRow {
  patient_id: unknown
  label: unknown
  started_on: unknown
}

interface PatientPortalSummaryRow {
  patient_id: unknown
  enabled: unknown
  username_normalized?: unknown
}

interface PatientAssignmentSummaryRow {
  patient_id: unknown
  available_from: unknown
  available_until?: unknown
  status: unknown
  session_plans?: unknown
}

interface PatientPrivateSummaryRow {
  patient_id: unknown
  document_number?: unknown
}

function relatedPlanTitle(value: unknown) {
  const plan = Array.isArray(value) ? value[0] : value
  return plan && typeof plan === 'object' && 'title' in plan ? String(plan.title ?? '') : ''
}

/** Une la ficha con sus relaciones clínicas para que la lista no muestre
 * marcadores fijos que contradigan el perfil del paciente. */
export function enrichPatientSummaries(
  patients: PatientRecord[],
  relations: {
    cycles?: PatientCycleSummaryRow[] | null
    portals?: PatientPortalSummaryRow[] | null
    assignments?: PatientAssignmentSummaryRow[] | null
    privateNotes?: PatientPrivateSummaryRow[] | null
  },
  now = new Date(),
) {
  const nowIso = now.toISOString()
  return patients.map((patient) => {
    const activeCycle = (relations.cycles ?? [])
      .filter((cycle) => String(cycle.patient_id) === patient.id)
      .sort((first, second) => String(second.started_on).localeCompare(String(first.started_on)))[0]
    const portal = (relations.portals ?? []).find((item) => String(item.patient_id) === patient.id)
    const privateNote = (relations.privateNotes ?? []).find((item) => String(item.patient_id) === patient.id)
    const activeAssignment = (relations.assignments ?? [])
      .filter((assignment) => {
        if (String(assignment.patient_id) !== patient.id || !['assigned', 'started'].includes(String(assignment.status))) return false
        const from = String(assignment.available_from ?? '')
        const until = String(assignment.available_until ?? '')
        return Boolean(from) && from <= nowIso && (!until || until >= nowIso)
      })
      .sort((first, second) => {
        const statusOrder = Number(String(second.status) === 'started') - Number(String(first.status) === 'started')
        return statusOrder || String(first.available_from).localeCompare(String(second.available_from))
      })[0]

    return {
      ...patient,
      cycleLabel: activeCycle ? `${String(activeCycle.label)} · Activo` : 'Sin ciclo activo',
      portalAccess: portal?.enabled ? 'enabled' as const : 'disabled' as const,
      username: portal?.enabled ? String(portal.username_normalized ?? patient.username) : patient.username,
      documentNumber: String(privateNote?.document_number ?? patient.documentNumber),
      todaySession: activeAssignment ? relatedPlanTitle(activeAssignment.session_plans) || 'Sesión asignada' : null,
    }
  })
}

export async function listPatients(): Promise<PatientRecord[]> {
  if (!isSupabaseConfigured || !supabase) return readDemo()
  const { data, error } = await supabase.from('patients').select('*').order('full_name')
  if (error) throw error
  const patients = (data ?? []).map((row) => fromRow(row))
  if (!patients.length) return patients
  const patientIds = patients.map((patient) => patient.id)
  const [cyclesResult, portalsResult, assignmentsResult, privateNotesResult] = await Promise.all([
    supabase.from('treatment_cycles').select('patient_id,label,started_on').in('patient_id', patientIds).eq('status', 'active').order('started_on', { ascending: false }),
    supabase.from('patient_portal_accounts').select('patient_id,enabled,username_normalized').in('patient_id', patientIds),
    supabase.from('session_assignments').select('patient_id,available_from,available_until,status,session_plans(title)').in('patient_id', patientIds).in('status', ['assigned', 'started']),
    supabase.from('patient_private_notes').select('patient_id,document_number').in('patient_id', patientIds),
  ])
  const relationError = cyclesResult.error ?? portalsResult.error ?? assignmentsResult.error ?? privateNotesResult.error
  if (relationError) throw relationError
  return enrichPatientSummaries(patients, {
    cycles: cyclesResult.data,
    portals: portalsResult.data,
    assignments: assignmentsResult.data,
    privateNotes: privateNotesResult.data,
  })
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
