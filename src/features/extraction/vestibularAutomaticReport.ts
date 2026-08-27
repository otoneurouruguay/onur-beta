import { clinicalSources } from '../clinicalGeneration/catalog'
import { pathologyRecommendations, type PathologyRecommendationId } from '../clinicalRecommendations/catalog'
import { canonicalFieldStatus } from './fieldResults'
import { sanitizeVestibularNarrative } from './vestibularNarrative'
import type { ExtractedField } from './types'

export interface VestibularAutomaticReport {
  conclusion: string
  rehabilitationSuggestion: string
  transcribedConduct: string
  evidence: string[]
  warnings: string[]
  sources: Array<{ id: string; title: string; year: number; url: string }>
}

function usableField(fields: ExtractedField[], code: string) {
  const field = fields.find((candidate) => candidate.studyType === 'vhit' && candidate.code === code)
  if (!field || ['not_reported', 'unreadable', 'invalid'].includes(canonicalFieldStatus(field))) return ''
  return field.professionalValue.trim()
}

function fold(value: string) {
  return value.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

function numericField(fields: ExtractedField[], code: string) {
  const value = usableField(fields, code).replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0]
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isNegativeOrNormal(value: string) {
  if (/^\s*\(?\s*-\s*\)?\s*$/.test(value)) return true
  const normalized = fold(value)
  return !normalized || /^(?:-|negativ|normal|s\/?p\b|sin\b|no\s+(?:hay|evidencia|presenta))/i.test(normalized)
}

function hasPotentialCentralFinding(fields: ExtractedField[], conclusion: string) {
  const skew = usableField(fields, 'skew')
  if (skew && !isNegativeOrNormal(skew)) return true
  const centralFields = ['fixation_system', 'visual_suppression', 'vor_cancellation', 'saccadic_precision', 'saccadic_velocity', 'smooth_pursuit']
  const structuredAbnormality = centralFields.some((code) => {
    const value = usableField(fields, code)
    return value && !isNegativeOrNormal(value) && /anormal|alterad|patol[oó]g|disminuid|lent|incorrect|dism[eé]tric/i.test(value)
  })
  const normalizedConclusion = fold(conclusion)
  const centralConclusion = /(?:signos?|hallazgos?|compromiso|sindrome)\s+(?:oculomotor(?:es)?\s+)?central/.test(normalizedConclusion)
    && !/(?:sin|no)\s+(?:hay\s+|evidencia\s+de\s+)?(?:signos?|hallazgos?|compromiso|sindrome).*central/.test(normalizedConclusion)
  return Boolean(structuredAbnormality || centralConclusion)
}

function inferredPathology(fields: ExtractedField[], conclusion: string): PathologyRecommendationId | null {
  const combined = fold([
    conclusion,
    usableField(fields, 'vhit_results'),
    usableField(fields, 'himp'),
    usableField(fields, 'history'),
    usableField(fields, 'symptoms'),
  ].join(' '))
  const gainRight = numericField(fields, 'gain_right_horizontal') ?? numericField(fields, 'gain_right')
  const gainLeft = numericField(fields, 'gain_left_horizontal') ?? numericField(fields, 'gain_left')

  if (/vppb|vertigo posicional paroxistico|benign paroxysmal positional/.test(combined)) return 'bppv'
  if (/migrana vestibular/.test(combined)) return 'vestibular_migraine'
  if (/pppd|mareo postural.?perceptual persistente/.test(combined)) return 'pppd'
  if (/mareo (?:inducido )?visual|dependencia visual/.test(combined)) return 'visually_induced_dizziness'
  if (/cinetosis|motion sickness/.test(combined)) return 'motion_sickness'
  if (/meniere/.test(combined)) return 'meniere'
  if (/presbivestibulopat/.test(combined)) return 'presbyvestibulopathy'
  if (/posconmoc|postconcuss|traumatismo craneoencefalico leve/.test(combined)) return 'mild_tbi'
  if (/schwannoma vestibular|neurinoma/.test(combined)) return 'vestibular_schwannoma'
  if (/hipofuncion|vestibulopatia|arreflexia|deficit vestibular/.test(combined) && /bilateral|ambos lados|ototox|gentamicina/.test(combined)) return 'bilateral_hypofunction'
  if (gainRight !== null && gainLeft !== null && gainRight < .6 && gainLeft < .6) return 'bilateral_hypofunction'
  if (/neuritis|hipofuncion.*unilateral|unilateral.*hipofuncion|sindrome vestibular agudo peri?ferico|sva\s+(?:derech|izquierd)/.test(combined)) return 'unilateral_hypofunction'
  return null
}

function relevantFunctionalFindings(fields: ExtractedField[]) {
  const findings: string[] = []
  const gait = usableField(fields, 'gait')
  if (gait && !isNegativeOrNormal(gait) && /atax|inestab|alterad|dificult/.test(fold(gait))) findings.push(`Marcha informada: ${gait}.`)
  const saccades = usableField(fields, 'saccades')
  if (saccades && !isNegativeOrNormal(saccades) && /overt|covert|correctiv|present/.test(fold(saccades))) findings.push(`Sacadas correctivas informadas: ${saccades}.`)
  const right = numericField(fields, 'gain_right_horizontal') ?? numericField(fields, 'gain_right')
  const left = numericField(fields, 'gain_left_horizontal') ?? numericField(fields, 'gain_left')
  if (right !== null || left !== null) findings.push(`Ganancias horizontales informadas: derecha ${right ?? 'no consignada'}; izquierda ${left ?? 'no consignada'}.`)
  const age = numericField(fields, 'reported_age')
  if (age !== null) findings.push(`Edad consignada: ${age} años.`)
  return findings
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

function sourceRecords(sourceIds: string[]) {
  const wanted = new Set(sourceIds)
  return clinicalSources.filter((source) => wanted.has(source.id) && source.evidenceRole !== 'secondary_teaching')
    .map(({ id, title, year, url }) => ({ id, title, year, url }))
}

function clinicalSuggestion(fields: ExtractedField[], conclusion: string) {
  const centralFinding = hasPotentialCentralFinding(fields, conclusion)
  const pathologyId = centralFinding ? null : inferredPathology(fields, conclusion)
  const recommendation = pathologyRecommendations.find((item) => item.id === pathologyId)
  const findings = relevantFunctionalFindings(fields)
  const gaitConcern = findings.some((item) => item.startsWith('Marcha'))
  const age = numericField(fields, 'reported_age')

  if (centralFinding) {
    return {
      text: 'Antes de indicar ejercicios vestibulares, priorizar una reevaluación neurológica y otoneurológica de los hallazgos potencialmente centrales. No iniciar ni progresar exposición visual, adaptación del RVO o tareas de equilibrio hasta que el profesional descarte una causa central y defina condiciones seguras de trabajo.',
      sourceIds: ['SRC-030'],
      evidence: ['Se detectó al menos un dato oculomotor/central que requiere revisión profesional previa.'],
    }
  }

  if (!recommendation) {
    return {
      text: [
        'Los datos estructurados no alcanzan para seleccionar una intervención específica sin completar el diagnóstico funcional.',
        'Confirmar estabilidad de mirada, equilibrio, marcha, riesgo de caída, síntomas provocados y metas del paciente. Si se confirma hipofunción vestibular periférica, considerar adaptación o sustitución de la mirada, equilibrio y marcha únicamente según los déficits medidos, con progresión de una variable por vez y reevaluación funcional.',
      ].join(' '),
      sourceIds: ['SRC-001'],
      evidence: ['No se identificó un cuadro clínico suficientemente específico en los campos estructurados.'],
    }
  }

  const components = recommendation.options.map((option) => `${option.title}: ${option.summary}`).join(' ')
  const additions = [
    gaitConcern ? 'Por la alteración de marcha consignada, agregar evaluación de riesgo de caída y tareas de equilibrio/marcha con el nivel de asistencia necesario.' : '',
    age !== null && age >= 60 ? 'Por la edad consignada, revisar visión, sensibilidad, fuerza, medicación, ayudas técnicas y seguridad ambiental antes de progresar.' : '',
  ].filter(Boolean)
  const cautions = recommendation.cautions.slice(0, 3).join(' ')

  return {
    text: [
      `Si el profesional confirma ${recommendation.label.toLocaleLowerCase('es-UY')}, los objetivos sugeridos son recuperar estabilidad de mirada, control postural y función según los déficits medidos.`,
      `Componentes a considerar: ${components}`,
      ...additions,
      `Precauciones y progresión: ${cautions}`,
      'Definir dosis, frecuencia, supervisión y criterios de suspensión después de valorar síntomas, recuperación, riesgo de caída y metas funcionales; reevaluar con medidas comparables.',
    ].join('\n\n'),
    sourceIds: [...recommendation.sourceIds],
    evidence: [`Patrón clínico utilizado para seleccionar opciones: ${recommendation.label}.`, recommendation.evidenceNote],
  }
}

/**
 * Separa el texto literal del documento de una sugerencia clínica determinista.
 * La sugerencia nunca reutiliza la conducta impresa como recomendación y no
 * interpreta curvas: cruza solamente campos estructurados visibles con el
 * catálogo bibliográfico gobernado de ONUr.
 */
export function buildVestibularAutomaticReport(fields: ExtractedField[]): VestibularAutomaticReport | null {
  const conclusion = sanitizeVestibularNarrative(usableField(fields, 'conclusion'), 'conclusion')
  const transcribedConduct = sanitizeVestibularNarrative(usableField(fields, 'conduct'), 'conduct')
  if (!conclusion && !transcribedConduct) return null
  const generated = clinicalSuggestion(fields, conclusion)
  const functionalEvidence = relevantFunctionalFindings(fields)
  return {
    conclusion,
    rehabilitationSuggestion: generated.text,
    transcribedConduct,
    evidence: unique([
      ...(conclusion ? ['Conclusión/En suma transcripta literalmente del documento.'] : []),
      ...(transcribedConduct ? ['La conducta original se conserva como referencia, pero no se copia como sugerencia.'] : []),
      ...generated.evidence,
      ...functionalEvidence,
    ]),
    warnings: ['La sugerencia es un apoyo clínico editable: no diagnostica, no interpreta curvas vHIT y exige correlación con síntomas, examen, calidad técnica y confirmación profesional.'],
    sources: sourceRecords(generated.sourceIds),
  }
}
