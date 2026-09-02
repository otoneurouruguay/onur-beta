import { describe, expect, it } from 'vitest'
import { applyExercisePurpose } from '../exercise/compatibility'
import { defaultExerciseConfig } from '../exercise/types'
import { analyzeSessionSequence, orderExercisesForQuest, orderExercisesForVrBox } from './sequence'

const repetitions = { ...defaultExerciseConfig, name: 'Sentarse y pararse', doseMode: 'repetitions' as const, displayMode: 'standard' as const }
const vrBox = { ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'), name: 'Optocinético VR', doseMode: 'time' as const, displayMode: 'vr_box' as const, advanceMode: 'automatic' as const }
const cardboard = { ...vrBox, name: 'Optocinético Cardboard', cardboardEnabled: true }
const standardTimed = { ...defaultExerciseConfig, name: 'Seguimiento 2D', doseMode: 'time' as const, displayMode: 'standard' as const }
const quest = { ...vrBox, name: 'Optocinético Quest', displayMode: 'quest_browser' as const }

describe('secuencia de equipamiento VR Box', () => {
  it('advierte cuando habría que colocar, retirar y volver a colocar el visor', () => {
    expect(analyzeSessionSequence([vrBox, repetitions, vrBox])).toMatchObject({ mixesRepetitionsAndVrBox: true, optimizedForVrBox: false, visorChanges: 4 })
  })

  it('ordena repeticiones antes del bloque temporizado VR', () => {
    const ordered = orderExercisesForVrBox([vrBox, repetitions, vrBox])
    expect(ordered.map((exercise) => exercise.name)).toEqual(['Sentarse y pararse', 'Optocinético VR', 'Optocinético VR'])
    expect(analyzeSessionSequence(ordered)).toMatchObject({ optimizedForVrBox: true, visorChanges: 2 })
  })

  it('detecta el cambio logístico entre VR Box y Cardboard', () => {
    expect(analyzeSessionSequence([vrBox, cardboard])).toMatchObject({ mixesVrBoxProfiles: true, visorChanges: 4 })
    expect(analyzeSessionSequence([cardboard, cardboard])).toMatchObject({ mixesVrBoxProfiles: false, visorChanges: 2 })
  })

  it.each([
    ['solo repeticiones', [repetitions], { mixesRepetitionsAndVrBox: false, optimizedForVrBox: true, visorChanges: 0 }],
    ['solo tiempo 2D', [standardTimed], { mixesRepetitionsAndVrBox: false, optimizedForVrBox: true, visorChanges: 0 }],
    ['solo bloque VR', [vrBox, vrBox], { mixesRepetitionsAndVrBox: false, optimizedForVrBox: true, visorChanges: 2 }],
    ['repeticiones y luego VR', [repetitions, standardTimed, vrBox], { mixesRepetitionsAndVrBox: true, optimizedForVrBox: true, visorChanges: 2 }],
    ['VR y luego repeticiones', [vrBox, repetitions], { mixesRepetitionsAndVrBox: true, optimizedForVrBox: false, visorChanges: 2 }],
    ['VR intercalado', [vrBox, repetitions, vrBox], { mixesRepetitionsAndVrBox: true, optimizedForVrBox: false, visorChanges: 4 }],
    ['VR intercalado con tarea 2D temporizada', [vrBox, standardTimed, vrBox], { mixesRepetitionsAndVrBox: false, mixesVrBoxAndNonVrBox: true, optimizedForVrBox: false, visorChanges: 4 }],
  ])('analiza %s', (_label, exercises, expected) => expect(analyzeSessionSequence(exercises)).toMatchObject(expected))

  it('conserva el orden relativo dentro de cada bloque al optimizar', () => {
    const rep2 = { ...repetitions, name: 'Marcha asistida' }
    const timed2 = { ...standardTimed, name: 'Sacadas 2D' }
    const vr2 = { ...vrBox, name: 'Optocinético VR' }
    const ordered = orderExercisesForVrBox([vr2, timed2, rep2, vrBox, standardTimed, repetitions])
    expect(ordered.map((exercise) => exercise.name)).toEqual([
      'Marcha asistida', 'Sentarse y pararse', 'Sacadas 2D', 'Seguimiento 2D', 'Optocinético VR', 'Optocinético VR',
    ])
  })

  it('agrupa Quest al final y conserva el orden clínico dentro de ambos bloques', () => {
    const ordered = orderExercisesForQuest([quest, repetitions, { ...quest, name: 'Quest 2' }, standardTimed])
    expect(ordered.map((exercise) => exercise.name)).toEqual(['Sentarse y pararse', 'Seguimiento 2D', 'Optocinético Quest', 'Quest 2'])
    expect(analyzeSessionSequence(ordered)).toMatchObject({ mixesQuestAndNonQuest: true, questBlockAtEnd: true })
    expect(analyzeSessionSequence([quest, repetitions])).toMatchObject({ questBlockAtEnd: false })
  })

  it('recorre exhaustivamente 1092 secuencias posibles de hasta seis ejercicios', () => {
    const variants = [repetitions, standardTimed, vrBox]
    let checked = 0
    for (let length = 1; length <= 6; length += 1) {
      const combinations = 3 ** length
      for (let encoded = 0; encoded < combinations; encoded += 1) {
        let value = encoded
        const exercises = Array.from({ length }, () => {
          const item = variants[value % variants.length]
          value = Math.floor(value / variants.length)
          return item
        })
        const analysis = analyzeSessionSequence(exercises)
        let expectedChanges = 0
        let wearing = false
        for (const exercise of exercises) {
          const needsVisor = exercise.displayMode === 'vr_box'
          if (needsVisor !== wearing) expectedChanges += 1
          wearing = needsVisor
        }
        if (wearing) expectedChanges += 1
        expect(analysis.visorChanges).toBe(expectedChanges)

        const ordered = orderExercisesForVrBox(exercises)
        const categories = ordered.map((exercise) => exercise.displayMode === 'vr_box' ? 2 : exercise.doseMode === 'repetitions' ? 0 : 1)
        expect(categories).toEqual([...categories].sort((a, b) => a - b))
        expect(analyzeSessionSequence(ordered).optimizedForVrBox).toBe(true)
        checked += 1
      }
    }
    expect(checked).toBe(1092)
  })
})
