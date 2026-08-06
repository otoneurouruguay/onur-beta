import type { SessionAssignmentRecord } from '../sessions/repository'

export function sessionReportSnapshotItem(item: SessionAssignmentRecord) {
  return {
    title: item.title,
    kind: item.kind ?? 'exercise',
    mode: item.mode,
    status: item.status,
    availableFrom: item.availableFrom,
    activeSeconds: item.activeSeconds,
    exerciseCount: item.exercises.length,
    initialDiscomfort: item.initialDiscomfort,
    finalDiscomfort: item.finalDiscomfort,
    perceivedDifficulty: item.perceivedDifficulty,
    patientComment: item.patientComment,
    professionalObservation: item.professionalObservation,
    revokedAt: item.revokedAt,
    revokedReason: item.revokedReason,
  }
}
