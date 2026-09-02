import { z } from 'zod'
import { clinicalSourceIds, exerciseTaxonomy } from './catalog'

export const requiredGenerationInputs = [
  'request_id', 'clinician_authorized', 'patient_group', 'age_group',
  'confirmed_diagnosis', 'diagnostic_source_or_clinician_note', 'phase',
  'impairments', 'activity_limitations', 'participation_goals', 'baseline_measures',
  'fall_risk', 'mobility_level', 'vision_status', 'hearing_status', 'cervical_status',
  'neurological_status', 'cardiovascular_status', 'cognitive_status', 'migraine_status',
  'medications_relevant_to_performance', 'environment', 'available_equipment',
  'supervision_available', 'symptom_scale', 'symptom_ceiling', 'recovery_window',
  'stop_rules_defined_by_clinician',
] as const

export interface GenerationActorContext {
  userId?: string
  clinicallyAuthorized: boolean
  role?: string
}

export interface GenerationSafetyContext {
  completed: boolean
  reportedTriggers: string[]
}

export type GenerationRequestInput = Record<string, unknown>

export interface GenerationPreflightResult {
  status: 'eligible_for_draft' | 'blocked_missing_clinical_input' | 'blocked_safety_trigger' | 'blocked_out_of_scope'
  missingInputs: string[]
  safetyTrigger: string | null
  authorizationAccepted: boolean
}

function containsPlaceholder(value: unknown): boolean {
  if (typeof value === 'string') return /(^|\b)(COMPLETAR|PENDIENTE|TBD)(_|\b)/i.test(value.trim())
  if (Array.isArray(value)) return value.some(containsPlaceholder)
  if (value && typeof value === 'object') return Object.values(value).some(containsPlaceholder)
  return false
}

function isMissing(value: unknown) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0 || containsPlaceholder(value)
  if (Array.isArray(value)) return value.length === 0 || containsPlaceholder(value)
  if (typeof value === 'object') return Object.keys(value).length === 0 || containsPlaceholder(value)
  return false
}

/**
 * Compuerta determinista previa al generador. La autorización no se confía al JSON
 * enviado por el cliente: también debe existir en el contexto autenticado del servidor.
 */
export function screenGenerationRequest(
  input: GenerationRequestInput,
  actor: GenerationActorContext,
  safety?: GenerationSafetyContext,
): GenerationPreflightResult {
  const missingInputs = requiredGenerationInputs.filter((field) => isMissing(input[field]))
  const authorizationAccepted = actor.clinicallyAuthorized && Boolean(actor.userId) && input.clinician_authorized === true

  if (!authorizationAccepted) {
    return {
      status: 'blocked_out_of_scope',
      missingInputs: Array.from(new Set(['clinician_authorized', ...missingInputs])),
      safetyTrigger: null,
      authorizationAccepted: false,
    }
  }

  const population = `${String(input.patient_group ?? '')} ${String(input.age_group ?? '')}`.toLocaleLowerCase('es')
  if (/pedi[aá]tr|niñ|adolesc|0\s*-\s*17/.test(population)) {
    return {
      status: 'blocked_out_of_scope',
      missingInputs: Array.from(new Set(['pediatric_governance_not_implemented', ...missingInputs])),
      safetyTrigger: null,
      authorizationAccepted: true,
    }
  }

  if (!safety?.completed) {
    return {
      status: 'blocked_missing_clinical_input',
      missingInputs: Array.from(new Set(['hard_stop_screen', ...missingInputs])),
      safetyTrigger: null,
      authorizationAccepted: true,
    }
  }

  const trigger = safety.reportedTriggers.find((item) => item.trim().length > 0)
  if (trigger) {
    return {
      status: 'blocked_safety_trigger',
      missingInputs,
      safetyTrigger: trigger,
      authorizationAccepted: true,
    }
  }

  if (missingInputs.length > 0) {
    return {
      status: 'blocked_missing_clinical_input',
      missingInputs,
      safetyTrigger: null,
      authorizationAccepted: true,
    }
  }

  return { status: 'eligible_for_draft', missingInputs: [], safetyTrigger: null, authorizationAccepted: true }
}

const sourceIdSchema = z.string()
  .regex(/^SRC-[0-9]{3}$/)
  .refine((id) => clinicalSourceIds.has(id as `SRC-${string}`), 'La fuente no existe en el catálogo clínico.')

const strictStringArray = z.array(z.string().min(1))

const exerciseDraftSchema = z.object({
  exercise_id: z.string().min(1),
  title_patient: z.string().min(1),
  title_clinical: z.string().min(1),
  taxonomy_code: z.enum(exerciseTaxonomy),
  target_impairment: strictStringArray,
  functional_goal: strictStringArray,
  mechanism: z.string().min(1),
  indications: strictStringArray,
  prerequisites: strictStringArray,
  contraindications_and_precautions: strictStringArray,
  environment: z.string().min(1),
  equipment: strictStringArray,
  starting_position: z.string().min(1),
  patient_instructions: strictStringArray,
  clinician_notes: strictStringArray,
  dose: z.object({
    sets: z.union([z.int(), z.string().min(1)]),
    repetitions_or_duration: z.string().min(1),
    frequency: z.string().min(1),
    rest: z.string().min(1),
    intensity_parameters: strictStringArray,
    dose_rationale: z.string().min(1),
  }).strict(),
  symptom_monitoring: z.object({
    scale: z.string().min(1), baseline: z.string().min(1), ceiling: z.string().min(1),
    recovery_window: z.string().min(1), record: strictStringArray,
  }).strict(),
  stop_criteria: strictStringArray,
  regression: z.object({ change_one_variable: z.string().min(1), instructions: strictStringArray }).strict(),
  progression: z.object({ change_one_variable: z.string().min(1), instructions: strictStringArray }).strict(),
  mastery_criteria: strictStringArray,
  supervision: z.object({
    level: z.enum(['direct_clinician', 'trained_helper', 'remote_supervision', 'independent_after_approval']),
    helper_required: z.boolean(), setup_requirements: strictStringArray,
  }).strict(),
  outcome_mapping: strictStringArray,
  source_ids: z.array(sourceIdSchema).min(1),
  evidence_certainty: z.enum(['high', 'moderate', 'low', 'very_low', 'expert_opinion', 'not_established']),
  evidence_gap: z.boolean(),
}).strict()

export const generatedExercisePackageSchema = z.object({
  status: z.enum(['draft_unreviewed', 'blocked_missing_clinical_input', 'blocked_safety_trigger', 'blocked_out_of_scope']),
  request_id: z.string().min(1),
  clinical_scope: z.object({
    diagnosis: z.string(), phase: z.string(), population: z.string(), goals: strictStringArray, scope_limitations: z.array(z.string()),
  }).strict(),
  missing_inputs: z.array(z.string()).optional(),
  safety_trigger: z.string().nullable().optional(),
  exercise_drafts: z.array(exerciseDraftSchema),
  safety_summary: z.object({ fall_controls: z.array(z.string()), medical_precautions: z.array(z.string()), adverse_response_plan: z.array(z.string()) }).strict(),
  evidence_summary: z.object({ source_ids_used: z.array(sourceIdSchema), directness: z.string(), uncertainties: z.array(z.string()) }).strict(),
  quality_checks: z.object({
    diagnosis_confirmed: z.boolean(), hard_stop_negative: z.boolean(), dose_traceable: z.boolean(),
    single_variable_progression: z.boolean(), fall_safety_addressed: z.boolean(), symptom_limits_present: z.boolean(),
    sources_valid: z.boolean(), human_review_pending: z.boolean(),
  }).strict(),
  audit: z.object({
    generated_at: z.iso.datetime(), model_id: z.string().min(1), prompt_version: z.string().min(1),
    clinician_review_status: z.literal('draft_unreviewed'), reviewer_id: z.string().nullable().optional(),
    reviewed_at: z.string().nullable().optional(), change_log: z.array(z.string()).optional(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.status === 'draft_unreviewed' && value.exercise_drafts.length === 0) context.addIssue({ code: 'custom', path: ['exercise_drafts'], message: 'Un borrador debe contener al menos un ejercicio.' })
  if (value.status !== 'draft_unreviewed' && value.exercise_drafts.length > 0) context.addIssue({ code: 'custom', path: ['exercise_drafts'], message: 'Una respuesta bloqueada no puede incluir ejercicios.' })
  if (!value.quality_checks.human_review_pending) context.addIssue({ code: 'custom', path: ['quality_checks', 'human_review_pending'], message: 'Todo contenido generado debe quedar pendiente de revisión humana.' })
})

export type GeneratedExercisePackage = z.infer<typeof generatedExercisePackageSchema>

export function validateGeneratedExercisePackage(value: unknown) {
  return generatedExercisePackageSchema.safeParse(value)
}
