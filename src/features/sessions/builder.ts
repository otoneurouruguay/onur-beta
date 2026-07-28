import { defaultExerciseConfig, type ExerciseConfig } from '../exercise/types'
import type { SessionFormValues } from './schema'

export const DEFAULT_SESSION_TITLE = 'Sesión vestíbulo-visual'

function isUntouchedStarterExercise(exercise: ExerciseConfig) {
  return JSON.stringify(exercise) === JSON.stringify(defaultExerciseConfig)
}

export function appendExerciseTemplate(
  current: SessionFormValues,
  template: ExerciseConfig,
): { values: SessionFormValues; selectedIndex: number } {
  const exercise = { ...template }
  const isImmersive = exercise.purpose === 'immersive_context'
  const immersiveTitle = exercise.name.replace(/^360° · /, '')
  const replaceStarter = isImmersive
    && current.exercises.length === 1
    && isUntouchedStarterExercise(current.exercises[0])
  const exercises = replaceStarter ? [exercise] : [...current.exercises, exercise]

  return {
    values: {
      ...current,
      title: isImmersive && current.title === DEFAULT_SESSION_TITLE
        ? `Exposición 360° · ${immersiveTitle}`
        : current.title,
      mode: isImmersive ? 'in_person' : current.mode,
      exercises,
    },
    selectedIndex: exercises.length - 1,
  }
}
