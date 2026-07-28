import { beforeEach, describe, expect, it } from 'vitest'
import { applyExercisePurpose } from '../exercise/compatibility'
import { defaultExerciseConfig } from '../exercise/types'
import { createPatient, getPatient } from '../patients/repository'
import { claimQuestSessionPairing, createQuestSessionPairing, getQuestSessionPairing, submitQuestSessionCapture } from './questRepository'
import {
  completeSessionAssignment,
  completeSupervisedInPersonSession,
  createSessionAssignment,
  createTreatmentCycle,
  deleteSessionAssignment,
  listSessionAssignments,
  startSessionAssignment,
  startSupervisedInPersonSession,
  updateSessionAssignment,
} from './repository'
import { validateSession, type SessionFormValues } from './schema'

function visualFor(
  purpose: 'optokinetic' | 'saccades',
  overrides: Partial<typeof defaultExerciseConfig> = {},
) {
  return { ...applyExercisePurpose(defaultExerciseConfig, purpose), ...overrides }
}

describe('simulación integral de una consulta nueva', () => {
  beforeEach(() => localStorage.clear())

  it('recorre alta, ciclo, sesiones multidispositivo, ejecución, cierre e historial protegido', async () => {
    const { patient } = await createPatient({
      fullName: 'Paciente Simulado ONUr',
      birthDate: '1952-04-12',
      insurer: 'Cobertura ficticia',
      affiliateNumber: 'SIM-001',
      phone: '',
      status: 'active',
      privateNotes: 'Registro sintético exclusivo de prueba.',
      createPortalAccount: false,
      username: '',
      temporaryCi: '',
    })
    expect((await getPatient(patient.id))?.fullName).toBe('Paciente Simulado ONUr')

    const cycle = await createTreatmentCycle(patient.id, {
      label: 'Ciclo vestibular simulado',
      reason: 'Consulta ficticia',
      objectives: 'Comprobar el flujo técnico completo.',
      startedOn: '2026-07-27',
    })

    const homeValues: SessionFormValues = {
      title: 'Domicilio · repeticiones y bloque VR Box',
      instructions: 'Realizar primero sin visor y luego colocar VR Box.',
      mode: 'home',
      treatmentCycleId: cycle.id,
      availableFrom: '2026-07-27',
      availableUntil: '',
      exercises: [
        {
          ...applyExercisePurpose(defaultExerciseConfig, 'gaze_substitution_remembered'),
          name: 'Objetivo recordado · manual',
          doseMode: 'repetitions',
          targetRepetitions: 8,
          advanceMode: 'manual',
          rounds: 1,
          restSeconds: 10,
        },
        visualFor('optokinetic', {
          name: 'Barras · VR Box 2D',
          displayMode: 'vr_box',
          cardboardEnabled: false,
          doseMode: 'time',
          durationSeconds: 20,
          advanceMode: 'automatic',
          rounds: 1,
          restSeconds: 0,
        }),
      ],
    }
    expect(validateSession(homeValues)).toEqual({})
    let home = await createSessionAssignment(patient.id, homeValues)
    home = await updateSessionAssignment(home, { ...homeValues, title: 'Domicilio · plan confirmado' })
    await startSessionAssignment(home)
    const startedHome = (await listSessionAssignments(patient.id)).find((item) => item.id === home.id)!
    await expect(deleteSessionAssignment(startedHome)).rejects.toThrow(/historial/i)
    await completeSessionAssignment({
      assignment: startedHome,
      activeSeconds: 20,
      skippedExercises: 0,
      initialDiscomfort: 2,
      finalDiscomfort: 3,
      perceivedDifficulty: 2,
      patientComment: 'Ejecución domiciliaria simulada.',
      eventLog: [],
    })

    const cardboardProfile = {
      id: 'galaxy-s21-vrbox',
      name: 'Galaxy S21+ · VR Box clínica',
      imageSeparationPercent: -4,
      verticalOffsetPercent: -2,
      horizontalFovDegrees: 92,
      verticalFovDegrees: 78,
      lensDistortionPercent: 18,
    }
    const cardboardValues: SessionFormValues = {
      title: 'Clínica · Cardboard 3DoF',
      instructions: 'Sentado, superficie firme y supervisión directa.',
      mode: 'in_person',
      treatmentCycleId: cycle.id,
      availableFrom: '2026-07-27',
      availableUntil: '',
      exercises: [
        {
          ...defaultExerciseConfig,
          name: 'RVO x1 · Cardboard',
          displayMode: 'vr_box',
          cardboardEnabled: true,
          cardboardViewerProfile: cardboardProfile,
          doseMode: 'time',
          durationSeconds: 20,
          advanceMode: 'automatic',
          posture: 'seated',
          surface: 'firm',
          supervision: 'direct_clinician',
          rounds: 1,
          restSeconds: 10,
        },
        visualFor('saccades', {
          name: 'Sacadas · Cardboard',
          displayMode: 'vr_box',
          cardboardEnabled: true,
          cardboardViewerProfile: cardboardProfile,
          doseMode: 'time',
          durationSeconds: 20,
          advanceMode: 'automatic',
          posture: 'seated',
          surface: 'firm',
          supervision: 'direct_clinician',
          rounds: 1,
          restSeconds: 0,
        }),
      ],
    }
    expect(validateSession(cardboardValues)).toEqual({})
    const cardboard = await createSessionAssignment(patient.id, cardboardValues)
    expect(cardboard.exercises[0].cardboardViewerProfile).toEqual(cardboardProfile)

    const quest2dValues: SessionFormValues = {
      title: 'Clínica · Quest visual 2D',
      instructions: 'Ejercicios visuales no inmersivos.',
      mode: 'in_person',
      treatmentCycleId: cycle.id,
      availableFrom: '2026-07-27',
      availableUntil: '',
      exercises: [
        visualFor('saccades', { displayMode: 'quest_browser', doseMode: 'time', durationSeconds: 10, advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician', rounds: 1, restSeconds: 5 }),
        visualFor('optokinetic', { displayMode: 'quest_browser', doseMode: 'time', durationSeconds: 10, advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician', rounds: 1, restSeconds: 0 }),
      ],
    }
    expect(validateSession(quest2dValues)).toEqual({})
    const quest2d = await createSessionAssignment(patient.id, quest2dValues)
    await deleteSessionAssignment(quest2d)

    const immersiveValues: SessionFormValues = {
      title: 'Clínica · Quest 360° múltiple',
      instructions: 'Confirmar WebXR por cada escenario.',
      mode: 'in_person',
      treatmentCycleId: cycle.id,
      availableFrom: '2026-07-27',
      availableUntil: '',
      exercises: [
        applyExercisePurpose({ ...defaultExerciseConfig, immersiveScenarioId: 'street_quiet' }, 'immersive_context'),
        applyExercisePurpose({ ...defaultExerciseConfig, immersiveScenarioId: 'crosswalk_static' }, 'immersive_context'),
      ],
    }
    expect(validateSession(immersiveValues)).toEqual({})
    const immersive = await createSessionAssignment(patient.id, immersiveValues)
    await startSupervisedInPersonSession(immersive, 1)
    const startedImmersive = (await listSessionAssignments(patient.id)).find((item) => item.id === immersive.id)!
    const pairing = await createQuestSessionPairing(startedImmersive)
    const claim = await claimQuestSessionPairing(pairing.code)
    await submitQuestSessionCapture(claim, { activeSeconds: 60, skippedExercises: 0, eventLog: [] })
    expect((await getQuestSessionPairing(pairing.id)).status).toBe('captured')
    await completeSupervisedInPersonSession({
      assignment: startedImmersive,
      activeSeconds: 60,
      skippedExercises: 0,
      finalDiscomfort: 2,
      perceivedDifficulty: 2,
      patientComment: 'Exposición Quest simulada.',
      professionalObservation: 'Flujo técnico completado.',
      eventLog: [],
    })

    const saved = await listSessionAssignments(patient.id)
    expect(saved.find((item) => item.id === home.id)).toMatchObject({ status: 'completed', title: 'Domicilio · plan confirmado' })
    expect(saved.find((item) => item.id === immersive.id)).toMatchObject({ status: 'completed', supervised: true, activeSeconds: 60 })
    expect(saved.some((item) => item.id === quest2d.id)).toBe(false)
    expect(saved.find((item) => item.id === cardboard.id)?.exercises).toHaveLength(2)
  })
})
