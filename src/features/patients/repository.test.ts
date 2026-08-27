import { beforeEach, describe, expect, it } from 'vitest'
import { getPortalAccount } from '../access/repository'
import { deletePatient, enrichPatientSummaries, getPatient, listPatients, updatePatient } from './repository'

describe('eliminación demo de pacientes', () => {
  beforeEach(() => localStorage.clear())

  it('elimina el paciente y lo quita del listado persistido', async () => {
    const patients = await listPatients()
    const patient = patients[0]

    await deletePatient(patient.id)

    expect((await listPatients()).some((item) => item.id === patient.id)).toBe(false)
  })

  it('rechaza la eliminación de un paciente inexistente', async () => {
    await expect(deletePatient('patient-that-does-not-exist')).rejects.toThrow('Paciente no encontrado.')
  })

  it('guarda la cédula y permite habilitar el acceso después de crear el perfil', async () => {
    const patient = (await listPatients())[0]

    await updatePatient(patient.id, {
      fullName: patient.fullName,
      documentNumber: '12345678',
      birthDate: patient.birthDate,
      insurer: patient.insurer,
      affiliateNumber: patient.affiliateNumber,
      phone: patient.phone,
      status: patient.status,
      privateNotes: patient.privateNotes,
      createPortalAccount: true,
      username: 'pacienteprueba',
      temporaryCi: '12345678',
    })

    expect((await getPatient(patient.id))?.documentNumber).toBe('12345678')
    expect(await getPortalAccount(patient.id)).toMatchObject({
      username: 'pacienteprueba',
      enabled: true,
      mustChangePin: true,
    })
  })
})

describe('resumen clínico del listado', () => {
  beforeEach(() => localStorage.clear())

  it('muestra el ciclo, portal y sesión reales en vez de valores fijos', async () => {
    const patient = (await listPatients())[0]
    const result = enrichPatientSummaries([patient], {
      cycles: [{ patient_id: patient.id, label: 'Ciclo 3', started_on: '2026-08-20' }],
      portals: [{ patient_id: patient.id, enabled: true, username_normalized: 'paciente' }],
      assignments: [{ patient_id: patient.id, available_from: '2026-08-26T00:00:00.000Z', available_until: '2026-08-27T23:59:59.000Z', status: 'assigned', session_plans: { title: 'Sesión vestibular' } }],
      privateNotes: [{ patient_id: patient.id, document_number: '4475592' }],
    }, new Date('2026-08-26T15:00:00.000Z'))

    expect(result[0]).toMatchObject({ cycleLabel: 'Ciclo 3 · Activo', portalAccess: 'enabled', todaySession: 'Sesión vestibular', documentNumber: '4475592' })
  })
})
