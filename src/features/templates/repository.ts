import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { analyzeExerciseCompatibility, applyExercisePurpose } from '../exercise/compatibility'
import { defaultExerciseConfig, normalizeExerciseConfig, type ExerciseConfig } from '../exercise/types'
import { immersiveScenarios } from '../immersive/catalog'

export interface ExerciseTemplateRecord {
  id: string
  name: string
  config: ExerciseConfig
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'onur-demo-exercise-templates-v1'
const SEED_VERSION_KEY = 'onur-demo-exercise-templates-seed-version'
const SEED_VERSION = '7'
const seedDate = '2026-07-20T00:00:00.000Z'
const expandedSeedDate = '2026-08-11T00:00:00.000Z'

const rvoX2Horizontal = {
  ...applyExercisePurpose(defaultExerciseConfig, 'gaze_stabilization_x2'),
  name: 'RVO X2 · blanco y cabeza opuestos',
  objectDirection: 'horizontal' as const,
}
const rvoX2Diagonal = {
  ...applyExercisePurpose(defaultExerciseConfig, 'gaze_stabilization_x2'),
  name: 'RVO X2 · diagonal',
  objectDirection: 'diagonal_down' as const,
}
const rvoX2Vertical = {
  ...applyExercisePurpose(defaultExerciseConfig, 'gaze_stabilization_x2'),
  name: 'RVO X2 · vertical',
  objectDirection: 'vertical' as const,
}
const rememberedTarget = {
  ...applyExercisePurpose(defaultExerciseConfig, 'gaze_substitution_remembered'),
  name: 'Objetivo recordado · sustitución (RVO x3)',
  targetRepetitions: 10,
  rounds: 1,
}
const cognitiveBase = {
  ...applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual'),
  durationSeconds: 45,
  restSeconds: 20,
  rounds: 1,
  cognitiveStimulusSeconds: 2.5,
}
const rareTarget = {
  ...cognitiveBase,
  name: 'Atención · contar rombos',
  cognitiveTaskMode: 'rare_target' as const,
  cognitiveTargetSymbol: 'diamond' as const,
  cognitiveResponseMode: 'count_at_end' as const,
}
const goNoGo = {
  ...cognitiveBase,
  name: 'Inhibición · Go/No-Go verbal',
  cognitiveTaskMode: 'go_no_go' as const,
  cognitiveTargetSymbol: 'star' as const,
  cognitiveResponseMode: 'verbal' as const,
}
const shortMemory = {
  ...cognitiveBase,
  name: 'Memoria breve · comparar con la anterior',
  cognitiveTaskMode: 'short_memory' as const,
  cognitiveResponseMode: 'verbal' as const,
  cognitiveMemorySpan: 1 as const,
}

const generalTemplates: ExerciseTemplateRecord[] = [
  {
    id: 'template-pursuit-very-slow', name: 'Seguimiento suave · muy lento',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'smooth_pursuit'),
      name: 'Seguimiento suave · muy lento', objectDirection: 'horizontal', objectSpeedHz: 0.1,
      durationSeconds: 30, rounds: 2, restSeconds: 25,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-pursuit-horizontal', name: 'Seguimiento suave · horizontal',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'smooth_pursuit'),
      name: 'Seguimiento suave · horizontal', objectDirection: 'horizontal', objectSpeedHz: 0.4,
      durationSeconds: 40, rounds: 2, restSeconds: 25,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-pursuit-vertical-slow', name: 'Seguimiento suave · vertical lento',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'smooth_pursuit'),
      name: 'Seguimiento suave · vertical lento', objectDirection: 'vertical', objectSpeedHz: 0.25,
      durationSeconds: 35, rounds: 2, restSeconds: 25,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-saccades-horizontal', name: 'Sacadas · horizontal',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'saccades'),
      name: 'Sacadas · horizontal', saccadePattern: 'horizontal', saccadeFrequencyHz: 0.7,
      durationSeconds: 35, rounds: 2, restSeconds: 25,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-saccades-vertical', name: 'Sacadas · vertical',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'saccades'),
      name: 'Sacadas · vertical', saccadePattern: 'vertical', saccadeFrequencyHz: 0.7,
      durationSeconds: 35, rounds: 2, restSeconds: 25,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-optokinetic-low', name: 'Optocinético · barras lentas',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'),
      name: 'Optocinético · barras lentas', backgroundType: 'bars', backgroundDirection: 'left',
      backgroundSpeed: 20, stripeWidth: 82, durationSeconds: 20, rounds: 1, restSeconds: 40,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-habituation-low', name: 'Habituación visual · damero lento',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'visual_habituation'),
      name: 'Habituación visual · damero lento', backgroundType: 'checkerboard', backgroundDirection: 'right',
      backgroundSpeed: 15, stripeWidth: 84, durationSeconds: 20, rounds: 1, restSeconds: 40,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-functional-weight-shifts', name: 'Funcional · transferencias de peso',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'guided_functional'),
      name: 'Funcional · transferencias de peso',
      patientInstruction: 'De pie junto a un apoyo estable, trasladá el peso hacia cada lado y volvé al centro con control.',
      posture: 'standing', surface: 'firm', supervision: 'trained_helper', targetRepetitions: 10, rounds: 1, restSeconds: 30,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-functional-gait-head-turns', name: 'Funcional · marcha con giros cefálicos',
    config: {
      ...applyExercisePurpose(defaultExerciseConfig, 'guided_functional'),
      name: 'Funcional · marcha con giros cefálicos',
      patientInstruction: 'Caminá por el recorrido despejado y alterná giros suaves de cabeza según la indicación profesional, con un ayudante a tu lado.',
      posture: 'walking', surface: 'firm', supervision: 'trained_helper', targetRepetitions: 8, rounds: 1, restSeconds: 45,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
]

const rapidImageTemplates: ExerciseTemplateRecord[] = [
  {
    id: 'template-rapid-images-soft', name: 'Imágenes rápidas · suave 2 s',
    config: {
      ...cognitiveBase, name: 'Imágenes rápidas · suave 2 s',
      patientInstruction: 'Observá cada figura y contá mentalmente los rombos. Al terminar, informá cuántos viste.',
      cognitiveTaskMode: 'rare_target', cognitiveTargetSymbol: 'diamond', cognitiveResponseMode: 'count_at_end',
      cognitiveStimulusSeconds: 2, durationSeconds: 40,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-rapid-images-medium', name: 'Imágenes rápidas · media 1,25 s',
    config: {
      ...cognitiveBase, name: 'Imágenes rápidas · media 1,25 s',
      patientInstruction: 'Mantené la cabeza quieta y decí “sí” solamente cuando aparezca la estrella.',
      cognitiveTaskMode: 'go_no_go', cognitiveTargetSymbol: 'star', cognitiveResponseMode: 'verbal',
      cognitiveStimulusSeconds: 1.25, durationSeconds: 35,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-rapid-images-fast', name: 'Imágenes rápidas · alta 0,75 s',
    config: {
      ...cognitiveBase, name: 'Imágenes rápidas · alta 0,75 s',
      patientInstruction: 'Mantené la cabeza quieta y decí “igual” cuando una figura coincida con la anterior.',
      cognitiveTaskMode: 'short_memory', cognitiveResponseMode: 'verbal', cognitiveMemorySpan: 1,
      cognitiveStimulusSeconds: 0.75, durationSeconds: 30,
    }, createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
]

function stroboscopicTemplate(
  name: string,
  overrides: Partial<ExerciseConfig>,
): ExerciseConfig {
  return {
    ...applyExercisePurpose(defaultExerciseConfig, 'visual_habituation'),
    name,
    clinicalProtocol: 'stroboscopic_experimental',
    patientInstruction: 'Sentado y con supervisión directa, observá el patrón sin perseguir un elemento. Avisá de inmediato ante cefalea, fotofobia, náusea marcada o síntomas visuales nuevos.',
    displayMode: 'standard', cardboardEnabled: false, doseMode: 'time', advanceMode: 'manual',
    posture: 'seated', surface: 'firm', supervision: 'direct_clinician', objectEnabled: false,
    strobeEnabled: true, durationSeconds: 20, rounds: 1, restSeconds: 60,
    ...overrides,
  }
}

const stroboscopicTemplates: ExerciseTemplateRecord[] = [
  {
    id: 'template-strobe-low', name: 'Estroboscópico experimental · suave 0,5 Hz',
    config: stroboscopicTemplate('Estroboscópico experimental · suave 0,5 Hz', {
      backgroundType: 'bars', backgroundDirection: 'left', backgroundSpeed: 15, stripeWidth: 88,
      strobeFrequencyHz: 0.5, strobeDutyCyclePercent: 80, strobeContrastPercent: 15, durationSeconds: 20,
    }), createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-strobe-medium', name: 'Estroboscópico experimental · horizontal 1 Hz',
    config: stroboscopicTemplate('Estroboscópico experimental · horizontal 1 Hz', {
      backgroundType: 'checkerboard', backgroundDirection: 'right', backgroundSpeed: 20, stripeWidth: 76,
      strobeFrequencyHz: 1, strobeDutyCyclePercent: 70, strobeContrastPercent: 22, durationSeconds: 20,
    }), createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
  {
    id: 'template-strobe-diagonal', name: 'Estroboscópico experimental · diagonal 2 Hz',
    config: stroboscopicTemplate('Estroboscópico experimental · diagonal 2 Hz', {
      backgroundType: 'dots', backgroundDirection: 'up_right', backgroundSpeed: 25, stripeWidth: 68,
      strobeFrequencyHz: 2, strobeDutyCyclePercent: 60, strobeContrastPercent: 30, durationSeconds: 15,
    }), createdAt: expandedSeedDate, updatedAt: expandedSeedDate,
  },
]

const pppdProgressionCriteria = 'Avanzar cuando complete dos exposiciones separadas con técnica segura, dificultad percibida hasta 3/5 y aumento de malestar no mayor de 2/10 al finalizar.'
const pppdStopCriteria = 'Pausar y revisar si hay caída o casi caída, visión doble, cefalea intensa, náusea marcada, síntomas neurológicos nuevos o aumento de malestar mayor de 3/10.'

const immersiveTemplates: ExerciseTemplateRecord[] = [...immersiveScenarios].sort((a, b) => a.intensity - b.intensity).map((scenario) => ({
  id: `template-immersive-${scenario.id}`,
  name: `360° · ${scenario.shortTitle}`,
  config: {
    ...applyExercisePurpose({ ...defaultExerciseConfig, immersiveScenarioId: scenario.id }, 'immersive_context'),
    name: `360° · ${scenario.shortTitle}`,
    clinicalProtocol: 'pppd',
    progressionLevel: scenario.intensity,
    progressionCriteria: pppdProgressionCriteria,
    stopCriteria: pppdStopCriteria,
  },
  createdAt: seedDate,
  updatedAt: seedDate,
}))

function pppdVisualLevel(
  level: 1 | 2 | 3,
  purpose: 'visual_habituation' | 'optokinetic',
  overrides: Partial<ExerciseConfig>,
): ExerciseConfig {
  const configured = applyExercisePurpose(defaultExerciseConfig, purpose)
  return {
    ...configured,
    clinicalProtocol: 'pppd',
    progressionLevel: level,
    progressionCriteria: pppdProgressionCriteria,
    stopCriteria: pppdStopCriteria,
    displayMode: 'standard',
    cardboardEnabled: false,
    doseMode: 'time',
    advanceMode: 'manual',
    surface: 'firm',
    supervision: 'independent_after_approval',
    cognitiveTaskMode: 'none',
    objectEnabled: false,
    rounds: level === 1 ? 1 : 2,
    restSeconds: level === 1 ? 40 : 30,
    ...overrides,
  }
}

function pppdFunctionalLevel(level: 1 | 2 | 3, overrides: Partial<ExerciseConfig>): ExerciseConfig {
  const configured = applyExercisePurpose(defaultExerciseConfig, 'guided_functional')
  return {
    ...configured,
    clinicalProtocol: 'pppd',
    progressionLevel: level,
    progressionCriteria: pppdProgressionCriteria,
    stopCriteria: pppdStopCriteria,
    displayMode: 'standard',
    cardboardEnabled: false,
    doseMode: 'repetitions',
    advanceMode: 'manual',
    surface: 'firm',
    supervision: 'independent_after_approval',
    rounds: level === 1 ? 1 : 2,
    restSeconds: 40,
    ...overrides,
  }
}

const pppdTemplates: ExerciseTemplateRecord[] = [
  {
    id: 'template-pppd-habituation-1', name: 'PPPD · Habituación visual · N1',
    config: pppdVisualLevel(1, 'visual_habituation', {
      name: 'PPPD · Habituación visual · N1',
      patientInstruction: 'Sentado y con la cabeza quieta, observá el campo de puntos en movimiento. Permití un malestar leve sin apartar la mirada; al terminar, confirmá cómo te sentís.',
      posture: 'seated', backgroundType: 'dots', backgroundDirection: 'left', backgroundSpeed: 20, stripeWidth: 72, durationSeconds: 30,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
  {
    id: 'template-pppd-habituation-2', name: 'PPPD · Habituación visual · N2',
    config: pppdVisualLevel(2, 'visual_habituation', {
      name: 'PPPD · Habituación visual · N2',
      patientInstruction: 'De pie, junto a un apoyo estable y con la cabeza quieta, observá el damero en movimiento diagonal. Mantené una postura relajada y evitá rigidizar las piernas.',
      posture: 'standing', backgroundType: 'checkerboard', backgroundDirection: 'up_right', backgroundSpeed: 45, stripeWidth: 58, durationSeconds: 40,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
  {
    id: 'template-pppd-habituation-3', name: 'PPPD · Habituación visual · N3 deportivo',
    config: pppdVisualLevel(3, 'visual_habituation', {
      name: 'PPPD · Habituación visual · N3 deportivo',
      patientInstruction: 'De pie, observá el patrón diagonal manteniendo apoyo simétrico y respiración normal. El objetivo es tolerar carga visual intensa sin adoptar una postura rígida.',
      posture: 'standing', backgroundType: 'checkerboard', backgroundDirection: 'down_left', backgroundSpeed: 75, stripeWidth: 42, durationSeconds: 55,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
  {
    id: 'template-pppd-optokinetic-1', name: 'PPPD · Optocinético · N1',
    config: pppdVisualLevel(1, 'optokinetic', {
      name: 'PPPD · Optocinético · N1',
      patientInstruction: 'Sentado y con la cabeza quieta, mirá el conjunto de barras que se desplaza horizontalmente sin perseguir una barra en particular.',
      posture: 'seated', backgroundType: 'bars', backgroundDirection: 'left', backgroundSpeed: 30, stripeWidth: 76, durationSeconds: 25,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
  {
    id: 'template-pppd-optokinetic-2', name: 'PPPD · Optocinético · N2',
    config: pppdVisualLevel(2, 'optokinetic', {
      name: 'PPPD · Optocinético · N2',
      patientInstruction: 'De pie, junto a un apoyo estable y con la cabeza quieta, observá las barras diagonales en movimiento sin fijar una barra individual.',
      posture: 'standing', backgroundType: 'bars', backgroundDirection: 'up_right', backgroundSpeed: 55, stripeWidth: 58, durationSeconds: 40,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
  {
    id: 'template-pppd-optokinetic-3', name: 'PPPD · Optocinético · N3 deportivo',
    config: pppdVisualLevel(3, 'optokinetic', {
      name: 'PPPD · Optocinético · N3 deportivo',
      patientInstruction: 'De pie, observá el campo de puntos diagonal manteniendo postura suelta y estable. No persigas un punto individual.',
      posture: 'standing', backgroundType: 'dots', backgroundDirection: 'down_right', backgroundSpeed: 90, stripeWidth: 44, durationSeconds: 55,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
  {
    id: 'template-pppd-functional-1', name: 'PPPD · Funcional · N1 giros y alcance',
    config: pppdFunctionalLevel(1, {
      name: 'PPPD · Funcional · N1 giros y alcance',
      patientInstruction: 'De pie junto a un apoyo estable, alterná giro de cabeza y tronco para tocar un objetivo a cada lado; volvé al centro entre repeticiones.',
      posture: 'standing', targetRepetitions: 8,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
  {
    id: 'template-pppd-functional-2', name: 'PPPD · Funcional · N2 marcha multidireccional',
    config: pppdFunctionalLevel(2, {
      name: 'PPPD · Funcional · N2 marcha multidireccional',
      patientInstruction: 'Caminá entre tres referencias, cambiá de dirección al llegar y alterná la mirada entre el próximo objetivo y el entorno.',
      posture: 'walking', targetRepetitions: 8,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
  {
    id: 'template-pppd-functional-3', name: 'PPPD · Funcional · N3 retorno deportivo',
    config: pppdFunctionalLevel(3, {
      name: 'PPPD · Funcional · N3 retorno deportivo',
      patientInstruction: 'Completá un circuito corto con avance, desplazamiento lateral, giro de 180 grados y recepción o pase de pelota. Priorizá control antes que velocidad.',
      posture: 'walking', targetRepetitions: 6, restSeconds: 60,
    }), createdAt: seedDate, updatedAt: seedDate,
  },
]

const seed: ExerciseTemplateRecord[] = [
  { id: 'template-rvo-bars', name: 'RVO X1 · Punto fijo 2D', config: defaultExerciseConfig, createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z' },
  { id: 'template-rvo-x2-horizontal', name: rvoX2Horizontal.name, config: rvoX2Horizontal, createdAt: seedDate, updatedAt: seedDate },
  { id: 'template-rvo-x2-vertical', name: rvoX2Vertical.name, config: rvoX2Vertical, createdAt: expandedSeedDate, updatedAt: expandedSeedDate },
  { id: 'template-rvo-x2-diagonal', name: rvoX2Diagonal.name, config: rvoX2Diagonal, createdAt: seedDate, updatedAt: seedDate },
  { id: 'template-remembered-target', name: rememberedTarget.name, config: rememberedTarget, createdAt: seedDate, updatedAt: seedDate },
  { id: 'template-cognitive-rare-target', name: rareTarget.name, config: rareTarget, createdAt: seedDate, updatedAt: seedDate },
  { id: 'template-cognitive-go-no-go', name: goNoGo.name, config: goNoGo, createdAt: seedDate, updatedAt: seedDate },
  { id: 'template-cognitive-short-memory', name: shortMemory.name, config: shortMemory, createdAt: seedDate, updatedAt: seedDate },
  ...generalTemplates,
  ...rapidImageTemplates,
  ...stroboscopicTemplates,
  ...immersiveTemplates,
  ...pppdTemplates,
]

function normalizeTemplate(item: ExerciseTemplateRecord) {
  const config = normalizeExerciseConfig(item.config, 10)
  return item.id === 'template-rvo-bars'
    ? { ...item, name: 'RVO X1 · Punto fijo 2D', config: { ...config, name: 'RVO X1 · Punto fijo 2D' } }
    : { ...item, config }
}

function read() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return seed
  try {
    const stored = (JSON.parse(raw) as ExerciseTemplateRecord[]).map(normalizeTemplate)
    if (localStorage.getItem(SEED_VERSION_KEY) === SEED_VERSION) return stored
    const knownIds = new Set(stored.map((item) => item.id))
    const migrated = [...stored, ...seed.filter((item) => !knownIds.has(item.id))]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION)
    return migrated
  } catch {
    return seed
  }
}

function write(items: ExerciseTemplateRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION)
}

function fromRow(row: Record<string, unknown>): ExerciseTemplateRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    config: normalizeExerciseConfig(row.config as Partial<ExerciseConfig>, 10),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listExerciseTemplates(): Promise<ExerciseTemplateRecord[]> {
  if (!isSupabaseConfigured || !supabase) return read().sort((a, b) => a.name.localeCompare(b.name))
  const { data, error } = await supabase.from('exercise_templates').select('*').order('name')
  if (error) throw error
  const stored = (data ?? []).map(fromRow)
  const storedIds = new Set(stored.map((item) => item.id))
  return [...stored, ...seed.filter((item) => !storedIds.has(item.id))].sort((a, b) => a.name.localeCompare(b.name))
}

export async function saveExerciseTemplate(config: ExerciseConfig): Promise<ExerciseTemplateRecord> {
  if (!config.name.trim()) throw new Error('La plantilla necesita un nombre.')
  const compatibility = analyzeExerciseCompatibility(config)
  if (!compatibility.valid && config.purpose !== 'custom_free') {
    throw new Error(`${compatibility.issues[0].message} ${compatibility.issues[0].correction}`)
  }
  if (!isSupabaseConfigured || !supabase) {
    const record = { id: crypto.randomUUID(), name: config.name.trim(), config: { ...config }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    write([...read(), record])
    return record
  }
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('Sesión profesional no disponible.')
  const { data, error } = await supabase.from('exercise_templates').insert({ professional_id: auth.user.id, name: config.name.trim(), config }).select().single()
  if (error) throw error
  return fromRow(data)
}

export async function deleteExerciseTemplate(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    write(read().filter((item) => item.id !== id))
    return
  }
  const { error } = await supabase.from('exercise_templates').delete().eq('id', id)
  if (error) throw error
}
