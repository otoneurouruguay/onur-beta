import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig } from '../exercise/types'
import { readSessionBuilderDraft, sessionBuilderDraftKey, writeSessionBuilderDraft } from './builderDraft'

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }
}

describe('borrador de sesión', () => {
  it('conserva varios ejercicios y el seleccionado durante una navegación o refresco', () => {
    const storage = memoryStorage()
    const key = sessionBuilderDraftKey('patient-1')
    const values = {
      kind: 'exercise' as const, title: 'Sesión en curso', instructions: 'Revisar', mode: 'home' as const,
      treatmentCycleId: 'cycle-1', availableFrom: '2026-08-11', availableUntil: '',
      exercises: [{ ...defaultExerciseConfig, name: 'Primero' }, { ...defaultExerciseConfig, name: 'Segundo' }],
    }
    writeSessionBuilderDraft(key, { values, selectedExerciseIndex: 1 }, storage)
    expect(readSessionBuilderDraft(key, storage)).toMatchObject({ values: { title: 'Sesión en curso', exercises: [{ name: 'Primero' }, { name: 'Segundo' }] }, selectedExerciseIndex: 1 })
  })
})
