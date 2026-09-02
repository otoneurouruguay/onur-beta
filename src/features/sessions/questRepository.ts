import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { normalizeExerciseConfig } from '../exercise/types'
import type { SessionAssignmentRecord, SessionEventLogEntry } from './repository'

export type QuestPairingStatus = 'ready' | 'claimed' | 'captured' | 'expired' | 'revoked'

export interface QuestCaptureResult {
  activeSeconds: number
  skippedExercises: number
  eventLog: SessionEventLogEntry[]
}

export interface QuestPairingCreated {
  id: string
  assignmentId: string
  code: string
  status: QuestPairingStatus
  expiresAt: string
}

export interface QuestPairingRecord {
  id: string
  assignmentId: string
  status: QuestPairingStatus
  expiresAt: string
  claimedAt: string
  capturedAt: string
  capturedResult: QuestCaptureResult | null
}

export interface ClaimedQuestSession {
  pairingId: string
  deviceToken: string
  expiresAt: string
  patientLabel: string
  session: SessionAssignmentRecord
}

interface DemoPairing extends QuestPairingRecord {
  code: string
  deviceToken: string
  patientLabel: string
  session: SessionAssignmentRecord
}

const DEMO_PAIRINGS_KEY = 'onur-demo-quest-pairings-v1'
const QUEST_CODE_LENGTH = 4

function readDemoPairings(): DemoPairing[] {
  const raw = localStorage.getItem(DEMO_PAIRINGS_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) as DemoPairing[] } catch { return [] }
}

function writeDemoPairings(pairings: DemoPairing[]) {
  localStorage.setItem(DEMO_PAIRINGS_KEY, JSON.stringify(pairings))
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(2))
  const value = ((bytes[0] << 8) | bytes[1]) % (10 ** QUEST_CODE_LENGTH)
  return String(value).padStart(QUEST_CODE_LENGTH, '0')
}

function normalizeCapture(value: unknown): QuestCaptureResult | null {
  if (!value || typeof value !== 'object') return null
  const capture = value as Partial<QuestCaptureResult>
  if (!Number.isFinite(capture.activeSeconds) || !Number.isFinite(capture.skippedExercises) || !Array.isArray(capture.eventLog)) return null
  return {
    activeSeconds: Math.max(0, Math.round(Number(capture.activeSeconds))),
    skippedExercises: Math.max(0, Math.round(Number(capture.skippedExercises))),
    eventLog: capture.eventLog,
  }
}

function pairingRecord(value: Record<string, unknown>): QuestPairingRecord {
  return {
    id: String(value.id),
    assignmentId: String(value.assignmentId),
    status: value.status as QuestPairingStatus,
    expiresAt: String(value.expiresAt),
    claimedAt: String(value.claimedAt ?? ''),
    capturedAt: String(value.capturedAt ?? ''),
    capturedResult: normalizeCapture(value.capturedResult),
  }
}

export function isQuestClinicAssignment(assignment: Pick<SessionAssignmentRecord, 'mode' | 'exercises'>) {
  return assignment.mode === 'in_person'
    && assignment.exercises.length > 0
    && assignment.exercises.some((exercise) => exercise.displayMode === 'quest_browser')
}

export function getQuestBlockExercises(assignment: Pick<SessionAssignmentRecord, 'exercises'>) {
  return assignment.exercises.filter((exercise) => exercise.displayMode === 'quest_browser')
}

export function getNonQuestBlockExercises(assignment: Pick<SessionAssignmentRecord, 'exercises'>) {
  return assignment.exercises.filter((exercise) => exercise.displayMode !== 'quest_browser')
}

export function isMixedQuestClinicAssignment(assignment: Pick<SessionAssignmentRecord, 'mode' | 'exercises'>) {
  return isQuestClinicAssignment(assignment) && getNonQuestBlockExercises(assignment).length > 0
}

export function questBlockSession(assignment: SessionAssignmentRecord): SessionAssignmentRecord {
  return { ...assignment, exercises: getQuestBlockExercises(assignment) }
}

export async function createQuestSessionPairing(assignment: SessionAssignmentRecord): Promise<QuestPairingCreated> {
  if (!isQuestClinicAssignment(assignment) || assignment.status !== 'started') {
    throw new Error('Quest necesita una sesión presencial iniciada con al menos un ejercicio destinado al visor.')
  }

  if (!isSupabaseConfigured || !supabase) {
    const code = randomCode()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString()
    const created: DemoPairing = {
      id: crypto.randomUUID(),
      assignmentId: assignment.id,
      code,
      status: 'ready',
      expiresAt,
      claimedAt: '',
      capturedAt: '',
      capturedResult: null,
      deviceToken: '',
      patientLabel: assignment.patientName.split(' ').slice(0, 2).map((part, index) => index === 0 ? part : `${part[0]}.`).join(' '),
      session: questBlockSession(assignment),
    }
    const previous = readDemoPairings().map((pairing) => pairing.assignmentId === assignment.id && ['ready', 'claimed'].includes(pairing.status) ? { ...pairing, status: 'revoked' as const } : pairing)
    writeDemoPairings([created, ...previous])
    return { id: created.id, assignmentId: created.assignmentId, code, status: created.status, expiresAt }
  }

  const { data, error } = await supabase.rpc('create_quest_session_pairing', { target_assignment_id: assignment.id })
  if (error) throw error
  const value = data as Record<string, unknown>
  return {
    id: String(value.id),
    assignmentId: String(value.assignmentId),
    code: String(value.code),
    status: value.status as QuestPairingStatus,
    expiresAt: String(value.expiresAt),
  }
}

export async function getQuestSessionPairing(id: string): Promise<QuestPairingRecord> {
  if (!isSupabaseConfigured || !supabase) {
    const pairings = readDemoPairings()
    const pairing = pairings.find((item) => item.id === id)
    if (!pairing) throw new Error('Vínculo Quest no disponible.')
    if (['ready', 'claimed'].includes(pairing.status) && pairing.expiresAt <= new Date().toISOString()) {
      const expired = { ...pairing, status: 'expired' as const }
      writeDemoPairings(pairings.map((item) => item.id === id ? expired : item))
      return expired
    }
    return pairing
  }

  const { data, error } = await supabase.rpc('get_quest_session_pairing', { target_pairing_id: id })
  if (error) throw error
  return pairingRecord(data as Record<string, unknown>)
}

export async function findQuestSessionPairingForAssignment(assignmentId: string): Promise<QuestPairingRecord | null> {
  if (!isSupabaseConfigured || !supabase) {
    const pairing = readDemoPairings().find((item) => item.assignmentId === assignmentId && ['ready', 'claimed', 'captured'].includes(item.status))
    return pairing ?? null
  }

  const { data, error } = await supabase.rpc('find_quest_session_pairing_for_assignment', { target_assignment_id: assignmentId })
  if (error) throw error
  return data ? pairingRecord(data as Record<string, unknown>) : null
}

export async function claimQuestSessionPairing(code: string): Promise<ClaimedQuestSession> {
  const normalizedCode = code.trim()
  if (!/^[0-9]{4}$/.test(normalizedCode)) throw new Error('Ingresá los cuatro números del código Quest.')

  if (!isSupabaseConfigured || !supabase) {
    const pairings = readDemoPairings()
    const pairing = pairings.find((item) => item.code === normalizedCode && item.status === 'ready' && item.expiresAt > new Date().toISOString())
    if (!pairing) throw new Error('El código no existe, ya fue usado o venció.')
    const claimed: DemoPairing = {
      ...pairing,
      status: 'claimed',
      claimedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
      deviceToken: crypto.randomUUID(),
    }
    writeDemoPairings(pairings.map((item) => item.id === pairing.id ? claimed : item))
    return {
      pairingId: claimed.id,
      deviceToken: claimed.deviceToken,
      expiresAt: claimed.expiresAt,
      patientLabel: claimed.patientLabel,
      session: claimed.session,
    }
  }

  const { data, error } = await supabase.rpc('claim_quest_session_pairing', { pairing_code_input: normalizedCode })
  if (error) throw error
  const value = data as Record<string, unknown>
  const session = value.session as Record<string, unknown>
  const exercises = Array.isArray(session.exercises) ? session.exercises : []
  return {
    pairingId: String(value.pairingId),
    deviceToken: String(value.deviceToken),
    expiresAt: String(value.expiresAt),
    patientLabel: String(value.patientLabel),
    session: {
      id: String(session.id),
      patientId: '',
      patientName: String(value.patientLabel),
      treatmentCycleId: '',
      sessionPlanId: '',
      title: String(session.title),
      instructions: String(session.instructions ?? ''),
      mode: 'in_person',
      exercises: exercises
        .map((exercise) => normalizeExerciseConfig(exercise as Record<string, unknown>, 0))
        .filter((exercise) => exercise.displayMode === 'quest_browser'),
      availableFrom: '',
      availableUntil: '',
      status: 'started',
      createdAt: '',
      activeSeconds: 0,
      completedAt: '',
      initialDiscomfort: null,
      finalDiscomfort: null,
      perceivedDifficulty: null,
      patientComment: '',
      supervised: true,
    },
  }
}

export async function submitQuestSessionCapture(claim: Pick<ClaimedQuestSession, 'pairingId' | 'deviceToken'>, result: QuestCaptureResult) {
  const capture: QuestCaptureResult = {
    activeSeconds: Math.max(0, Math.round(result.activeSeconds)),
    skippedExercises: Math.max(0, Math.round(result.skippedExercises)),
    eventLog: result.eventLog,
  }
  if (!isSupabaseConfigured || !supabase) {
    const pairings = readDemoPairings()
    const pairing = pairings.find((item) => item.id === claim.pairingId && item.deviceToken === claim.deviceToken && item.status === 'claimed')
    if (!pairing) throw new Error('La estación Quest no puede enviar este resultado.')
    const captured: DemoPairing = { ...pairing, status: 'captured', capturedAt: new Date().toISOString(), capturedResult: capture }
    writeDemoPairings(pairings.map((item) => item.id === pairing.id ? captured : item))
    return pairing.id
  }
  const { data, error } = await supabase.rpc('submit_quest_session_capture', {
    target_pairing_id: claim.pairingId,
    device_token_input: claim.deviceToken,
    captured_result_input: capture,
  })
  if (error) throw error
  return String(data)
}

export async function revokeQuestSessionPairing(id: string) {
  if (!isSupabaseConfigured || !supabase) {
    const pairings = readDemoPairings()
    const pairing = pairings.find((item) => item.id === id && ['ready', 'claimed'].includes(item.status))
    if (!pairing) throw new Error('Vínculo Quest no disponible para revocar.')
    writeDemoPairings(pairings.map((item) => item.id === id ? { ...item, status: 'revoked' as const } : item))
    return id
  }
  const { data, error } = await supabase.rpc('revoke_quest_session_pairing', { target_pairing_id: id })
  if (error) throw error
  return String(data)
}
