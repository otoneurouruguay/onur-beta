import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { confirmExtraction, discardExtraction, getExtractionForStudy, markExtractionManual, reopenExtraction, replaceExtractionCandidates, saveExtractionReview, type ExtractionReviewRecord } from './repository'
import type { LocalExtractionDraft } from './types'

export const extractionKeys = { study: (id: string) => ['document-extraction', id] as const }
export function useStudyExtraction(studyId: string) { return useQuery({ queryKey: extractionKeys.study(studyId), queryFn: () => getExtractionForStudy(studyId), enabled: Boolean(studyId) }) }
export function useSaveExtraction(studyId: string) { const client = useQueryClient(); return useMutation({ mutationFn: (draft: ExtractionReviewRecord) => saveExtractionReview(draft), onSuccess: () => client.invalidateQueries({ queryKey: extractionKeys.study(studyId) }) }) }
export function useConfirmExtraction(studyId: string) { const client = useQueryClient(); return useMutation({ mutationFn: confirmExtraction, onSuccess: () => { client.invalidateQueries({ queryKey: extractionKeys.study(studyId) }); client.invalidateQueries({ queryKey: ['study', studyId] }) } }) }
export function useManualExtraction(studyId: string) { const client = useQueryClient(); return useMutation({ mutationFn: markExtractionManual, onSuccess: () => client.invalidateQueries({ queryKey: extractionKeys.study(studyId) }) }) }
export function useDiscardExtraction(studyId: string) { const client = useQueryClient(); return useMutation({ mutationFn: discardExtraction, onSuccess: () => client.invalidateQueries({ queryKey: extractionKeys.study(studyId) }) }) }
export function useReopenExtraction(studyId: string) { const client = useQueryClient(); return useMutation({ mutationFn: reopenExtraction, onSuccess: () => { client.invalidateQueries({ queryKey: extractionKeys.study(studyId) }); client.invalidateQueries({ queryKey: ['study', studyId] }) } }) }
export function useReplaceExtraction(studyId: string) { const client = useQueryClient(); return useMutation({ mutationFn: ({ jobId, draft }: { jobId: string; draft: LocalExtractionDraft }) => replaceExtractionCandidates(jobId, draft), onSuccess: () => client.invalidateQueries({ queryKey: extractionKeys.study(studyId) }) }) }
