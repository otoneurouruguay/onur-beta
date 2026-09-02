import type { SessionEventLogEntry } from './repository'

export interface MixedRunnerResult {
  activeSeconds: number
  skippedExercises: number
  eventLog: SessionEventLogEntry[]
}

export function mergeMixedRunnerResults(prefix: MixedRunnerResult | null, quest: MixedRunnerResult, questExerciseOffset: number): MixedRunnerResult {
  const remappedQuestLog = quest.eventLog.map((entry) => entry.exercise_index == null ? entry : { ...entry, exercise_index: entry.exercise_index + questExerciseOffset })
  return {
    activeSeconds: (prefix?.activeSeconds ?? 0) + quest.activeSeconds,
    skippedExercises: (prefix?.skippedExercises ?? 0) + quest.skippedExercises,
    eventLog: [...(prefix?.eventLog ?? []), ...remappedQuestLog],
  }
}
