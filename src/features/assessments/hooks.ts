import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AssessmentResponseMap } from './questions'
import {
  cancelAssessment,
  completeAssessment,
  createAssessmentAssignment,
  getAssessment,
  listCurrentPatientAssessments,
  listPatientAssessments,
  listProfessionalAssessments,
  savePatientAssessmentDraft,
} from './repository'

export const assessmentKeys = {
  patient: (id: string) => ['assessments', id] as const,
  detail: (id: string) => ['assessment', id] as const,
  all: ['assessments'] as const,
  current: ['patient-assessments-current'] as const,
}

export function usePatientAssessments(patientId: string) { return useQuery({ queryKey: assessmentKeys.patient(patientId), queryFn: () => listPatientAssessments(patientId), enabled: Boolean(patientId) }) }
export function useProfessionalAssessments() { return useQuery({ queryKey: assessmentKeys.all, queryFn: listProfessionalAssessments }) }
export function useCurrentPatientAssessments() { return useQuery({ queryKey: assessmentKeys.current, queryFn: listCurrentPatientAssessments }) }
export function useAssessment(id: string) { return useQuery({ queryKey: assessmentKeys.detail(id), queryFn: () => getAssessment(id), enabled: Boolean(id) }) }

function invalidateAssessments(client: ReturnType<typeof useQueryClient>, patientId: string, id?: string) {
  client.invalidateQueries({ queryKey: assessmentKeys.patient(patientId) })
  client.invalidateQueries({ queryKey: assessmentKeys.all })
  client.invalidateQueries({ queryKey: assessmentKeys.current })
  if (id) client.invalidateQueries({ queryKey: assessmentKeys.detail(id) })
}

export function useCreateAssessment(patientId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: createAssessmentAssignment, onSuccess: (item) => invalidateAssessments(client, patientId, item.id) })
}

export function useSaveAssessmentDraft(patientId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, responses }: { id: string; responses: AssessmentResponseMap }) => savePatientAssessmentDraft(id, responses), onSuccess: (item) => invalidateAssessments(client, patientId, item.id) })
}

export function useCompleteAssessment(patientId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, responses }: { id: string; responses: AssessmentResponseMap }) => completeAssessment(id, responses), onSuccess: (item) => invalidateAssessments(client, patientId, item.id) })
}

export function useCancelAssessment(patientId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: cancelAssessment, onSuccess: (item) => invalidateAssessments(client, patientId, item.id) })
}
