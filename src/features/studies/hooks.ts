import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { finalizeClinicalStudy, getStudyReview, listClinicalStudies, listStatisticalSuggestions, reviewStatisticalSuggestion, saveStudyImport } from './repository'

export const studyKeys = { all:['studies'] as const,detail: (id: string) => ['study', id] as const, suggestions: ['statistical-suggestions'] as const }

export function useClinicalStudies(){return useQuery({queryKey:studyKeys.all,queryFn:listClinicalStudies})}

export function useStudyReview(studyId: string) {
  return useQuery({ queryKey: studyKeys.detail(studyId), queryFn: () => getStudyReview(studyId), enabled: Boolean(studyId) })
}

export function useSaveStudyImport(studyId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: saveStudyImport, onSuccess: () => { client.invalidateQueries({ queryKey: studyKeys.detail(studyId) }); client.invalidateQueries({ queryKey: studyKeys.all }); client.invalidateQueries({ queryKey: studyKeys.suggestions }) } })
}

export function useFinalizeStudy(studyId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => finalizeClinicalStudy(studyId), onSuccess: () => {client.invalidateQueries({ queryKey: studyKeys.detail(studyId) });client.invalidateQueries({queryKey:studyKeys.all})} })
}

export function useStatisticalSuggestions() {
  return useQuery({ queryKey: studyKeys.suggestions, queryFn: listStatisticalSuggestions })
}

export function useReviewSuggestion() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, status, professionalText }: { id: string; status: 'accepted' | 'edited' | 'discarded'; professionalText?: string }) => reviewStatisticalSuggestion(id, status, professionalText), onSuccess: () => client.invalidateQueries({ queryKey: studyKeys.suggestions }) })
}
