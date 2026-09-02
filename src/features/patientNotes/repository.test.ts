import { beforeEach, describe, expect, it } from 'vitest'
import { archivePatientReminderNote, createPatientReminderNote, listPatientReminderNotes, updatePatientReminderNote } from './repository'

describe('notas recordatorias del paciente', () => {
  beforeEach(() => localStorage.clear())

  it('permite varias notas opcionales, editarlas y archivarlas', async () => {
    const first = await createPatientReminderNote({ patientId: 'patient-1', body: 'Intentar marcha con giros.' })
    await createPatientReminderNote({ patientId: 'patient-1', body: 'Revisar tolerancia visual.' })
    expect(await listPatientReminderNotes('patient-1')).toHaveLength(2)
    await updatePatientReminderNote({ patientId: 'patient-1', noteId: first.id, body: 'Intentar marcha con giros suaves.' })
    expect((await listPatientReminderNotes('patient-1')).find((note) => note.id === first.id)?.body).toContain('suaves')
    await archivePatientReminderNote({ patientId: 'patient-1', noteId: first.id })
    expect(await listPatientReminderNotes('patient-1')).toHaveLength(1)
  })

  it('no exige crear una nota y rechaza textos vacíos', async () => {
    expect(await listPatientReminderNotes('patient-2')).toEqual([])
    await expect(createPatientReminderNote({ patientId: 'patient-2', body: '   ' })).rejects.toThrow('Escribí el recordatorio')
  })
})
