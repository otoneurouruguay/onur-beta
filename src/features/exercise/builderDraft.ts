import { normalizeExerciseConfig, type ExerciseConfig } from './types'

export const EXERCISE_BUILDER_DRAFT_KEY = 'onur-exercise-builder-draft-v1'

export interface ExerciseBuilderSelectionItem {
  templateId: string
  name: string
  config: ExerciseConfig
}

export interface ExerciseBuilderDraft {
  config: ExerciseConfig
  selectedTemplateId: string
  pathologySelection: ExerciseBuilderSelectionItem[]
  updatedAt: string
}

export function readExerciseBuilderDraft(storage: Pick<Storage, 'getItem'> = localStorage): ExerciseBuilderDraft | null {
  try {
    const raw = storage.getItem(EXERCISE_BUILDER_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ExerciseBuilderDraft>
    if (!parsed.config || typeof parsed.selectedTemplateId !== 'string') return null
    return {
      config: normalizeExerciseConfig(parsed.config, 10),
      selectedTemplateId: parsed.selectedTemplateId,
      pathologySelection: Array.isArray(parsed.pathologySelection)
        ? parsed.pathologySelection.flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const candidate = item as Partial<ExerciseBuilderSelectionItem>
          if (typeof candidate.templateId !== 'string' || typeof candidate.name !== 'string' || !candidate.config) return []
          return [{ templateId: candidate.templateId, name: candidate.name, config: normalizeExerciseConfig(candidate.config, 10) }]
        })
        : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return null
  }
}

export function writeExerciseBuilderDraft(
  draft: Pick<ExerciseBuilderDraft, 'config' | 'selectedTemplateId'> & Partial<Pick<ExerciseBuilderDraft, 'pathologySelection'>>,
  storage: Pick<Storage, 'setItem'> = localStorage,
) {
  storage.setItem(EXERCISE_BUILDER_DRAFT_KEY, JSON.stringify({ ...draft, pathologySelection: draft.pathologySelection ?? [], updatedAt: new Date().toISOString() }))
}

export function clearExerciseBuilderDraft(storage: Pick<Storage, 'removeItem'> = localStorage) {
  storage.removeItem(EXERCISE_BUILDER_DRAFT_KEY)
}
