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
    peakDiscomfort: item.peakDiscomfort,
    finalDiscomfort: item.finalDiscomfort,
    recoveryMinutes: item.recoveryMinutes,
    delayedResponse: item.delayedResponse,
    progressionDecision: item.progressionDecision,
    perceivedDifficulty: item.perceivedDifficulty,
    patientComment: item.patientComment,
    professionalObservation: item.professionalObservation,
    eventLog: item.eventLog,
    revokedAt: item.revokedAt,
    revokedReason: item.revokedReason,
    registeredRetrospectively: item.registeredRetrospectively,
    actualPerformedAt: item.actualPerformedAt,
    retrospectiveRecordedAt: item.retrospectiveRecordedAt,
    retrospectiveRecordedBy: item.retrospectiveRecordedBy,
    retrospectiveWithoutMetrics: item.retrospectiveWithoutMetrics,
    retrospectiveDevice: item.retrospectiveDevice,
    cancelledAt: item.cancelledAt,
    cancelledBy: item.cancelledBy,
    cancellationReason: item.cancellationReason,
  }
}
