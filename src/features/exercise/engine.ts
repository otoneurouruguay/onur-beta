import { cognitiveStepAt, cognitiveSymbolAtStep } from './cognitive'
import type { CognitiveSymbol, ExerciseConfig, LinearMotionDirection, MotionDirection, ObjectDirection, SaccadePattern } from './types'

export interface Point {
  x: number
  y: number
}

export function clampObjectPosition(position: Point, width: number, height: number, objectSize: number): Point {
  const radius = Math.max(objectSize / 2, 1)
  const margin = Math.min(radius + 2, Math.max(1, Math.min(width, height) / 2))
  return {
    x: Math.min(Math.max(position.x, margin), Math.max(margin, width - margin)),
    y: Math.min(Math.max(position.y, margin), Math.max(margin, height - margin)),
  }
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

function deterministicUnit(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function smoothStep(value: number) {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

export function backgroundRampEnvelope(config: ExerciseConfig, elapsedSeconds: number) {
  if (config.backgroundRampSeconds <= 0) return 1
  return smoothStep(elapsedSeconds / config.backgroundRampSeconds)
}

export function backgroundMotionOffset(
  config: ExerciseConfig,
  elapsedSeconds: number,
  referenceSpan: number,
) {
  if (config.backgroundMotionMode === 'oscillating') {
    const amplitude = referenceSpan * (config.backgroundAmplitudePercent / 100)
    const relationSign = config.targetBackgroundRelation === 'counter_phase' ? -1 : 1
    return relationSign * Math.sin(elapsedSeconds * Math.PI * 2 * config.backgroundFrequencyHz)
      * amplitude
      * backgroundRampEnvelope(config, elapsedSeconds)
  }

  const speed = config.backgroundSpeed
  const ramp = Math.max(0, config.backgroundRampSeconds)
  if (ramp === 0 || elapsedSeconds >= ramp) {
    return speed * (ramp === 0 ? elapsedSeconds : elapsedSeconds - ramp / 2)
  }
  return speed * elapsedSeconds * elapsedSeconds / (2 * ramp)
}

export function backgroundRotationRadians(config: ExerciseConfig, elapsedSeconds: number) {
  const direction = config.backgroundDirection === 'counterclockwise' ? -1 : 1
  if (config.backgroundMotionMode === 'oscillating') {
    const amplitudeRadians = Math.PI * (config.backgroundAmplitudePercent / 100)
    return direction
      * Math.sin(elapsedSeconds * Math.PI * 2 * config.backgroundFrequencyHz)
      * amplitudeRadians
      * backgroundRampEnvelope(config, elapsedSeconds)
  }
  return direction * (backgroundMotionOffset(config, elapsedSeconds, 1) / 45)
}

export function backgroundCoverageRect(width: number, height: number, coveragePercent: number) {
  const scale = Math.max(25, Math.min(100, coveragePercent)) / 100
  const coveredWidth = width * scale
  const coveredHeight = height * scale
  return {
    x: (width - coveredWidth) / 2,
    y: (height - coveredHeight) / 2,
    width: coveredWidth,
    height: coveredHeight,
  }
}

export function calculateTrackingPosition(
  elapsedSeconds: number,
  width: number,
  height: number,
  direction: ObjectDirection,
  frequencyHz: number,
  amplitudePercent: number,
): Point {
  const center = { x: width / 2, y: height / 2 }
  const phase = Math.sin(elapsedSeconds * Math.PI * 2 * frequencyHz)
  const horizontalAmplitude = width * (amplitudePercent / 100)
  const verticalAmplitude = height * (amplitudePercent / 100)
  if (direction === 'horizontal') return { x: center.x + phase * horizontalAmplitude, y: center.y }
  if (direction === 'vertical') return { x: center.x, y: center.y + phase * verticalAmplitude }
  const diagonalScale = Math.SQRT1_2
  const ySign = direction === 'diagonal_down' ? 1 : -1
  return {
    x: center.x + phase * horizontalAmplitude * diagonalScale,
    y: center.y + phase * verticalAmplitude * diagonalScale * ySign,
  }
}

export function calculateSaccadePosition(
  elapsedSeconds: number,
  width: number,
  height: number,
  frequencyHz: number,
  pattern: SaccadePattern,
  amplitudePercent: number,
): Point {
  const step = Math.floor(elapsedSeconds * frequencyHz)
  const center = { x: width / 2, y: height / 2 }
  const horizontalAmplitude = width * (amplitudePercent / 100)
  const verticalAmplitude = height * (amplitudePercent / 100)

  if (pattern === 'horizontal') {
    return { x: center.x + (step % 2 === 0 ? -horizontalAmplitude : horizontalAmplitude), y: center.y }
  }
  if (pattern === 'vertical') {
    return { x: center.x, y: center.y + (step % 2 === 0 ? -verticalAmplitude : verticalAmplitude) }
  }
  if (pattern === 'diagonal_down' || pattern === 'diagonal_up') {
    const phase = step % 2 === 0 ? -1 : 1
    const ySign = pattern === 'diagonal_down' ? 1 : -1
    return {
      x: center.x + phase * horizontalAmplitude * Math.SQRT1_2,
      y: center.y + phase * verticalAmplitude * Math.SQRT1_2 * ySign,
    }
  }
  return {
    x: center.x + (deterministicUnit(step + 1) * 2 - 1) * horizontalAmplitude,
    y: center.y + (deterministicUnit(step + 101) * 2 - 1) * verticalAmplitude,
  }
}

function drawBars(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
) {
  const stripe = Math.max(config.stripeWidth, 8)
  const period = stripe * 2
  const { x: directionX, y: directionY } = linearMotionVector(config.backgroundDirection)
  const angle = Math.atan2(directionY, directionX)
  const offset = positiveModulo(backgroundMotionOffset(config, elapsedSeconds, Math.min(width, height)), period)
  const radius = Math.hypot(width, height)
  context.fillStyle = config.foregroundColor
  context.save()
  context.translate(width / 2, height / 2)
  context.rotate(angle)
  for (let x = -radius - period + offset; x < radius + period; x += period) {
    context.fillRect(x, -radius, stripe, radius * 2)
  }
  context.restore()
}

function linearMotionVector(direction: MotionDirection): Point {
  const diagonal = Math.SQRT1_2
  const vectors: Record<LinearMotionDirection, Point> = {
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    up_left: { x: -diagonal, y: -diagonal }, up_right: { x: diagonal, y: -diagonal },
    down_left: { x: -diagonal, y: diagonal }, down_right: { x: diagonal, y: diagonal },
  }
  return vectors[direction as LinearMotionDirection] ?? { x: 1, y: 0 }
}

function drawCheckerboard(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
) {
  const tile = Math.max(config.stripeWidth, 18)
  const direction = linearMotionVector(config.backgroundDirection)
  const motionOffset = backgroundMotionOffset(config, elapsedSeconds, Math.min(width, height))
  const offsetX = positiveModulo(motionOffset * direction.x, tile * 2)
  const offsetY = positiveModulo(motionOffset * direction.y, tile * 2)
  context.fillStyle = config.foregroundColor

  for (let row = -2; row < Math.ceil(height / tile) + 2; row += 1) {
    for (let column = -2; column < Math.ceil(width / tile) + 2; column += 1) {
      if ((row + column) % 2 !== 0) continue
      const x = column * tile + offsetX
      const y = row * tile + offsetY
      context.fillRect(x, y, tile, tile)
    }
  }
}

function drawDots(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
) {
  const gap = Math.max(config.stripeWidth, 22)
  const radius = Math.max(3, gap * 0.12)
  const direction = linearMotionVector(config.backgroundDirection)
  const motionOffset = backgroundMotionOffset(config, elapsedSeconds, Math.min(width, height))
  const offsetX = positiveModulo(motionOffset * direction.x, gap)
  const offsetY = positiveModulo(motionOffset * direction.y, gap)
  context.fillStyle = config.foregroundColor

  for (let y = -gap; y < height + gap; y += gap) {
    for (let x = -gap; x < width + gap; x += gap) {
      context.beginPath()
      context.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2)
      context.fill()
    }
  }
}

function drawSpiral(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
) {
  const rotation = backgroundRotationRadians(config, elapsedSeconds)
  const maxRadius = Math.hypot(width, height) * 0.62
  const lineWidth = Math.max(7, config.stripeWidth * 0.42)
  context.save()
  context.translate(width / 2, height / 2)
  context.rotate(rotation)
  context.strokeStyle = config.foregroundColor
  context.lineWidth = lineWidth
  context.lineCap = 'round'
  context.beginPath()
  for (let angle = 0; angle <= Math.PI * 16; angle += 0.08) {
    const radius = (angle / (Math.PI * 16)) * maxRadius
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (angle === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.stroke()
  context.restore()
}

export interface RadialFlowParticle extends Point {
  size: number
  progress: number
}

export function radialFlowParticleAt(
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
  index: number,
): RadialFlowParticle {
  const span = Math.max(1, Math.min(width, height))
  const directionSign = config.backgroundDirection === 'away' ? -1 : 1
  const travel = directionSign * backgroundMotionOffset(config, elapsedSeconds, span) / span
  const progress = positiveModulo(deterministicUnit(index * 17 + 3) + travel, 1)
  const angle = deterministicUnit(index * 29 + 11) * Math.PI * 2
  const maxRadius = Math.hypot(width, height) * 0.55
  const radius = Math.pow(progress, 1.35) * maxRadius
  return {
    x: width / 2 + Math.cos(angle) * radius,
    y: height / 2 + Math.sin(angle) * radius,
    size: 1.5 + progress * Math.max(3, config.stripeWidth * 0.08),
    progress,
  }
}

function drawRadialFlow(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
) {
  const particleCount = Math.max(36, Math.min(160, Math.round((width * height) / 8500)))
  context.fillStyle = config.foregroundColor
  for (let index = 0; index < particleCount; index += 1) {
    const particle = radialFlowParticleAt(config, elapsedSeconds, width, height, index)
    context.beginPath()
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    context.fill()
  }
}

export function renderExerciseBackground(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
  includeBase = true,
) {
  if (includeBase) {
    context.clearRect(0, 0, width, height)
    context.fillStyle = config.backgroundColor
    context.fillRect(0, 0, width, height)
  }

  if (config.backgroundType === 'solid') return

  const coverage = backgroundCoverageRect(width, height, config.backgroundCoveragePercent)
  context.save()
  context.beginPath()
  context.rect(coverage.x, coverage.y, coverage.width, coverage.height)
  context.clip()
  context.globalAlpha = Math.max(5, Math.min(100, config.backgroundContrastPercent)) / 100
  if (config.backgroundType === 'bars') drawBars(context, config, elapsedSeconds, width, height)
  if (config.backgroundType === 'checkerboard') drawCheckerboard(context, config, elapsedSeconds, width, height)
  if (config.backgroundType === 'dots') drawDots(context, config, elapsedSeconds, width, height)
  if (config.backgroundType === 'spiral') drawSpiral(context, config, elapsedSeconds, width, height)
  if (config.backgroundType === 'radial_flow') drawRadialFlow(context, config, elapsedSeconds, width, height)
  context.restore()
}

export function strobeOcclusionAlphaAt(config: ExerciseConfig, elapsedSeconds: number) {
  if (!config.strobeEnabled) return 0
  const frequencyHz = Math.max(0.5, Math.min(2.5, config.strobeFrequencyHz))
  const dutyCycle = Math.max(50, Math.min(80, config.strobeDutyCyclePercent)) / 100
  const phase = positiveModulo(elapsedSeconds * frequencyHz, 1)
  return phase < dutyCycle ? 0 : Math.max(5, Math.min(35, config.strobeContrastPercent)) / 100
}

function renderStrobeOcclusion(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
) {
  const alpha = strobeOcclusionAlphaAt(config, elapsedSeconds)
  if (alpha <= 0) return
  context.save()
  context.globalAlpha = alpha
  context.fillStyle = config.backgroundColor
  context.fillRect(0, 0, width, height)
  context.restore()
}

export function renderExerciseObject(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
) {
  if (!config.objectEnabled) return

  let objectPosition = { x: width / 2, y: height / 2 }
  if (config.objectMode === 'tracking') {
    objectPosition = calculateTrackingPosition(
      elapsedSeconds,
      width,
      height,
      config.objectDirection,
      config.objectSpeedHz,
      config.objectAmplitude,
    )
  }
  if (config.objectMode === 'saccades') {
    objectPosition = calculateSaccadePosition(
      elapsedSeconds,
      width,
      height,
      config.saccadeFrequencyHz,
      config.saccadePattern,
      config.objectAmplitude,
    )
  }

  objectPosition = clampObjectPosition(objectPosition, width, height, config.objectSize)

  const cognitiveSymbol = config.cognitiveTaskMode === 'none'
    ? 'circle'
    : cognitiveSymbolAtStep(config, cognitiveStepAt(elapsedSeconds, config.cognitiveStimulusSeconds))
  context.fillStyle = config.objectColor
  context.shadowColor = 'rgba(0,0,0,0.22)'
  context.shadowBlur = Math.max(6, config.objectSize * 0.25)
  drawObjectShape(context, cognitiveSymbol, objectPosition, config.objectSize)
  context.fill()
  context.shadowBlur = 0
}

export function renderExerciseFrame(
  context: CanvasRenderingContext2D,
  config: ExerciseConfig,
  elapsedSeconds: number,
  width: number,
  height: number,
) {
  renderExerciseBackground(context, config, elapsedSeconds, width, height)
  renderExerciseObject(context, config, elapsedSeconds, width, height)
  renderStrobeOcclusion(context, config, elapsedSeconds, width, height)
}

function drawObjectShape(context: CanvasRenderingContext2D, symbol: CognitiveSymbol, position: Point, size: number) {
  const radius = size / 2
  context.beginPath()
  if (symbol === 'circle') {
    context.arc(position.x, position.y, radius, 0, Math.PI * 2)
    return
  }
  if (symbol === 'square') {
    context.rect(position.x - radius, position.y - radius, size, size)
    return
  }
  const sides = symbol === 'triangle' ? 3 : symbol === 'diamond' ? 4 : 10
  const rotation = symbol === 'diamond' ? Math.PI / 4 : -Math.PI / 2
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index * Math.PI * 2) / sides
    const pointRadius = symbol === 'star' && index % 2 === 1 ? radius * 0.44 : radius
    const x = position.x + Math.cos(angle) * pointRadius
    const y = position.y + Math.sin(angle) * pointRadius
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.closePath()
}
