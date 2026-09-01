import { z } from 'zod'
import { analyzeExerciseCompatibility } from '../exercise/compatibility'
import { buildExerciseExecutionPlan } from '../exercise/execution'
import type { ExerciseConfig } from '../exercise/types'
import { getImmersiveScenario } from '../immersive/catalog'
import { canUseQuestProceduralImmersion, isQuestProceduralImmersive } from '../immersive/questProcedural'

export const cycleFormSchema = z.object({
  label: z.string().trim().min(3, 'Ingresá un nombre para el ciclo.').max(100),
  reason: z.string().trim().max(2000).optional(),
  objectives: z.string().trim().max(3000).optional(),
  startedOn: z.string().min(1, 'Elegí la fecha de inicio.'),
})

export type CycleFormValues = z.infer<typeof cycleFormSchema>

export interface SessionFormValues {
  kind?: 'exercise' | 'free_note'
  title: string
  instructions: string
  mode: 'home' | 'in_person'
  treatmentCycleId: string
  availableFrom: string
  availableUntil: string
  exercises: ExerciseConfig[]
  registerAsCompleted?: boolean
  retrospective?: RetrospectiveSessionValues
}

export interface RetrospectiveSessionValues {
  performedAt: string
  performedExerciseIndexes: number[]
  omittedExerciseReasons: Record<string, string>
  durationMinutes: number
  device: 'standard' | 'vr_box' | 'cardboard' | 'quest' | 'external' | 'mixed'
  withoutMetrics: boolean
  initialDiscomfort: number | null
  peakDiscomfort: number | null
  finalDiscomfort: number | null
  recoveryMinutes: number | null
  delayedResponse: string
  progressionDecision: string
  professionalObservation: string
  patientComment: string
}

export function createRetrospectiveSessionValues(exercises: ExerciseConfig[], sessionDate: string): RetrospectiveSessionValues {
  return {
    performedAt: `${sessionDate || new Date().toISOString().slice(0, 10)}T12:00`,
    performedExerciseIndexes: exercises.map((_, index) => index),
    omittedExerciseReasons: {},
    durationMinutes: 0,
    device: 'standard',
    withoutMetrics: true,
    initialDiscomfort: null,
    peakDiscomfort: null,
    finalDiscomfort: null,
    recoveryMinutes: null,
    delayedResponse: '',
    progressionDecision: '',
    professionalObservation: '',
    patientComment: '',
  }
}

export function validateSession(values: SessionFormValues) {
  const errors: Record<string, string> = {}
  const setExerciseError = (message: string) => { if (!errors.exercises) errors.exercises = message }
  if (values.title.trim().length < 3) errors.title = 'Ingresá un título para la sesión.'
  if (!values.treatmentCycleId) errors.treatmentCycleId = 'Seleccioná un ciclo activo.'
  if (!values.availableFrom) errors.availableFrom = 'Elegí desde cuándo estará disponible.'
  if (values.availableUntil && values.availableUntil < values.availableFrom) errors.availableUntil = 'La fecha final no puede ser anterior.'
  if (values.kind === 'free_note') {
    if (values.mode !== 'in_person') errors.kind = 'La sesión libre debe ser presencial.'
    validateRetrospective(values, errors)
    return errors
  }
  if (values.exercises.length === 0) setExerciseError('Agregá al menos un ejercicio.')
  if (values.exercises.some((exercise) => !exercise.name.trim())) setExerciseError('Todos los ejercicios necesitan un nombre.')
  if (values.exercises.some((exercise) => !exercise.patientInstruction.trim())) setExerciseError('Todos los ejercicios necesitan una instrucción breve para el paciente.')
  if (values.exercises.some((exercise) => exercise.doseMode === 'repetitions' && (!Number.isInteger(exercise.targetRepetitions) || exercise.targetRepetitions < 1 || exercise.targetRepetitions > 100))) setExerciseError('El objetivo por repeticiones debe ser un número entero entre 1 y 100.')
  const invalidDuration = values.exercises.find((exercise) => {
    if (exercise.doseMode !== 'time') return false
    const maximum = exercise.purpose === 'immersive_context' ? getImmersiveScenario(exercise.immersiveScenarioId)?.maximumSeconds ?? 300 : 300
    return !Number.isInteger(exercise.durationSeconds) || exercise.durationSeconds < 10 || exercise.durationSeconds > maximum
  })
  if (invalidDuration) {
    const maximum = invalidDuration.purpose === 'immersive_context' ? getImmersiveScenario(invalidDuration.immersiveScenarioId)?.maximumSeconds ?? 300 : 300
    setExerciseError(`La duración por ejercicio debe ser un número entero entre 10 y ${maximum} segundos.`)
  }
  if (values.exercises.some((exercise) => !Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0 || exercise.restSeconds > 180)) setExerciseError('El descanso debe ser un número entero entre 0 y 180 segundos.')
  if (values.exercises.some((exercise) => !Number.isInteger(exercise.rounds) || exercise.rounds < 1 || exercise.rounds > (exercise.purpose === 'immersive_context' ? 1 : 10))) setExerciseError('Las vueltas deben ser un número entero entre 1 y 10; los escenarios 360° admiten una sola vuelta por escena.')
  if (values.exercises.some((exercise) => ![0, 5, 10, 20].includes(exercise.preparationSeconds))) setExerciseError('La preparación debe ser de 0, 5, 10 o 20 segundos.')
  if (values.exercises.some((exercise) => exercise.doseMode === 'repetitions' && exercise.advanceMode !== 'manual')) setExerciseError('Los ejercicios por repeticiones requieren confirmación manual.')
  if (values.exercises.some((exercise) => exercise.displayMode === 'vr_box' && exercise.doseMode === 'repetitions')) setExerciseError('VR Box solo admite ejercicios por tiempo; las repeticiones se realizan con el celular fuera del visor.')
  if (values.exercises.some((exercise) => exercise.displayMode === 'vr_box' && exercise.advanceMode !== 'automatic')) setExerciseError('Los ejercicios VR Box deben finalizar automáticamente porque no dependen de botones ni controles externos.')
  const vrBoxProfiles = new Set(values.exercises.filter((exercise) => exercise.displayMode === 'vr_box').map((exercise) => exercise.cardboardEnabled ? 'cardboard' : 'vr_box'))
  if (vrBoxProfiles.size > 1) setExerciseError('Una misma sesión no debe alternar entre VR Box y Cardboard. Elegí un único perfil de visor para todo el bloque binocular.')
  if (values.exercises.some((exercise) => (exercise.kind === 'guided_physical' || exercise.purpose === 'custom_free') && exercise.surface === 'unstable' && exercise.supervision === 'independent_after_approval')) setExerciseError('Las superficies inestables requieren un ayudante entrenado o supervisión profesional.')
  if (values.mode === 'home' && values.exercises.some((exercise) => (exercise.kind === 'guided_physical' || exercise.purpose === 'custom_free') && exercise.posture === 'walking' && exercise.supervision === 'independent_after_approval')) setExerciseError('La marcha domiciliaria requiere un ayudante entrenado.')
  if (values.mode === 'home' && values.exercises.some((exercise) => exercise.strobeEnabled)) setExerciseError('La intermitencia visual estroboscópica experimental solo puede asignarse en modalidad presencial con supervisión profesional directa.')

  const immersiveExercises = values.exercises.filter((exercise) => exercise.purpose === 'immersive_context')
  if (values.mode === 'home' && immersiveExercises.length > 0) setExerciseError('Los escenarios 360° están habilitados únicamente en clínica con supervisión profesional directa.')
  if (immersiveExercises.length > 0 && immersiveExercises.length !== values.exercises.length) setExerciseError('Una sesión contextual 360° puede incluir varios escenarios, pero no se mezcla con RVO, tareas físicas ni ejercicios cognitivos.')
  if (immersiveExercises.some((exercise) => exercise.displayMode === 'standard' || (exercise.displayMode === 'vr_box' && !exercise.cardboardEnabled))) setExerciseError('El escenario 360° requiere Quest WebXR o VR Box con Cardboard 3DoF activo.')

  const questExercises = values.exercises.filter((exercise) => exercise.displayMode === 'quest_browser')
  if (values.mode === 'home' && questExercises.length > 0) setExerciseError('Meta Quest está disponible solo para sesiones presenciales con supervisión profesional directa.')
  if (questExercises.length > 0 && questExercises.length !== values.exercises.length) setExerciseError('Una sesión Meta Quest debe contener exclusivamente ejercicios Quest: esta versión no transfiere una sesión activa entre el visor y otro dispositivo.')
  if (questExercises.some((exercise) => exercise.supervision !== 'direct_clinician' || exercise.posture !== 'seated' || exercise.surface !== 'firm')) setExerciseError('Los ejercicios Quest iniciales requieren supervisión profesional directa, postura sentada y superficie firme.')
  if (questExercises.some((exercise) => exercise.doseMode !== 'time' || exercise.advanceMode !== 'automatic')) setExerciseError('La estación Quest inicial ejecuta ejercicios por tiempo y con avance automático.')
  const proceduralImmersive = questExercises.filter(isQuestProceduralImmersive)
  const invalidProceduralImmersive = questExercises.find((exercise) => exercise.questPresentationMode === 'immersive_webxr' && exercise.purpose !== 'immersive_context' && !canUseQuestProceduralImmersion(exercise))
  if (invalidProceduralImmersive) setExerciseError(`“${invalidProceduralImmersive.name}” no admite inmersión procedural: elegí panel 2D o una finalidad visual compatible sin intermitencia ni tarea cognitiva.`)
  if (proceduralImmersive.length > 0 && proceduralImmersive.length !== values.exercises.length) setExerciseError('Una batería procedural WebXR debe contener únicamente ejercicios inmersivos procedurales. No se mezcla con paneles 2D ni escenarios contextuales 360° dentro de la misma ejecución.')
  if (proceduralImmersive.some((exercise) => ![90, 180, 360].includes(exercise.questImmersiveCoverage))) setExerciseError('La cobertura inmersiva debe ser de 90°, 180° o 360°.')
  if (proceduralImmersive.some((exercise) => exercise.questBackgroundAngularSpeed < 1 || exercise.questBackgroundAngularSpeed > 60)) setExerciseError('La velocidad angular Quest debe estar entre 1 y 60 grados por segundo.')
  if (proceduralImmersive.some((exercise) => exercise.questPatternAngularSize < 1 || exercise.questPatternAngularSize > 45)) setExerciseError('El tamaño angular del patrón debe estar entre 1° y 45°.')
  if (proceduralImmersive.some((exercise) => exercise.objectEnabled && (exercise.questTargetAngularSize < 0.5 || exercise.questTargetAngularSize > 12))) setExerciseError('El blanco inmersivo debe medir entre 0,5° y 12°.')

  const incompatibleIndex = values.exercises.findIndex((exercise) => !analyzeExerciseCompatibility(exercise).valid)
  if (incompatibleIndex >= 0) {
    const analysis = analyzeExerciseCompatibility(values.exercises[incompatibleIndex])
    setExerciseError(`Ejercicio ${incompatibleIndex + 1}: ${analysis.issues[0].message} ${analysis.issues[0].correction}`)
  }
  const impossibleExecutionIndex = values.exercises.findIndex((exercise) => buildExerciseExecutionPlan(exercise, values.mode).feasibility === 'not_executable')
  if (impossibleExecutionIndex >= 0) {
    const plan = buildExerciseExecutionPlan(values.exercises[impossibleExecutionIndex], values.mode)
    setExerciseError(`Ejercicio ${impossibleExecutionIndex + 1}: ${plan.warnings[0] ?? 'La ejecución no es viable en la modalidad seleccionada.'}`)
  }
  validateRetrospective(values, errors)
  return errors
}

function validateRetrospective(values: SessionFormValues, errors: Record<string, string>) {
  if (!values.registerAsCompleted) return
  const retrospective = values.retrospective
  if (!retrospective?.performedAt) { errors.retrospective = 'Indicá la fecha y hora reales de ejecución.'; return }
  const performedAt = new Date(retrospective.performedAt)
  if (Number.isNaN(performedAt.getTime()) || performedAt.getTime() > Date.now()) errors.retrospective = 'La ejecución retrospectiva no puede quedar en el futuro.'
  if (retrospective.professionalObservation.trim().length < 3) errors.retrospective = 'Agregá una observación profesional sobre lo realizado.'
  if (!retrospective.withoutMetrics && (!Number.isInteger(retrospective.durationMinutes) || retrospective.durationMinutes < 1 || retrospective.durationMinutes > 600)) errors.retrospective = 'La duración aproximada debe estar entre 1 y 600 minutos.'
  if (!retrospective.withoutMetrics) {
    const symptoms = [retrospective.initialDiscomfort, retrospective.peakDiscomfort, retrospective.finalDiscomfort]
    if (symptoms.some((value) => value != null && (!Number.isInteger(value) || value < 0 || value > 10))) errors.retrospective = 'Los síntomas retrospectivos deben estar entre 0 y 10.'
    if (retrospective.recoveryMinutes != null && (!Number.isInteger(retrospective.recoveryMinutes) || retrospective.recoveryMinutes < 0 || retrospective.recoveryMinutes > 1440)) errors.retrospective = 'La recuperación debe estar entre 0 y 1440 minutos.'
  }
  if (values.kind !== 'free_note') {
    values.exercises.forEach((_, index) => {
      if (!retrospective.performedExerciseIndexes.includes(index) && (retrospective.omittedExerciseReasons[String(index)] ?? '').trim().length < 3) errors.retrospective = `Indicá por qué se omitió el ejercicio ${index + 1}.`
    })
  }
}
