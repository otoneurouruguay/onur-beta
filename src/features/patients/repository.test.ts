import { beforeEach, describe, expect, it } from 'vitest'
import { getPortalAccount } from '../access/repository'
import { deletePatient, getPatient, listPatients, updatePatient } from './repository'

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
