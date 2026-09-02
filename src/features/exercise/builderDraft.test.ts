import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig } from './types'
import { EXERCISE_BUILDER_DRAFT_KEY, clearExerciseBuilderDraft, readExerciseBuilderDraft, writeExerciseBuilderDraft } from './builderDraft'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  }
}

describe('borrador del constructor de ejercicios', () => {
  it('recupera la configuración después de desmontar la pantalla y permite descartarla', () => {
    const storage = memoryStorage()
    writeExerciseBuilderDraft({
      config: { ...defaultExerciseConfig, name: 'Trabajo en curso', rounds: 4 },
      selectedTemplateId: 'template-rvo-bars',
      pathologySelection: [
        { templateId: 'template-rvo-bars', name: 'RVO x1', config: { ...defaultExerciseConfig, name: 'RVO x1' } },
        { templateId: 'template-functional-weight-shifts', name: 'Transferencias', config: { ...defaultExerciseConfig, name: 'Transferencias', kind: 'guided_physical' } },
      ],
    }, storage)
    expect(readExerciseBuilderDraft(storage)).toMatchObject({
      config: { name: 'Trabajo en curso', rounds: 4 },
      selectedTemplateId: 'template-rvo-bars',
      pathologySelection: [
        { templateId: 'template-rvo-bars', config: { name: 'RVO x1' } },
        { templateId: 'template-functional-weight-shifts', config: { name: 'Transferencias' } },
      ],
    })
    clearExerciseBuilderDraft(storage)
    expect(storage.getItem(EXERCISE_BUILDER_DRAFT_KEY)).toBeNull()
  })
})
