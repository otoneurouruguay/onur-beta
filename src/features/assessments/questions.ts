export type AssessmentInstrumentCode = 'DHI_AR_25'
export type AssessmentDomainCode = 'physical' | 'emotional' | 'functional'

export interface AssessmentQuestion {
  id: string
  domain: AssessmentDomainCode
  text: string
}

export interface AssessmentInstrument {
  code: AssessmentInstrumentCode
  version: number
  shortName: string
  name: string
  locale: string
  instructions: string
  questions: AssessmentQuestion[]
  maximumScore: number
  source: string
}

export type AssessmentResponseMap = Record<string, number | null>

export const dhiQuestions: AssessmentQuestion[] = [
  { id: 'P1', domain: 'physical', text: '¿Levantar la cabeza aumenta su problema?' },
  { id: 'P2', domain: 'physical', text: '¿Caminar por el pasillo de un supermercado aumenta su problema?' },
  { id: 'P3', domain: 'physical', text: '¿Aumenta su problema realizar actividades más exigentes, tales como hacer deporte, bailar o realizar tareas domésticas (por ejemplo, barrer o levantar los platos)?' },
  { id: 'P4', domain: 'physical', text: '¿Los movimientos rápidos de cabeza aumentan su problema?' },
  { id: 'P5', domain: 'physical', text: '¿Aumenta su problema al girar en la cama?' },
  { id: 'P6', domain: 'physical', text: '¿Caminar por la vereda aumenta su problema?' },
  { id: 'P7', domain: 'physical', text: '¿Aumenta su problema al agacharse?' },
  { id: 'E1', domain: 'emotional', text: '¿Se siente frustrado a causa de su problema?' },
  { id: 'E2', domain: 'emotional', text: 'A causa de su problema, ¿tiene miedo a salir de su casa sin que alguien lo acompañe?' },
  { id: 'E3', domain: 'emotional', text: 'A causa de su problema, ¿ha sentido vergüenza delante de otros?' },
  { id: 'E4', domain: 'emotional', text: 'A causa de su problema, ¿tiene miedo a que la gente piense que está ebrio?' },
  { id: 'E5', domain: 'emotional', text: 'A causa de su problema, ¿le resulta difícil concentrarse?' },
  { id: 'E6', domain: 'emotional', text: 'A causa de su problema, ¿tiene miedo a quedarse solo en su casa?' },
  { id: 'E7', domain: 'emotional', text: 'A causa de su problema, ¿se siente incapacitado?' },
  { id: 'E8', domain: 'emotional', text: '¿Su problema le dificulta relacionarse con sus familiares o amigos?' },
  { id: 'E9', domain: 'emotional', text: 'A causa de su problema, ¿se siente deprimido?' },
  { id: 'F1', domain: 'functional', text: 'A causa de su problema, ¿decide limitar sus viajes de negocio o de ocio?' },
  { id: 'F2', domain: 'functional', text: 'A causa de su problema, ¿siente dificultades al acostarse o levantarse de la cama?' },
  { id: 'F3', domain: 'functional', text: '¿Su problema limita de forma significativa su participación en actividades de ocio (tales como cenar fuera de casa, ir al cine, ir a bailar o ir a fiestas)?' },
  { id: 'F4', domain: 'functional', text: 'A causa de su problema, ¿tiene dificultades cuando lee?' },
  { id: 'F5', domain: 'functional', text: 'A causa de su problema, ¿evita las alturas?' },
  { id: 'F6', domain: 'functional', text: 'A causa de su problema, ¿le resulta difícil realizar tareas domésticas agotadoras?' },
  { id: 'F7', domain: 'functional', text: 'A causa de su problema, ¿le resulta difícil pasear solo?' },
  { id: 'F8', domain: 'functional', text: 'A causa de su problema, ¿le resulta difícil caminar por su casa a oscuras?' },
  { id: 'F9', domain: 'functional', text: '¿Su problema influye de manera negativa en sus responsabilidades domésticas o laborales?' },
]

export const dhiArgentina: AssessmentInstrument = {
  code: 'DHI_AR_25',
  version: 1,
  shortName: 'DHI',
  name: 'Dizziness Handicap Inventory · versión argentina',
  locale: 'es-AR',
  instructions: 'El propósito de esta escala es identificar las dificultades que usted experimenta debido a su vértigo o falta de equilibrio. Marque una sola respuesta en cada pregunta, refiriéndose únicamente a ese problema.',
  questions: dhiQuestions,
  maximumScore: 100,
  source: 'Caldara et al. Acta Otorrinolaringológica Española. 2012;63(2):106-114.',
}

export const assessmentInstruments = [dhiArgentina] as const

export const assessmentOptions = [
  { value: 4, label: 'Sí' },
  { value: 2, label: 'A veces' },
  { value: 0, label: 'No' },
] as const

export const assessmentDomainLabels: Record<AssessmentDomainCode, string> = {
  physical: 'Física',
  emotional: 'Emocional',
  functional: 'Funcional',
}

export const assessmentPhaseLabels = { initial: 'Inicial', final: 'Final', follow_up: 'Seguimiento' } as const
export const assessmentStatusLabels = { assigned: 'Pendiente', in_progress: 'En curso', completed: 'Completado', cancelled: 'Cancelado' } as const
export const assessmentDeliveryLabels = { portal: 'Portal domiciliario', in_person: 'Presencial' } as const

export function getAssessmentInstrument(code: string, version = 1) {
  return assessmentInstruments.find((instrument) => instrument.code === code && instrument.version === version) ?? null
}

export function emptyAssessmentResponses(instrument = dhiArgentina): AssessmentResponseMap {
  return Object.fromEntries(instrument.questions.map((question) => [question.id, null]))
}

export function scoreAssessment(responses: AssessmentResponseMap, instrument = dhiArgentina) {
  const validValues = new Set([0, 2, 4])
  const answered = instrument.questions.filter((question) => validValues.has(responses[question.id] ?? Number.NaN))
  const subscales: Record<AssessmentDomainCode, number> = { physical: 0, emotional: 0, functional: 0 }
  for (const question of answered) subscales[question.domain] += Number(responses[question.id])
  return {
    answeredCount: answered.length,
    complete: answered.length === instrument.questions.length,
    total: answered.reduce((sum, question) => sum + Number(responses[question.id]), 0),
    subscales,
  }
}
