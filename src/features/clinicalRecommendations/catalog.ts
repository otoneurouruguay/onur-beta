import { clinicalSourceIds } from '../clinicalGeneration/catalog'

export type PathologyRecommendationId =
  | 'unilateral_hypofunction'
  | 'bilateral_hypofunction'
  | 'bppv'
  | 'vestibular_migraine'
  | 'pppd'
  | 'visually_induced_dizziness'
  | 'motion_sickness'
  | 'meniere'
  | 'presbyvestibulopathy'
  | 'mild_tbi'
  | 'vestibular_schwannoma'

export interface RehabilitationOption {
  title: string
  summary: string
  templateIds: string[]
}

export interface PathologyRecommendation {
  id: PathologyRecommendationId
  label: string
  clinicalFrame: string
  evidence: 'direct' | 'mixed' | 'indirect' | 'governance'
  evidenceNote: string
  sourceIds: `SRC-${string}`[]
  options: RehabilitationOption[]
  cautions: string[]
}

export const pathologyRecommendations: readonly PathologyRecommendation[] = [
  {
    id: 'unilateral_hypofunction',
    label: 'Hipofunción vestibular unilateral / neuritis',
    clinicalFrame: 'Para déficit periférico unilateral confirmado y clínicamente estable. La selección se ajusta a agudeza visual dinámica, tolerancia al movimiento, equilibrio y marcha.',
    evidence: 'direct',
    evidenceNote: 'Guía de práctica, revisión Cochrane y estudios específicos de neuritis e hipofunción unilateral.',
    sourceIds: ['SRC-001', 'SRC-002', 'SRC-004', 'SRC-005', 'SRC-006', 'SRC-031'],
    options: [
      { title: 'Adaptación y estabilidad de mirada', summary: 'Comenzar con RVO x1 y progresar una sola variable; RVO x2 u objetivo recordado requieren indicación y control profesional.', templateIds: ['template-rvo-bars', 'template-rvo-x2-horizontal', 'template-rvo-x2-vertical', 'template-rvo-x2-diagonal', 'template-remembered-target'] },
      { title: 'Equilibrio y marcha', summary: 'Agregar transferencia de peso y marcha con giros cefálicos según estabilidad, riesgo de caída y ayudas disponibles.', templateIds: ['template-functional-weight-shifts', 'template-functional-gait-head-turns'] },
    ],
    cautions: ['Confirmar que no persisten signos de síndrome vestibular agudo central.', 'No equiparar seguimiento ocular o sacadas con adaptación del RVO.', 'Aumentar velocidad, amplitud, postura o complejidad de a una variable.'],
  },
  {
    id: 'bilateral_hypofunction',
    label: 'Hipofunción vestibular bilateral',
    clinicalFrame: 'Prioriza estabilidad de mirada, sustitución, equilibrio y estrategias funcionales con atención especial a oscuridad, terreno irregular y oscilopsia.',
    evidence: 'direct',
    evidenceNote: 'Guía de hipofunción periférica y evidencia específica en hipofunción bilateral.',
    sourceIds: ['SRC-001', 'SRC-007', 'SRC-008'],
    options: [
      { title: 'Mirada y sustitución', summary: 'Usar RVO x1 o sustitución por objetivo recordado según el déficit y la estrategia observada.', templateIds: ['template-rvo-bars', 'template-remembered-target'] },
      { title: 'Control postural y marcha', summary: 'Entrenar tareas funcionales con apoyo, iluminación y supervisión definidos antes de reducir señales visuales.', templateIds: ['template-functional-weight-shifts', 'template-functional-gait-head-turns'] },
    ],
    cautions: ['No retirar visión o apoyo somatosensorial sin control previo del riesgo de caída.', 'Evitar visor o superficie inestable durante la fase inicial.'],
  },
  {
    id: 'bppv',
    label: 'VPPB / vértigo posicional paroxístico benigno',
    clinicalFrame: 'El tratamiento principal es la maniobra de reposicionamiento correspondiente al canal y lado confirmados; el constructor visual no reemplaza esa decisión.',
    evidence: 'governance',
    evidenceNote: 'Guía clínica y criterios diagnósticos específicos de VPPB.',
    sourceIds: ['SRC-012', 'SRC-013'],
    options: [
      { title: 'Después de la maniobra, si queda inestabilidad', summary: 'Solo si la reevaluación lo indica, considerar equilibrio o marcha graduada para déficit residual; no usar estímulos visuales para “tratar el canal”.', templateIds: ['template-functional-weight-shifts'] },
    ],
    cautions: ['No generar una maniobra sin identificar canal, lado y variante.', 'Reevaluar si persisten síntomas atípicos o signos neurológicos.'],
  },
  {
    id: 'vestibular_migraine',
    label: 'Migraña vestibular',
    clinicalFrame: 'La rehabilitación puede complementar el manejo médico cuando hay mareo, desequilibrio, intolerancia al movimiento o déficit vestibular entre crisis.',
    evidence: 'direct',
    evidenceNote: 'Dos revisiones sistemáticas recientes y criterios diagnósticos de consenso.',
    sourceIds: ['SRC-014', 'SRC-015', 'SRC-016'],
    options: [
      { title: 'Exposición visual suave y graduada', summary: 'Empezar por patrones lentos y breves, con techo sintomático y recuperación acordados.', templateIds: ['template-habituation-low', 'template-optokinetic-low'] },
      { title: 'Mirada y equilibrio si existe déficit medido', summary: 'Añadir estabilización o tareas funcionales según hallazgos, no solo por el diagnóstico.', templateIds: ['template-rvo-bars', 'template-functional-weight-shifts'] },
    ],
    cautions: ['No usar durante una crisis activa ni con aura o fotofobia intensa.', 'Las variantes estroboscópicas no se recomiendan para migraña vestibular.', 'Coordinar con el plan médico y controlar cefalea, náusea y recuperación.'],
  },
  {
    id: 'pppd',
    label: 'PPPD / mareo postural-perceptual persistente',
    clinicalFrame: 'Combina habituación visual, exposición funcional e integración sensorial graduadas según disparadores y evitación, sin forzar síntomas intensos.',
    evidence: 'direct',
    evidenceNote: 'Revisiones y estudio clínico específicos de PPPD, más evidencia de estimulación optocinética.',
    sourceIds: ['SRC-017', 'SRC-018', 'SRC-019', 'SRC-022'],
    options: [
      { title: 'Habituación visual', summary: 'Progresión de campo visual simple a mayor densidad o velocidad, cambiando una sola variable.', templateIds: ['template-pppd-habituation-1', 'template-pppd-habituation-2', 'template-pppd-habituation-3'] },
      { title: 'Optocinético y función', summary: 'Combinar estimulación visual dosificada con tareas funcionales que recuperen participación.', templateIds: ['template-pppd-optokinetic-1', 'template-pppd-optokinetic-2', 'template-pppd-functional-1', 'template-pppd-functional-2'] },
      { title: 'Contextos 360° en clínica', summary: 'Usar escenarios revisados solo cuando la exposición 2D sea tolerada y exista supervisión directa.', templateIds: ['template-immersive-street_quiet', 'template-immersive-market_arcade'] },
    ],
    cautions: ['No progresar automáticamente por nivel.', 'Vincular las exposiciones con objetivos funcionales y recuperación entre sesiones.', 'Las variantes estroboscópicas siguen siendo experimentales y no forman parte del protocolo PPPD.'],
  },
  {
    id: 'visually_induced_dizziness',
    label: 'Mareo visual / mareo inducido visualmente',
    clinicalFrame: 'Para síntomas provocados por escenas visuales complejas o movimiento del campo visual, luego de confirmar el contexto clínico y descartar alertas.',
    evidence: 'direct',
    evidenceNote: 'Evidencia específica de estimulación optocinética en mareo inducido visualmente, apoyada por rehabilitación vestibular general.',
    sourceIds: ['SRC-001', 'SRC-022'],
    options: [
      { title: 'Habituación de baja carga', summary: 'Iniciar sentado con patrón lento y exposición breve; aumentar densidad, dirección o tiempo por separado.', templateIds: ['template-habituation-low', 'template-pppd-habituation-1', 'template-pppd-habituation-2'] },
      { title: 'Optocinético graduado', summary: 'Usar barras o puntos sin blanco fijo y registrar respuesta y recuperación.', templateIds: ['template-optokinetic-low', 'template-pppd-optokinetic-1', 'template-pppd-optokinetic-2'] },
    ],
    cautions: ['Detener ante síntomas neurológicos nuevos, visión doble, cefalea intensa o náusea marcada.', 'No sumar intermitencia, velocidad y postura desafiante en el mismo paso.'],
  },
  {
    id: 'motion_sickness',
    label: 'Cinetosis / susceptibilidad al movimiento',
    clinicalFrame: 'La biblioteca ofrece opciones de habituación y control visual graduado; la evidencia del catálogo es indirecta y no define una dosis única para cinetosis.',
    evidence: 'indirect',
    evidenceNote: 'Extrapolación prudente desde rehabilitación vestibular general y mareo inducido visualmente.',
    sourceIds: ['SRC-001', 'SRC-003', 'SRC-022'],
    options: [
      { title: 'Habituación a movimiento visual', summary: 'Exposición breve y repetible al disparador visual, empezando por baja velocidad y posición sentada.', templateIds: ['template-habituation-low', 'template-optokinetic-low'] },
      { title: 'Estabilidad visual si hay déficit asociado', summary: 'Agregar RVO x1 únicamente si la evaluación muestra una alteración de estabilidad de mirada.', templateIds: ['template-rvo-bars'] },
    ],
    cautions: ['No presentar estas opciones como prevención garantizada de cinetosis.', 'Evitar variantes estroboscópicas si hay migraña, fotofobia o respuesta adversa a destellos.', 'Diferenciar cinetosis de cuadros agudos o neurológicos nuevos.'],
  },
  {
    id: 'meniere',
    label: 'Enfermedad de Ménière',
    clinicalFrame: 'La rehabilitación se considera entre crisis cuando persisten inestabilidad o déficit vestibular; no sustituye el manejo médico ni se indica durante un episodio agudo fluctuante.',
    evidence: 'direct',
    evidenceNote: 'Estudio específico y guía reciente de rehabilitación en enfermedad de Ménière.',
    sourceIds: ['SRC-020', 'SRC-021'],
    options: [
      { title: 'Déficit residual entre crisis', summary: 'Elegir estabilidad de mirada, equilibrio o marcha según hallazgos persistentes y estabilidad clínica.', templateIds: ['template-rvo-bars', 'template-functional-weight-shifts', 'template-functional-gait-head-turns'] },
    ],
    cautions: ['No iniciar ni progresar durante una crisis aguda.', 'Reevaluar cambios auditivos, plenitud, tinnitus y fluctuación del equilibrio.'],
  },
  {
    id: 'presbyvestibulopathy',
    label: 'Presbivestibulopatía / mareo en adulto mayor',
    clinicalFrame: 'Prioriza seguridad, función, equilibrio y marcha, considerando visión, sensibilidad, fuerza, medicación y riesgo de caída.',
    evidence: 'mixed',
    evidenceNote: 'Criterios de presbivestibulopatía, revisión de intervenciones y evidencia de riesgo de caídas.',
    sourceIds: ['SRC-001', 'SRC-009', 'SRC-010', 'SRC-011', 'SRC-032', 'SRC-033'],
    options: [
      { title: 'Equilibrio funcional', summary: 'Comenzar con transferencias de peso y progresar a marcha con apoyo o ayudante según riesgo.', templateIds: ['template-functional-weight-shifts', 'template-functional-gait-head-turns'] },
      { title: 'Mirada si existe hipofunción', summary: 'RVO x1 sentado en condiciones simples antes de agregar postura o superficie.', templateIds: ['template-rvo-bars'] },
      { title: 'Imágenes y doble tarea de baja carga', summary: 'La secuencia de figuras puede usarse como tarea cognitivo-visual aislada antes de combinarla con equilibrio o marcha.', templateIds: ['template-rapid-images-soft'] },
    ],
    cautions: ['Revisar riesgo de caída y ayudas técnicas antes de indicar marcha.', 'La intermitencia estroboscópica tiene solo un protocolo de investigación, no evidencia de eficacia; uso exclusivamente experimental.'],
  },
  {
    id: 'mild_tbi',
    label: 'Traumatismo craneoencefálico leve / posconmoción',
    clinicalFrame: 'La rehabilitación debe ser individualizada y multimodal; los síntomas visuales, cefalea, cuello, equilibrio y tolerancia al esfuerzo requieren evaluación específica.',
    evidence: 'direct',
    evidenceNote: 'Revisión específica de rehabilitación vestibular en traumatismo craneoencefálico leve.',
    sourceIds: ['SRC-025'],
    options: [
      { title: 'Oculomotor y vestibular según hallazgo', summary: 'Seleccionar seguimiento, sacadas o estabilidad de mirada solo cuando la evaluación identifique el objetivo correspondiente.', templateIds: ['template-pursuit-horizontal', 'template-saccades-horizontal', 'template-saccades-vertical', 'template-rvo-bars'] },
      { title: 'Equilibrio y retorno funcional', summary: 'Agregar control postural de baja complejidad y coordinar la progresión con tolerancia general al esfuerzo.', templateIds: ['template-functional-weight-shifts'] },
    ],
    cautions: ['No usar exposición estroboscópica con fotofobia, cefalea o síntomas visuales activos.', 'Detener y derivar ante empeoramiento neurológico, cefalea intensa nueva o visión doble.'],
  },
  {
    id: 'vestibular_schwannoma',
    label: 'Schwannoma vestibular / compensación perioperatoria',
    clinicalFrame: 'La selección depende de etapa, tratamiento, función vestibular restante, audición y estado posoperatorio; requiere coordinación con el equipo tratante.',
    evidence: 'direct',
    evidenceNote: 'Revisión sistemática específica de rehabilitación en schwannoma vestibular.',
    sourceIds: ['SRC-028'],
    options: [
      { title: 'Mirada, equilibrio y marcha', summary: 'Elegir objetivos medidos y progresar desde postura segura hacia función, respetando las restricciones perioperatorias.', templateIds: ['template-rvo-bars', 'template-functional-weight-shifts', 'template-functional-gait-head-turns'] },
    ],
    cautions: ['Coordinar tiempos y restricciones con cirugía, neurotología y rehabilitación.', 'No inferir el lado o la dosis desde el diagnóstico escrito.'],
  },
]

export function validatePathologyRecommendationCatalog() {
  return pathologyRecommendations.every((pathology) =>
    pathology.sourceIds.length > 0
    && pathology.sourceIds.every((sourceId) => clinicalSourceIds.has(sourceId)),
  )
}
