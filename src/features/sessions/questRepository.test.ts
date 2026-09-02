import { beforeEach, describe, expect, it } from 'vitest'
import { applyExercisePurpose } from '../exercise/compatibility'
import { defaultExerciseConfig } from '../exercise/types'
import { createSessionAssignment, createTreatmentCycle, listSessionAssignments, startSupervisedInPersonSession } from './repository'
import { claimQuestSessionPairing, createQuestSessionPairing, findQuestSessionPairingForAssignment, getQuestSessionPairing, submitQuestSessionCapture } from './questRepository'

async function questAssignment(patientId = 'patient-quest') {
  const cycle = await createTreatmentCycle(patientId, { label: 'Ciclo Quest', reason: '', objectives: '', startedOn: '2026-07-21' })
  const assignment = await createSessionAssignment(patientId, {
    title: 'Sesión Quest clínica',
    instructions: 'Supervisión directa.',
    mode: 'in_person',
    treatmentCycleId: cycle.id,
    availableFrom: '2026-07-21',
    availableUntil: '',
    exercises: [{
      ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'),
      displayMode: 'quest_browser',
      doseMode: 'time',
      advanceMode: 'automatic',
      posture: 'seated',
      surface: 'firm',
      supervision: 'direct_clinician',
    }],
  })
  await startSupervisedInPersonSession(assignment, 2)
  return (await listSessionAssignments(patientId))[0]
}

describe('estación Quest clínica en modo demo', () => {
  beforeEach(() => localStorage.clear())

  it('vincula, reclama y captura sin credenciales del paciente', async () => {
    const assignment = await questAssignment()
    const pairing = await createQuestSessionPairing(assignment)
    expect(pairing.code).toMatch(/^[0-9]{4}$/)
    expect((await getQuestSessionPairing(pairing.id)).status).toBe('ready')

    const claim = await claimQuestSessionPairing(pairing.code)
    expect(claim).toMatchObject({ pairingId: pairing.id, patientLabel: 'Paciente' })
    expect(claim.session.exercises[0].displayMode).toBe('quest_browser')
    expect((await getQuestSessionPairing(pairing.id)).status).toBe('claimed')

    await submitQuestSessionCapture(claim, { activeSeconds: 41.7, skippedExercises: 1, eventLog: [] })
    expect(await getQuestSessionPairing(pairing.id)).toMatchObject({
      status: 'captured',
      capturedResult: { activeSeconds: 42, skippedExercises: 1, eventLog: [] },
    })
    expect(await findQuestSessionPairingForAssignment(assignment.id)).toMatchObject({ id: pairing.id, status: 'captured' })
  })

  it('rechaza sesiones domiciliarias o no iniciadas', async () => {
    const cycle = await createTreatmentCycle('patient-home', { label: 'Ciclo 1', reason: '', objectives: '', startedOn: '2026-07-21' })
    const assignment = await createSessionAssignment('patient-home', { title: 'Sesión hogar', instructions: '', mode: 'home', treatmentCycleId: cycle.id, availableFrom: '2026-07-21', availableUntil: '', exercises: [defaultExerciseConfig] })
    await expect(createQuestSessionPairing(assignment)).rejects.toThrow(/sesión presencial iniciada/i)
  })

  it('en una sesión mixta entrega al visor solamente el bloque Quest', async () => {
    const patientId = 'patient-mixed-quest'
    const cycle = await createTreatmentCycle(patientId, { label: 'Ciclo mixto', reason: '', objectives: '', startedOn: '2026-09-01' })
    const questExercise = {
      ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'),
      name: 'Barras Quest', displayMode: 'quest_browser' as const, doseMode: 'time' as const, advanceMode: 'automatic' as const,
      posture: 'seated' as const, surface: 'firm' as const, supervision: 'direct_clinician' as const,
    }
    const created = await createSessionAssignment(patientId, {
      title: 'Sesión PC y Quest', instructions: '', mode: 'in_person', treatmentCycleId: cycle.id,
      availableFrom: '2026-09-01', availableUntil: '', exercises: [{ ...defaultExerciseConfig, name: 'RVO en PC' }, questExercise],
    })
    await startSupervisedInPersonSession(created, 1)
    const assignment = (await listSessionAssignments(patientId)).find((item) => item.id === created.id)!
    const pairing = await createQuestSessionPairing(assignment)
    const claim = await claimQuestSessionPairing(pairing.code)

    expect(claim.session.exercises).toHaveLength(1)
    expect(claim.session.exercises[0]).toMatchObject({ name: 'Barras Quest', displayMode: 'quest_browser' })
  })

  it('invalida el código después del primer uso', async () => {
    const assignment = await questAssignment('patient-single-use')
    const pairing = await createQuestSessionPairing(assignment)
    await claimQuestSessionPairing(pairing.code)
    await expect(claimQuestSessionPairing(pairing.code)).rejects.toThrow(/usado o venció/i)
  })
})
