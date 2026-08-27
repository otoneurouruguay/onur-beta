import type { ExerciseConfig } from '../exercise/types'
import type { SessionAssignmentRecord, SessionEventLogEntry } from './repository'

export type ExerciseHistoryStatus = 'completed' | 'partial' | 'skipped' | 'recorded' | 'unavailable'

export interface ExerciseHistoryItem {
  exercise: ExerciseConfig
  index: number
  status: ExerciseHistoryStatus
  events: SessionEventLogEntry[]
  event?: SessionEventLogEntry
  omissionReason?: string
}

const exerciseEvents = new Set<SessionEventLogEntry['type']>(['exercise_completed', 'exercise_partial', 'exercise_skipped'])

export function buildExerciseHistory(assignment: Pick<SessionAssignmentRecord, 'exercises' | 'eventLog'>): ExerciseHistoryItem[] {
  const events = assignment.eventLog ?? []
  const retrospective = [...events].reverse().find((event) => event.type === 'retrospective_session_recorded')

  return assignment.exercises.map((exercise, index) => {
    const matchingEvents = events.filter((candidate) => candidate.exercise_index === index && exerciseEvents.has(candidate.type))
    const event = matchingEvents.at(-1)
    if (event) {
      const status: ExerciseHistoryStatus = matchingEvents.every((candidate) => candidate.type === 'exercise_completed')
        ? 'completed'
        : matchingEvents.every((candidate) => candidate.type === 'exercise_skipped')
          ? 'skipped'
          : 'partial'
      return { exercise, index, status, events: matchingEvents, event }
    }

    if (retrospective?.performed_exercise_indexes?.includes(index)) return { exercise, index, status: 'recorded', events: [retrospective], event: retrospective }
    const omission = retrospective?.omitted_exercises?.find((item) => item.exerciseIndex === index)
    if (omission && retrospective) return { exercise, index, status: 'skipped', events: [retrospective], event: retrospective, omissionReason: omission.reason }
    return { exercise, index, status: 'unavailable', events: [] }
  })
}

export function exerciseDoseLabel(exercise: ExerciseConfig) {
  const dose = exercise.doseMode === 'repetitions'
    ? `${exercise.targetRepetitions} repeticiones`
    : `${exercise.durationSeconds} s`
  return `${dose} × ${exercise.rounds}${exercise.rounds === 1 ? ' serie' : ' series'}`
}

export function formatActiveTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  if (minutes === 0) return `${remainder} s`
  if (remainder === 0) return `${minutes} min`
  return `${minutes} min ${remainder} s`
}
