import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { archivePatientReminderNote, createPatientReminderNote, listPatientReminderNotes, updatePatientReminderNote } from './repository'

const notesKey = (patientId: string) => ['patient-reminder-notes', patientId] as const

export function usePatientReminderNotes(patientId: string) {
  return useQuery({ queryKey: notesKey(patientId), queryFn: () => listPatientReminderNotes(patientId), enabled: Boolean(patientId) })
}

export function useCreatePatientReminderNote(patientId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (body: string) => createPatientReminderNote({ patientId, body }), onSuccess: () => client.invalidateQueries({ queryKey: notesKey(patientId) }) })
}

export function useUpdatePatientReminderNote(patientId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: { noteId: string; body: string }) => updatePatientReminderNote({ patientId, ...input }), onSuccess: () => client.invalidateQueries({ queryKey: notesKey(patientId) }) })
}

export function useArchivePatientReminderNote(patientId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (noteId: string) => archivePatientReminderNote({ patientId, noteId }), onSuccess: () => client.invalidateQueries({ queryKey: notesKey(patientId) }) })
}
