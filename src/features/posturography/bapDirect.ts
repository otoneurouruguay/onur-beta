import type { MetricRowInput } from '../studies/types'

export const BAP_DIRECT_CONDITIONS = [1, 2, 3, 4, 5, 6] as const
export type BapConditionCode = typeof BAP_DIRECT_CONDITIONS[number]

export interface BapQuaternion {
  w: number
  x: number
  y: number
  z: number
}

export interface BapConditionResult {
  condition: BapConditionCode
  durationSeconds: number
  sampleCount: number
  area: number
  score: number
  swayPerSecondX: number
  swayPerSecondY: number
  swayPerMinuteX: number
  swayPerMinuteY: number
}

export interface BapDirectSummary {
  conditions: BapConditionResult[]
  composite: number
  somatosensory: number
  visual: number
  vestibular: number
  visualPreference: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function finite(value: number) {
  if (!Number.isFinite(value)) throw new Error('El equipo envió una trama BAP inválida.')
  return value
}

function normalize(quaternion: BapQuaternion): BapQuaternion {
  const magnitude = Math.hypot(quaternion.w, quaternion.x, quaternion.y, quaternion.z)
  if (magnitude < 1e-8) throw new Error('El equipo envió un cuaternión BAP inválido.')
  return { w: quaternion.w / magnitude, x: quaternion.x / magnitude, y: quaternion.y / magnitude, z: quaternion.z / magnitude }
}

function conjugate(quaternion: BapQuaternion): BapQuaternion {
  return { w: quaternion.w, x: -quaternion.x, y: -quaternion.y, z: -quaternion.z }
}

function multiply(left: BapQuaternion, right: BapQuaternion): BapQuaternion {
  return {
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
  }
}

function toEulerRadians(quaternion: BapQuaternion) {
  const q = normalize(quaternion)
  const roll = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x ** 2 + q.y ** 2))
  const pitch = Math.asin(clamp(2 * (q.w * q.y - q.z * q.x), -1, 1))
  const yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y ** 2 + q.z ** 2))
  return { roll, pitch, yaw }
}

function degrees(radians: number) {
  return radians * 180 / Math.PI
}

function decodeFloatLittleEndian(hex: string) {
  if (!/^[0-9a-f]{8}$/i.test(hex)) throw new Error('La trama BAP debe contener cuatro flotantes hexadecimales de 32 bits.')
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)))
  return finite(new DataView(bytes.buffer).getFloat32(0, true))
}

/** BAP 2.32 transmite cuatro floats Little Endian como texto hex CSV. */
export function parseBapSerialFrame(line: string): BapQuaternion {
  const values = line.trim().split(',').map((value) => value.trim())
  // El ejecutable BAP 2.32 sólo procesa paquetes con al menos cinco campos,
  // aunque el cálculo usa los primeros cuatro componentes del cuaternión.
  if (values.length < 5) throw new Error('La trama BAP está incompleta.')
  const [w, x, y, z] = values.slice(0, 4).map(decodeFloatLittleEndian)
  return normalize({ w, x, y, z })
}

export class BapConditionRecorder {
  private baseline: BapQuaternion | null = null
  private maximumX = Number.NEGATIVE_INFINITY
  private minimumX = Number.POSITIVE_INFINITY
  private maximumY = Number.NEGATIVE_INFINITY
  private minimumY = Number.POSITIVE_INFINITY
  private samples = 0
  private previousSwayAt = 0
  private previousDisplayX = 0
  private previousDisplayY = 0
  private directionX = 0
  private directionY = 0
  private directionChangesX = 0
  private directionChangesY = 0
  readonly condition: BapConditionCode
  readonly durationSeconds: 10 | 20 | 30

  constructor(condition: BapConditionCode, durationSeconds: 10 | 20 | 30) {
    this.condition = condition
    this.durationSeconds = durationSeconds
  }

  ingest(quaternion: BapQuaternion, timestampMs: number) {
    if (!this.baseline) this.baseline = conjugate(normalize(quaternion))
    const euler = toEulerRadians(multiply(this.baseline, quaternion))
    // BAP 2.32 registra Euler[1] y Euler[2] como ejes de la pantalla.
    const x = degrees(euler.pitch)
    const y = degrees(euler.yaw)
    this.maximumX = Math.max(this.maximumX, x)
    this.minimumX = Math.min(this.minimumX, x)
    this.maximumY = Math.max(this.maximumY, y)
    this.minimumY = Math.min(this.minimumY, y)
    this.samples += 1

    // El programa BAP compara la dirección del desplazamiento cada 100 ms
    // sobre la coordenada visual escalada y contabiliza los cambios de signo.
    if (!this.previousSwayAt || timestampMs - this.previousSwayAt >= 100) {
      const displayX = Math.trunc(clamp(x * 10, -195, 195))
      const displayY = Math.trunc(clamp(y * 10, -195, 195))
      const nextDirectionX = displayX > this.previousDisplayX ? 1 : displayX < this.previousDisplayX ? 0 : this.directionX
      const nextDirectionY = displayY > this.previousDisplayY ? 1 : displayY < this.previousDisplayY ? 0 : this.directionY
      if (this.previousSwayAt && nextDirectionX !== this.directionX) this.directionChangesX += 1
      if (this.previousSwayAt && nextDirectionY !== this.directionY) this.directionChangesY += 1
      this.directionX = nextDirectionX
      this.directionY = nextDirectionY
      this.previousDisplayX = displayX
      this.previousDisplayY = displayY
      this.previousSwayAt = timestampMs
    }
  }

  get sampleCount() { return this.samples }

  finish(): BapConditionResult {
    if (this.samples < 2 || !Number.isFinite(this.maximumX) || !Number.isFinite(this.maximumY)) throw new Error('No hubo señal BAP suficiente para completar la condición.')
    const semiAxisX = (this.maximumX - this.minimumX) / 2
    const semiAxisY = (this.maximumY - this.minimumY) / 2
    const area = semiAxisX * semiAxisY * Math.PI
    const score = clamp(((94 - area) / 94) * 100, 0, 100)
    return {
      condition: this.condition,
      durationSeconds: this.durationSeconds,
      sampleCount: this.samples,
      area,
      score,
      swayPerSecondX: Math.trunc(this.directionChangesX / this.durationSeconds),
      swayPerSecondY: Math.trunc(this.directionChangesY / this.durationSeconds),
      swayPerMinuteX: Math.trunc(this.directionChangesX * 60 / this.durationSeconds),
      swayPerMinuteY: Math.trunc(this.directionChangesY * 60 / this.durationSeconds),
    }
  }
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? clamp((numerator / denominator) * 100, 0, 100) : 0
}

export function summarizeBapDirectCapture(conditions: BapConditionResult[]): BapDirectSummary {
  if (conditions.length !== 6 || conditions.some((item, index) => item.condition !== index + 1)) throw new Error('La captura directa requiere las seis condiciones BAP en orden.')
  const score = (condition: BapConditionCode) => conditions[condition - 1].score
  return {
    conditions,
    composite: clamp(conditions.reduce((total, item) => total + item.score, 0) / 6, 0, 100),
    somatosensory: ratio(score(2), score(1)),
    visual: ratio(score(4), score(1)),
    vestibular: ratio(score(5), score(1)),
    visualPreference: ratio(score(3) + score(6), score(2) + score(5)),
  }
}

function metric(metricCode: string, rawValue: number, unitCode: string, conditionCode = '', sourceLocation = 'Captura directa BAP') : MetricRowInput {
  return { clientId: crypto.randomUUID(), metricCode, rawValue: rawValue.toFixed(2), unitCode, conditionCode, side: '', axis: '', trialNumber: '1', sourceLocation }
}

export function metricsFromBapDirectCapture(summary: BapDirectSummary): MetricRowInput[] {
  const rows = summary.conditions.flatMap((condition) => [
    metric('condition_score', condition.score, 'percent', String(condition.condition), `Captura directa BAP · condición ${condition.condition}`),
    metric('sway_per_second_x', condition.swayPerSecondX, 'oscillations_per_second', String(condition.condition), `Captura directa BAP · condición ${condition.condition}`),
    metric('sway_per_second_y', condition.swayPerSecondY, 'oscillations_per_second', String(condition.condition), `Captura directa BAP · condición ${condition.condition}`),
    metric('sway_per_minute_x', condition.swayPerMinuteX, 'oscillations_per_minute', String(condition.condition), `Captura directa BAP · condición ${condition.condition}`),
    metric('sway_per_minute_y', condition.swayPerMinuteY, 'oscillations_per_minute', String(condition.condition), `Captura directa BAP · condición ${condition.condition}`),
  ])
  return [
    ...rows,
    metric('composite_score', summary.composite, 'percent'),
    metric('sensory_ratio_somatosensory', summary.somatosensory, 'percent'),
    metric('sensory_ratio_visual', summary.visual, 'percent'),
    metric('sensory_ratio_vestibular', summary.vestibular, 'percent'),
    metric('visual_preference_index', summary.visualPreference, 'percent'),
  ]
}
