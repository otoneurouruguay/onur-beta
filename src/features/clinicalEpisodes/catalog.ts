import { pathologyRecommendations, type PathologyRecommendationId } from '../clinicalRecommendations/catalog'
import type { ClinicalEpisodeRecord, ClinicalEpisodeValues, ClinicalExerciseSuggestion, EpisodeClinicalSummary } from './types'

export interface PathologyFieldDefinition {
  id: string
  label: string
  type?: 'text' | 'select' | 'boolean'
  options?: readonly { value: string; label: string }[]
  help?: string
}

export interface PathologyModule {
  id: PathologyRecommendationId
  description: string
  requiredClinicalData: string[]
  fields: PathologyFieldDefinition[]
}

const yesNoUnknown = [
  { value: '', label: 'Sin registrar' },
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'No determinado' },
] as const

export const pathologyModules: readonly PathologyModule[] = [
  {
    id: 'unilateral_hypofunction',
    description: 'Pérdida o reducción de la función vestibular de un lado. La fase, el lado, la estabilidad clínica y los déficits medidos modifican tanto la selección como la dosis.',
    requiredClinicalData: ['Lado afectado', 'Fecha de inicio y fase', 'vHIT/HIT o prueba vestibular que sustenta el diagnóstico', 'Agudeza visual dinámica, equilibrio, marcha y riesgo de caída'],
    fields: [
      { id: 'spontaneousNystagmus', label: 'Nistagmo espontáneo actual', type: 'select', options: yesNoUnknown },
      { id: 'vhitSummary', label: 'vHIT/HIT: ganancia, sacadas y lado' },
      { id: 'dynamicVisualAcuity', label: 'Agudeza visual dinámica' },
      { id: 'centralSignsExcluded', label: 'Signos centrales evaluados/descartados', type: 'select', options: yesNoUnknown },
    ],
  },
  {
    id: 'bilateral_hypofunction',
    description: 'Reducción vestibular periférica de ambos lados, típicamente con oscilopsia e inestabilidad que aumenta en oscuridad o superficies irregulares.',
    requiredClinicalData: ['Confirmación bilateral objetiva', 'Oscilopsia', 'Rendimiento en oscuridad/superficie irregular', 'Ayuda técnica y riesgo de caída'],
    fields: [
      { id: 'bilateralTestSummary', label: 'vHIT/calóricas/sillón rotatorio: resumen bilateral' },
      { id: 'oscillopsia', label: 'Oscilopsia durante marcha o movimientos cefálicos', type: 'select', options: yesNoUnknown },
      { id: 'darknessInstability', label: 'Empeora en oscuridad o terreno irregular', type: 'select', options: yesNoUnknown },
      { id: 'assistiveDevice', label: 'Ayuda técnica habitual' },
    ],
  },
  {
    id: 'bppv',
    description: 'Vértigo posicional por desplazamiento de otoconias. El tratamiento principal es una maniobra específica para el canal, lado y variante confirmados.',
    requiredClinicalData: ['Canal', 'Lado', 'Canalolitiasis/cupulolitiasis', 'Prueba posicional y nistagmo', 'Respuesta a la maniobra'],
    fields: [
      { id: 'canal', label: 'Canal comprometido', type: 'select', options: [{ value: '', label: 'Sin registrar' }, { value: 'posterior', label: 'Posterior' }, { value: 'horizontal', label: 'Horizontal' }, { value: 'anterior', label: 'Anterior' }] },
      { id: 'variant', label: 'Variante', type: 'select', options: [{ value: '', label: 'Sin registrar' }, { value: 'canalithiasis', label: 'Canalolitiasis' }, { value: 'cupulolithiasis', label: 'Cupulolitiasis' }, { value: 'uncertain', label: 'No determinada' }] },
      { id: 'positionalTest', label: 'Prueba posicional y patrón de nistagmo' },
      { id: 'repositioningResponse', label: 'Maniobra realizada y respuesta' },
    ],
  },
  {
    id: 'pppd',
    description: 'Trastorno vestibular funcional crónico con mareo, inestabilidad o vértigo no giratorio la mayoría de los días durante al menos tres meses, agravado por postura erguida, movimiento y complejidad visual.',
    requiredClinicalData: ['Duración ≥3 meses', 'Tres agravantes de criterios Bárány', 'Evento precipitante', 'Impacto funcional', 'Comorbilidades y déficit vestibular coexistente'],
    fields: [
      { id: 'mostDaysThreeMonths', label: 'Síntomas la mayoría de los días ≥3 meses', type: 'select', options: yesNoUnknown },
      { id: 'uprightExacerbation', label: 'Empeora de pie', type: 'select', options: yesNoUnknown },
      { id: 'motionExacerbation', label: 'Empeora con movimiento activo/pasivo', type: 'select', options: yesNoUnknown },
      { id: 'visualExacerbation', label: 'Empeora con escenas visuales complejas', type: 'select', options: yesNoUnknown },
      { id: 'precipitatingEvent', label: 'Evento precipitante o condición coexistente' },
    ],
  },
  {
    id: 'vestibular_migraine',
    description: 'Síndrome episódico en el que los síntomas vestibulares se relacionan con antecedentes y rasgos migrañosos. La rehabilitación se individualiza entre crisis y según déficits medidos.',
    requiredClinicalData: ['Frecuencia/duración de episodios', 'Historia de migraña', 'Rasgos migrañosos durante episodios', 'Estado interictal', 'Fotofobia y tolerancia visual'],
    fields: [
      { id: 'episodePattern', label: 'Frecuencia y duración de episodios' },
      { id: 'migraineFeatures', label: 'Rasgos migrañosos asociados' },
      { id: 'activeAttack', label: 'Crisis activa al momento de planificar', type: 'select', options: yesNoUnknown },
      { id: 'photophobia', label: 'Fotofobia relevante', type: 'select', options: yesNoUnknown },
    ],
  },
  {
    id: 'meniere',
    description: 'Trastorno vestibular episódico con síntomas auditivos fluctuantes. La rehabilitación se orienta al déficit residual estable entre crisis y no reemplaza el manejo médico.',
    requiredClinicalData: ['Estado de crisis/intercrisis', 'Audición fluctuante', 'Tinnitus/plenitud', 'Déficit vestibular residual', 'Caídas de Tumarkin si existen'],
    fields: [
      { id: 'activeAttack', label: 'Crisis activa', type: 'select', options: yesNoUnknown },
      { id: 'auditoryFluctuation', label: 'Fluctuación auditiva/tinnitus/plenitud' },
      { id: 'residualDeficit', label: 'Déficit vestibular residual medido' },
      { id: 'dropAttacks', label: 'Crisis otolíticas/caídas súbitas', type: 'select', options: yesNoUnknown },
    ],
  },
  {
    id: 'presbyvestibulopathy',
    description: 'Síndrome vestibular crónico en mayores de 60 años con hipofunción bilateral leve documentada, que suele coexistir con cambios visuales, somatosensoriales, musculares y cognitivos.',
    requiredClinicalData: ['Edad ≥60', 'Hipofunción bilateral leve objetiva', 'Caídas/marcha', 'Visión, sensibilidad, fuerza y cognición', 'Medicación y ayudas'],
    fields: [
      { id: 'bilateralMildDeficit', label: 'Déficit bilateral leve documentado', type: 'select', options: yesNoUnknown },
      { id: 'sensoryComorbidities', label: 'Déficits visuales/somatosensoriales' },
      { id: 'strengthAndFrailty', label: 'Fuerza, fragilidad y tolerancia al esfuerzo' },
      { id: 'dualTask', label: 'Rendimiento en doble tarea' },
    ],
  },
  {
    id: 'mild_tbi',
    description: 'Cuadro posconmoción que puede combinar alteraciones vestibulares, oculomotoras, cervicales, cefalea, cognición y tolerancia al esfuerzo; requiere una planificación multimodal.',
    requiredClinicalData: ['Fecha/mecanismo del trauma', 'Banderas rojas', 'Cefalea y cuello', 'Oculomotor/vestibular', 'Tolerancia al esfuerzo y cognición'],
    fields: [
      { id: 'injuryMechanism', label: 'Mecanismo del traumatismo' },
      { id: 'redFlagsExcluded', label: 'Banderas rojas evaluadas', type: 'select', options: yesNoUnknown },
      { id: 'exertionTolerance', label: 'Tolerancia al esfuerzo' },
      { id: 'oculomotorFindings', label: 'Hallazgos oculomotores/vestibulares' },
    ],
  },
  {
    id: 'vestibular_schwannoma',
    description: 'Lesión del nervio vestibular cuya rehabilitación depende de la función residual, tratamiento elegido y etapa preoperatoria o posoperatoria.',
    requiredClinicalData: ['Lado', 'Tratamiento/etapa', 'Función vestibular y auditiva residual', 'Restricciones del equipo tratante', 'Equilibrio y marcha'],
    fields: [
      { id: 'treatmentStage', label: 'Etapa', type: 'select', options: [{ value: '', label: 'Sin registrar' }, { value: 'observation', label: 'Observación' }, { value: 'preoperative', label: 'Preoperatoria' }, { value: 'postoperative', label: 'Posoperatoria' }, { value: 'radiotherapy', label: 'Radioterapia' }] },
      { id: 'teamRestrictions', label: 'Restricciones del equipo tratante' },
      { id: 'residualFunction', label: 'Función vestibular/auditiva residual' },
    ],
  },
]

const suggestionCatalog: readonly ClinicalExerciseSuggestion[] = [
  { id: 'uvh-rvo-x1', diagnosisCode: 'unilateral_hypofunction', title: 'RVO x1 con blanco estable', kind: 'platform', templateId: 'template-rvo-bars', targetImpairment: 'Estabilidad de mirada y oscilopsia', rationale: 'Entrena adaptación del RVO con movimiento cefálico y blanco estable.', execution: 'Comenzar sentado, blanco nítido y velocidad tolerable; la cabeza se mueve y el blanco no.', dose: 'Aguda/subaguda: total diario mínimo orientativo 12 min; crónica: total diario mínimo orientativo 20 min, distribuido en 3–5 bloques. Ajustar individualmente.', progression: 'Cambiar una sola variable: velocidad, amplitud, duración, postura o fondo.', regression: 'Reducir velocidad/duración, volver a sentado o simplificar el fondo.', pauseCriteria: 'Pérdida persistente de nitidez, síntomas que superen el techo acordado, signos neurológicos nuevos o recuperación excesiva.', sourceIds: ['SRC-001', 'SRC-004'] },
  { id: 'uvh-balance', diagnosisCode: 'unilateral_hypofunction', title: 'Transferencias de peso y equilibrio', kind: 'platform', templateId: 'template-functional-weight-shifts', targetImpairment: 'Control postural', rationale: 'Aborda inestabilidad medida y permite graduar apoyo y postura.', execution: 'Junto a apoyo estable y según riesgo de caída.', dose: 'Bloques breves repetidos; el profesional define series y descansos según calidad.', progression: 'Reducir apoyo o ampliar alcance, de a una variable.', regression: 'Aumentar base y apoyo, o realizar sentado.', pauseCriteria: 'Pérdida de control, necesidad de ayuda física no prevista o síntomas nuevos.', sourceIds: ['SRC-001'] },
  { id: 'uvh-walk', diagnosisCode: 'unilateral_hypofunction', title: 'Marcha con giros cefálicos', kind: 'external', targetImpairment: 'Marcha y estabilidad dinámica', rationale: 'Transfiere la compensación a una tarea funcional.', execution: 'Pasillo despejado, apoyo o ayudante según evaluación; alternar giros horizontales lentos.', dose: '3–5 pasadas cortas con pausa y control de calidad.', progression: 'Aumentar distancia o velocidad, nunca ambas juntas.', regression: 'Marcha sin giro cefálico o ejercicio junto a barra.', pauseCriteria: 'Desvío peligroso, tropiezo, visión doble o pérdida de equilibrio.', sourceIds: ['SRC-001'] },
  { id: 'bvh-rvo', diagnosisCode: 'bilateral_hypofunction', title: 'RVO x1 bilateral', kind: 'platform', templateId: 'template-rvo-bars', targetImpairment: 'Oscilopsia y estabilidad de mirada', rationale: 'La práctica específica de mirada es parte del abordaje combinado de la hipofunción bilateral.', execution: 'Sentado, fondo simple, amplitud pequeña y blanco nítido.', dose: 'Total diario orientativo 20–40 min distribuido en 3–5 bloques, individualizado.', progression: 'Velocidad o duración primero; postura después.', regression: 'Reducir velocidad, amplitud o tiempo.', pauseCriteria: 'Visión borrosa persistente, náusea importante o recuperación fuera del límite acordado.', sourceIds: ['SRC-001', 'SRC-007'] },
  { id: 'bvh-wall-targets', diagnosisCode: 'bilateral_hypofunction', title: 'Blancos reales en pared', kind: 'external', targetImpairment: 'Sustitución visual y estabilidad funcional', rationale: 'Permite practicar estrategias con referencias reales sin depender de la plataforma.', execution: 'Colocar dos marcas grandes a la altura de los ojos; alternar mirada y luego cabeza según indicación.', dose: '2–3 series breves, priorizando precisión.', progression: 'Separar blancos o reducir tamaño de forma gradual.', regression: 'Aumentar tamaño y reducir separación.', pauseCriteria: 'Pérdida de equilibrio o incapacidad para localizar el blanco.', sourceIds: ['SRC-001', 'SRC-008'] },
  { id: 'bvh-function', diagnosisCode: 'bilateral_hypofunction', title: 'Equilibrio funcional con apoyo', kind: 'platform', templateId: 'template-functional-weight-shifts', targetImpairment: 'Equilibrio con menor señal vestibular', rationale: 'Entrena estrategias sensoriales y funcionales preservando seguridad.', execution: 'Superficie firme, buena iluminación y apoyo estable.', dose: '3 bloques de 30–60 s según tolerancia.', progression: 'Modificar apoyo o base antes que iluminación/superficie.', regression: 'Mayor apoyo y base, o sentado.', pauseCriteria: 'No retirar visión o apoyo si el control no es seguro.', sourceIds: ['SRC-001'] },
  { id: 'bppv-reposition', diagnosisCode: 'bppv', title: 'Maniobra de reposicionamiento específica', kind: 'external', targetImpairment: 'VPPB activo', rationale: 'Es la intervención principal cuando canal, lado y variante fueron identificados.', execution: 'Debe realizarla un profesional entrenado según el patrón posicional confirmado.', dose: 'Según guía y respuesta en la reevaluación; no se automatiza.', progression: 'Reevaluar prueba posicional y síntomas.', regression: 'No corresponde; reconsiderar diagnóstico/variante si la respuesta no es la esperada.', pauseCriteria: 'Signos neurológicos, patrón atípico, intolerancia cervical o contraindicación vascular/musculoesquelética.', sourceIds: ['SRC-012', 'SRC-013'] },
  { id: 'pppd-habituation', diagnosisCode: 'pppd', title: 'Habituación visual inicial', kind: 'platform', templateId: 'template-pppd-habituation-1', targetImpairment: 'Intolerancia a movimiento visual', rationale: 'Exposición graduada a un disparador definido, vinculada a recuperación funcional.', execution: 'Sentado, estímulo simple y consigna clara; registrar síntomas y recuperación.', dose: 'Exposición breve definida por el profesional y repetida solo si recupera dentro de la ventana acordada.', progression: 'Aumentar tiempo, densidad o velocidad de a una variable.', regression: 'Menor campo visual, velocidad o duración.', pauseCriteria: 'Escalada sostenida, pánico no manejable, síntomas neurológicos o recuperación tardía excesiva.', sourceIds: ['SRC-017', 'SRC-018', 'SRC-022'] },
  { id: 'pppd-real-world', diagnosisCode: 'pppd', title: 'Exposición funcional a contexto real', kind: 'external', targetImpairment: 'Evitación y restricción de participación', rationale: 'La exposición debe acercarse a una meta real y no quedar limitada a estímulos en pantalla.', execution: 'Planificar una tarea concreta, por ejemplo pasillo tranquilo de supermercado acompañado, con entrada y salida acordadas.', dose: 'Una exposición breve con registro antes/después y recuperación.', progression: 'Aumentar complejidad ambiental o duración, no ambas.', regression: 'Horario tranquilo, trayecto más corto o acompañamiento mayor.', pauseCriteria: 'Síntomas fuera del techo, pérdida de seguridad o recuperación tardía no aceptable.', sourceIds: ['SRC-017', 'SRC-018'] },
  { id: 'vm-visual', diagnosisCode: 'vestibular_migraine', title: 'Exposición visual suave interictal', kind: 'platform', templateId: 'template-habituation-low', targetImpairment: 'Sensibilidad visual entre crisis', rationale: 'Puede complementar el manejo multimodal cuando existe intolerancia visual persistente.', execution: 'Solo fuera de crisis activa, estímulo lento, sentado y sin intermitencia.', dose: 'Comenzar con 20–30 s y recuperación completa; ajustar por respuesta.', progression: 'Aumentar una sola variable.', regression: 'Reducir contraste, velocidad o tiempo.', pauseCriteria: 'Cefalea creciente, aura, fotofobia intensa o náusea marcada.', sourceIds: ['SRC-014', 'SRC-015'] },
  { id: 'meniere-balance', diagnosisCode: 'meniere', title: 'Equilibrio por déficit residual', kind: 'platform', templateId: 'template-functional-weight-shifts', targetImpairment: 'Inestabilidad interictal', rationale: 'Se considera cuando hay déficit residual estable entre crisis.', execution: 'Superficie firme y apoyo de seguridad.', dose: 'Bloques breves definidos por desempeño.', progression: 'Modificar una variable tras estabilidad entre crisis.', regression: 'Mayor apoyo o tarea sentada.', pauseCriteria: 'Crisis activa, fluctuación auditiva importante o empeoramiento súbito.', sourceIds: ['SRC-020', 'SRC-021'] },
  { id: 'presby-strength-balance', diagnosisCode: 'presbyvestibulopathy', title: 'Equilibrio y función con apoyo', kind: 'platform', templateId: 'template-functional-weight-shifts', targetImpairment: 'Equilibrio, fuerza funcional y caídas', rationale: 'Prioriza función y seguridad en un cuadro multisensorial.', execution: 'Cerca de apoyo estable; considerar calzado, visión, sensibilidad y ayuda técnica.', dose: '2–3 bloques breves con descanso suficiente.', progression: 'Base, apoyo, alcance o doble tarea de a una variable.', regression: 'Sentado o con mayor apoyo.', pauseCriteria: 'Inestabilidad no controlable, fatiga desproporcionada o dolor.', sourceIds: ['SRC-001', 'SRC-009', 'SRC-010'] },
  { id: 'presby-cognitive', diagnosisCode: 'presbyvestibulopathy', title: 'Atención visual aislada', kind: 'platform', templateId: 'template-rapid-images-soft', targetImpairment: 'Atención sostenida/selectiva', rationale: 'Permite medir comprensión y respuesta cognitiva antes de combinarla con postura o marcha.', execution: 'Explicar la consigna antes de comenzar y comprobar que pueda repetirla.', dose: '1 bloque corto; registrar aciertos/omisiones.', progression: 'Aumentar cantidad de estímulos o memoria, sin agregar simultáneamente desafío postural.', regression: 'Menos símbolos, mayor tiempo de presentación.', pauseCriteria: 'Confusión, fatiga o frustración creciente.', sourceIds: ['SRC-032', 'SRC-033'] },
  { id: 'tbi-oculomotor', diagnosisCode: 'mild_tbi', title: 'Oculomotor según hallazgo', kind: 'platform', templateId: 'template-pursuit-horizontal', targetImpairment: 'Seguimiento ocular medido', rationale: 'El ejercicio debe corresponder al hallazgo oculomotor, no al diagnóstico genérico.', execution: 'Cabeza quieta, rango cómodo y control de cefalea/cuello.', dose: 'Bloque breve individualizado, con recuperación registrada.', progression: 'Velocidad o amplitud de a una variable.', regression: 'Menor amplitud/velocidad o más descanso.', pauseCriteria: 'Cefalea intensa nueva, diplopía, síntomas neurológicos o deterioro sostenido.', sourceIds: ['SRC-025'] },
  { id: 'schwannoma-rvo', diagnosisCode: 'vestibular_schwannoma', title: 'Estabilidad de mirada perioperatoria', kind: 'platform', templateId: 'template-rvo-bars', targetImpairment: 'Déficit de RVO medido', rationale: 'Puede integrar el plan cuando el equipo tratante confirma etapa y restricciones.', execution: 'Según lado, función residual y restricciones médicas.', dose: 'Individualizada por etapa y respuesta.', progression: 'Una variable por vez y vinculada a función.', regression: 'Reducir carga o volver a tarea sentada.', pauseCriteria: 'Restricción quirúrgica, síntomas neurológicos nuevos o deterioro auditivo/vestibular agudo.', sourceIds: ['SRC-028'] },
]

function hasText(value: string | undefined) {
  return Boolean(value?.trim())
}

export function getPathologyModule(id: PathologyRecommendationId) {
  return pathologyModules.find((module) => module.id === id) ?? pathologyModules[0]
}

export function buildEpisodeClinicalSummary(episode: ClinicalEpisodeRecord | ClinicalEpisodeValues): EpisodeClinicalSummary {
  const module = getPathologyModule(episode.diagnosisCode)
  const patientFindings = [
    episode.laterality !== 'unknown' && episode.laterality !== 'not_applicable' ? `Lateralidad: ${episode.laterality === 'left' ? 'izquierda' : episode.laterality === 'right' ? 'derecha' : 'bilateral'}.` : '',
    episode.phase !== 'unknown' ? `Fase registrada: ${episode.phase}.` : '',
    hasText(episode.measuredImpairments) ? `Déficits medidos: ${episode.measuredImpairments.trim()}` : '',
    hasText(episode.activityLimitations) ? `Limitaciones: ${episode.activityLimitations.trim()}` : '',
  ].filter(Boolean) as string[]
  const treatedDeficits = [episode.measuredImpairments, episode.activityLimitations, episode.participationGoals].filter(hasText)
  const warnings: string[] = []
  if (episode.anamnesis.fallRisk === 'high') warnings.push('Riesgo de caída alto: evitar marcha, superficie inestable o visor sin supervisión profesional directa.')
  if (episode.diagnosisCode === 'bppv') warnings.push('El constructor no reemplaza la maniobra específica por canal, lado y variante.')
  if (episode.diagnosisCode === 'pppd' && episode.pathologyFindings.mostDaysThreeMonths !== 'yes') warnings.push('No presentar PPPD como confirmado si no se documentan síntomas la mayoría de los días durante al menos tres meses.')
  if (episode.diagnosisCode === 'vestibular_migraine' && episode.pathologyFindings.activeAttack === 'yes') warnings.push('Crisis migrañosa activa: no iniciar exposición visual ni progresar carga.')
  if (episode.diagnosisCode === 'meniere' && episode.pathologyFindings.activeAttack === 'yes') warnings.push('Crisis activa de Ménière: posponer rehabilitación y priorizar el manejo clínico correspondiente.')
  if (episode.diagnosisCode === 'unilateral_hypofunction' && episode.phase === 'acute' && episode.pathologyFindings.centralSignsExcluded !== 'yes') warnings.push('Síndrome vestibular agudo: documentar evaluación de signos centrales antes de sugerir trabajo domiciliario.')
  if (hasText(episode.precautions)) warnings.push(episode.precautions.trim())
  const pending = [
    !hasText(episode.diagnosisSource) ? 'Profesional y criterio que sustentan el diagnóstico.' : '',
    !hasText(episode.onsetDate) ? 'Fecha de inicio o mejor estimación clínica.' : '',
    episode.anamnesis.fallRisk === 'not_assessed' ? 'Riesgo de caída.' : '',
    !hasText(episode.measuredImpairments) ? 'Déficit objetivo que se desea tratar.' : '',
    ...module.fields.filter((field) => !String(episode.pathologyFindings[field.id] ?? '').trim()).map((field) => field.label),
    ...(hasText(episode.pendingData) ? [episode.pendingData.trim()] : []),
  ].filter(Boolean) as string[]
  let suggestions = suggestionCatalog.filter((suggestion) => suggestion.diagnosisCode === episode.diagnosisCode)
  const temporarilyBlocked = (episode.diagnosisCode === 'meniere' || episode.diagnosisCode === 'vestibular_migraine') && episode.pathologyFindings.activeAttack === 'yes'
    || episode.diagnosisCode === 'unilateral_hypofunction' && episode.phase === 'acute' && episode.pathologyFindings.centralSignsExcluded !== 'yes'
    || episode.diagnosisCode === 'pppd' && episode.pathologyFindings.mostDaysThreeMonths !== 'yes'
  if (temporarilyBlocked) suggestions = []
  if (episode.anamnesis.fallRisk === 'high') suggestions = suggestions.filter((suggestion) => !/marcha/i.test(suggestion.title))
  return { description: module.description, patientFindings, treatedDeficits, warnings, pending, suggestions }
}

export function pathologyLabel(id: PathologyRecommendationId) {
  return pathologyRecommendations.find((pathology) => pathology.id === id)?.label ?? id
}
