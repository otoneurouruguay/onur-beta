import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getClinicalEpisode, listClinicalEpisodes, saveClinicalEpisode } from './repository'
import type { ClinicalEpisodeValues } from './types'

export const clinicalEpisodeKeys = {
  patient: (patientId: string) => ['clinical-episodes', patientId] as const,
  detail: (patientId: string, cycleId: string) => ['clinical-episodes', patientId, cycleId] as const,
}

export function useClinicalEpisode(patientId: string, cycleId: string) {
  return useQuery({ queryKey: clinicalEpisodeKeys.detail(patientId, cycleId), queryFn: () => getClinicalEpisode(patientId, cycleId), enabled: Boolean(patientId && cycleId) })
}

export function useClinicalEpisodes(patientId: string) {
  return useQuery({ queryKey: clinicalEpisodeKeys.patient(patientId), queryFn: () => listClinicalEpisodes(patientId), enabled: Boolean(patientId) })
}

export function useSaveClinicalEpisode(patientId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (values: ClinicalEpisodeValues) => saveClinicalEpisode(patientId, values),
    onSuccess: async (record) => {
      client.setQueryData(clinicalEpisodeKeys.detail(patientId, record.treatmentCycleId), record)
      await client.invalidateQueries({ queryKey: clinicalEpisodeKeys.patient(patientId) })
    },
  })
}
