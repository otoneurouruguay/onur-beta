import { normalizeExerciseConfig } from '../exercise/types'
import type { SessionFormValues } from './schema'

export interface SessionBuilderDraft {
  values: SessionFormValues
  selectedExerciseIndex: number
  updatedAt: string
}

export function sessionBuilderDraftKey(patientId: string, assignmentId?: string) {
  return `onur-session-builder-draft-v1:${patientId}:${assignmentId ?? 'new'}`
}

export function readSessionBuilderDraft(
  key: string,
  storage: Pick<Storage, 'getItem'> = sessionStorage,
): SessionBuilderDraft | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionBuilderDraft>
    const values = parsed.values as Partial<SessionFormValues> | undefined
    if (!values || !Array.isArray(values.exercises) || typeof values.title !== 'string' || typeof values.mode !== 'string') return null
    const exercises = values.exercises.map((exercise) => normalizeExerciseConfig(exercise, 10))
    const selectedExerciseIndex = Math.max(0, Math.min(Number(parsed.selectedExerciseIndex ?? 0), Math.max(0, exercises.length - 1)))
    return {
      values: {
        kind: values.kind === 'free_note' ? 'free_note' : 'exercise',
        title: values.title,
        instructions: String(values.instructions ?? ''),
        mode: values.mode === 'in_person' ? 'in_person' : 'home',
        treatmentCycleId: String(values.treatmentCycleId ?? ''),
        availableFrom: String(values.availableFrom ?? ''),
        availableUntil: String(values.availableUntil ?? ''),
        exercises,
      },
      selectedExerciseIndex,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return null
  }
}

export function writeSessionBuilderDraft(
  key: string,
  draft: Pick<SessionBuilderDraft, 'values' | 'selectedExerciseIndex'>,
  storage: Pick<Storage, 'setItem'> = sessionStorage,
) {
  storage.setItem(key, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }))
}

export function clearSessionBuilderDraft(key: string, storage: Pick<Storage, 'removeItem'> = sessionStorage) {
  storage.removeItem(key)
}
