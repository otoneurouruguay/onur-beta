import type { CycleStudyPhase } from '../documents/types'
import type { ClinicalStudySummary } from './types'

export function buildPatientStudyOverview(
  studies: ClinicalStudySummary[],
  patientId: string,
  treatmentCycleId: string,
) {
  const patientStudies = studies.filter((study) => study.patientId === patientId)
  const cycleStudies = treatmentCycleId
    ? patientStudies.filter((study) => study.treatmentCycleId === treatmentCycleId)
    : []

  const posturographyForPhase = (phase: Extract<CycleStudyPhase, 'initial' | 'final'>) => (
    cycleStudies.find((study) => study.studyType === 'posturography' && study.cyclePhase === phase)
  )

  return {
    patientStudies,
    cycleStudies,
    initialPosturography: posturographyForPhase('initial'),
    finalPosturography: posturographyForPhase('final'),
    reports: patientStudies.filter((study) => study.studyType === 'vhit'),
  }
}
