import type { ExtractedField } from './types'
import type { CycleStudyPhase } from '../documents/types'
import { BAP_AUTOMATIC_REPORT_SOURCES, bapReferenceForAge } from './bapReferenceData'

export interface BapAutomaticReportDraft {
  conclusion: string
  rehabilitationSuggestion: string
  evidence: string[]
  sources: readonly string[]
  warnings: string[]
}

interface Values {
  age: number | null
  conditions: Array<number | null>
  composite: number | null
  somatosensory: number | null
  visual: number | null
  vestibular: number | null
  visualPreference: number | null
  mixedVestibularSomatosensory: number | null
  mixedVestibularVisual: number | null
  aphysiological: number | null
}

function numericValue(value: string) {
  const match = value.replace(/\s/g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function fieldValue(fields: ExtractedField[], code: string) {
  return numericValue(fields.find((field) => field.code === code)?.professionalValue ?? '')
}

function readValues(fields: ExtractedField[]): Values {
  const ageValue = fieldValue(fields, 'reported_age')
  return {
    age: ageValue === null ? null : Math.trunc(ageValue),
    conditions: Array.from({ length: 6 }, (_, index) => fieldValue(fields, `condition_${index + 1}`)),
    composite: fieldValue(fields, 'composite_score'),
    somatosensory: fieldValue(fields, 'sensory_somatosensory'),
    visual: fieldValue(fields, 'sensory_visual'),
    vestibular: fieldValue(fields, 'sensory_vestibular'),
    visualPreference: fieldValue(fields, 'visual_preference'),
    mixedVestibularSomatosensory: fieldValue(fields, 'mix_ve_som'),
    mixedVestibularVisual: fieldValue(fields, 'mix_ve_vi'),
    aphysiological: fieldValue(fields, 'afis_pattern'),
  }
}

function percent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace('.', ',')} %`
}

function comparison(label: string, observed: number, reference: number, relation: 'below' | 'above') {
  return `${label}: ${percent(observed)} (${relation === 'below' ? 'referencia mínima' : 'límite superior'} ${percent(reference)})`
}

export function buildBapAutomaticReport(fields: ExtractedField[], cyclePhase: CycleStudyPhase = 'unspecified'): BapAutomaticReportDraft | null {
  if (!fields.some((field) => field.studyType === 'posturography')) return null
  const values = readValues(fields)
  const populatedConditions = values.conditions.filter((value) => value !== null).length
  const hasUsefulValues = populatedConditions > 0 || values.composite !== null || values.somatosensory !== null || values.visual !== null || values.vestibular !== null
  if (!hasUsefulValues) return null

  const reference = values.age === null ? null : bapReferenceForAge(values.age)
  const evidence: string[] = []
  const warnings: string[] = []
  const loweredConditions: number[] = []
  const loweredRatios: string[] = []
  const elevatedPatterns: string[] = []

  if (!reference) {
    warnings.push(values.age === null
      ? 'Falta una edad válida para seleccionar la tabla normativa.'
      : `La edad consignada (${values.age} años) queda fuera de la tabla disponible, que abarca de 3 a 89 años.`)
  } else {
    values.conditions.forEach((observed, index) => {
      const expected = reference.conditions[index]
      if (observed !== null && observed < expected) {
        loweredConditions.push(index + 1)
        evidence.push(comparison(`Condición ${index + 1}`, observed, expected, 'below'))
      }
    })

    const ratios = [
      ['somatosensorial', values.somatosensory, reference.sensory.somatosensory],
      ['visual', values.visual, reference.sensory.visual],
      ['vestibular', values.vestibular, reference.sensory.vestibular],
      ['preferencia visual', values.visualPreference, reference.sensory.visualPreference],
    ] as const
    ratios.forEach(([label, observed, expected]) => {
      if (observed !== null && observed < expected) {
        loweredRatios.push(label)
        evidence.push(comparison(`Cociente ${label}`, observed, expected, 'below'))
      }
    })

    const patterns = [
      ['mixto vestibular-somatosensorial', values.mixedVestibularSomatosensory, reference.patternUpperLimits.mixedVestibularSomatosensory],
      ['mixto vestibular-visual', values.mixedVestibularVisual, reference.patternUpperLimits.mixedVestibularVisual],
      ['afisiológico', values.aphysiological, reference.patternUpperLimits.aphysiological],
    ] as const
    patterns.forEach(([label, observed, upperLimit]) => {
      if (observed !== null && observed > upperLimit) {
        elevatedPatterns.push(label)
        evidence.push(comparison(`Indicador ${label}`, observed, upperLimit, 'above'))
      }
    })
  }

  const compositeLow = Boolean(reference && values.composite !== null && values.composite < reference.composite)
  if (reference && values.composite !== null) {
    evidence.unshift(`Composite: ${percent(values.composite)} (referencia mínima ${percent(reference.composite)}; ${compositeLow ? 'inferior' : 'dentro de lo esperado'})`)
  }

  const hasVestibularFinding = loweredConditions.includes(5) || loweredConditions.includes(6) || loweredRatios.includes('vestibular') || elevatedPatterns.some((item) => item.includes('vestibular'))
  const hasSomatosensoryFinding = loweredConditions.includes(2) || loweredRatios.includes('somatosensorial') || elevatedPatterns.includes('mixto vestibular-somatosensorial')
  const hasVisualFinding = loweredConditions.includes(4) || loweredRatios.includes('visual') || elevatedPatterns.includes('mixto vestibular-visual')
  const hasVisualConflict = loweredConditions.includes(3) || loweredConditions.includes(6) || loweredRatios.includes('preferencia visual')
  const hasAphysiologicalFinding = elevatedPatterns.includes('afisiológico')

  const conclusion: string[] = []
  if (reference) {
    conclusion.push(`Comparado con los valores de referencia BAP para ${reference.label}, el rendimiento global ${values.composite === null ? 'no pudo clasificarse porque falta el Composite Score' : compositeLow ? `se encuentra por debajo de lo esperado (Composite ${percent(values.composite)}; referencia mínima ${percent(reference.composite)})` : `se encuentra dentro de lo esperado (Composite ${percent(values.composite)}; referencia mínima ${percent(reference.composite)})`}.`)
    if (loweredConditions.length) conclusion.push(`Se observan valores inferiores a la referencia en ${loweredConditions.map((item) => `condición ${item}`).join(', ')}.`)
    else if (populatedConditions === 6) conclusion.push('Las seis condiciones se encuentran en o por encima de los valores de referencia por edad.')
    if (loweredRatios.length) conclusion.push(`Los cocientes con rendimiento inferior a la referencia son: ${loweredRatios.join(', ')}.`)
    if (elevatedPatterns.length) conclusion.push(`Los indicadores derivados que superan su límite de referencia son: ${elevatedPatterns.join(', ')}.`)
    if (!loweredConditions.length && !loweredRatios.length && !elevatedPatterns.length && !compositeLow) conclusion.push('No se identifican desvíos en los indicadores comparables disponibles.')
  } else {
    const available = values.conditions.map((value, index) => value === null ? '' : `condición ${index + 1}: ${percent(value)}`).filter(Boolean)
    if (values.composite !== null) available.push(`Composite: ${percent(values.composite)}`)
    conclusion.push(`Se registraron ${available.join(', ')}.`)
    conclusion.push('No es posible establecer una comparación normativa automática hasta verificar una edad incluida en la tabla de referencia.')
  }
  if (hasAphysiologicalFinding) conclusion.push('El indicador afisiológico elevado obliga a revisar la calidad técnica, la comprensión de las consignas y la coherencia del estudio antes de interpretarlo.')
  conclusion.push('Este borrador describe el perfil funcional y no establece un diagnóstico; debe correlacionarse con anamnesis, examen neurológico y vestibular, marcha, Romberg y estudios asociados.')

  const rehabilitation: string[] = ['Borrador para revisión profesional.']
  if (cyclePhase === 'final') {
    rehabilitation.push('Esta posturografía está registrada como evaluación final. Comparar con la inicial del mismo ciclo, la evolución sintomática, la función y los objetivos antes de decidir alta, continuidad o un nuevo plan.')
    rehabilitation.push('No se genera una nueva prescripción automática a partir del estudio final aislado.')
  } else if (!reference) {
    rehabilitation.push('Verificar la edad y completar la comparación normativa antes de definir objetivos específicos desde esta posturografía.')
  } else if (hasAphysiologicalFinding) {
    rehabilitation.push('Priorizar el control de calidad del estudio y repetir las condiciones incongruentes antes de orientar la rehabilitación con estos resultados.')
  } else {
    const targets: string[] = []
    if (hasVestibularFinding) targets.push('entrenamiento vestibular y de sustitución sensorial, con progresión segura hacia superficies inestables y menor disponibilidad visual')
    if (hasSomatosensoryFinding) targets.push('propiocepción, control distal y estrategias de equilibrio sobre superficies progresivamente variables')
    if (hasVisualFinding) targets.push('integración visual con tareas graduadas de equilibrio y orientación espacial')
    if (hasVisualConflict) targets.push('habituación visual u optocinética progresiva frente a estímulos y ambientes visualmente complejos')
    if (targets.length) rehabilitation.push(`Considerar un programa individualizado dirigido a ${targets.join('; ')}.`)
    else rehabilitation.push('Los indicadores comparables no generan por sí solos una orientación específica de rehabilitación; definir la conducta según síntomas, examen funcional y objetivos del paciente.')
    if (compositeLow || loweredConditions.includes(5) || loweredConditions.includes(6)) rehabilitation.push('Incluir valoración del riesgo de caídas, seguridad en oscuridad y superficies irregulares, y medidas ambientales cuando correspondan.')
  }
  rehabilitation.push('El profesional debe definir ejercicios, dosis, frecuencia, asistencia, progresión, regresión y precauciones; se sugiere reevaluar con la misma metodología para documentar evolución.')

  if (populatedConditions < 6) warnings.push(`Solo hay ${populatedConditions} de 6 condiciones disponibles; el borrador puede estar incompleto.`)
  return { conclusion: conclusion.join(' '), rehabilitationSuggestion: rehabilitation.join('\n\n'), evidence, sources: BAP_AUTOMATIC_REPORT_SOURCES, warnings }
}
