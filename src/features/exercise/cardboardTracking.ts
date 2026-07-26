export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface CardboardHeadPose {
  yawRadians: number
  pitchRadians: number
  rollRadians: number
  absolute: boolean
  updatedAt: number
}

export interface CardboardCanvasTransform {
  offsetX: number
  offsetY: number
  rotationRadians: number
}

export interface CardboardFieldOfView {
  horizontalFovDegrees: number
  verticalFovDegrees: number
}

export interface CardboardPoseSmoothingOptions {
  deadZoneRadians?: number
  timeConstantMilliseconds?: number
}

export type CardboardTrackingPermission = 'granted' | 'denied' | 'unsupported' | 'insecure' | 'no_signal'
export type CardboardOrientationSignalSource = 'relative' | 'absolute'

export interface CardboardTrackingActivation {
  permission: CardboardTrackingPermission
  signalSource?: CardboardOrientationSignalSource
  accelerometerPermission?: PermissionState
  gyroscopePermission?: PermissionState
}

type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<'granted' | 'denied'>
}

type SensorPermissionName = 'accelerometer' | 'gyroscope'

const DEG_TO_RAD = Math.PI / 180
const HALF_PI = Math.PI / 2

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function shortestAngleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const length = Math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w) || 1
  return { x: quaternion.x / length, y: quaternion.y / length, z: quaternion.z / length, w: quaternion.w / length }
}

export function quaternionAngularDistance(left: Quaternion, right: Quaternion) {
  const a = normalizeQuaternion(left)
  const b = normalizeQuaternion(right)
  const dot = Math.abs(clamp(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w, -1, 1))
  return 2 * Math.acos(dot)
}

export function averageQuaternions(quaternions: Quaternion[]): Quaternion {
  if (quaternions.length === 0) return { x: 0, y: 0, z: 0, w: 1 }
  const reference = normalizeQuaternion(quaternions[0])
  const sum = quaternions.reduce((total, value) => {
    const normalized = normalizeQuaternion(value)
    const dot = reference.x * normalized.x + reference.y * normalized.y + reference.z * normalized.z + reference.w * normalized.w
    const sign = dot < 0 ? -1 : 1
    return {
      x: total.x + normalized.x * sign,
      y: total.y + normalized.y * sign,
      z: total.z + normalized.z * sign,
      w: total.w + normalized.w * sign,
    }
  }, { x: 0, y: 0, z: 0, w: 0 })
  return normalizeQuaternion(sum)
}

export function multiplyQuaternions(left: Quaternion, right: Quaternion): Quaternion {
  return normalizeQuaternion({
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
  })
}

export function quaternionFromAxisAngle(axis: { x: number; y: number; z: number }, radians: number): Quaternion {
  const axisLength = Math.hypot(axis.x, axis.y, axis.z) || 1
  const sine = Math.sin(radians / 2)
  return normalizeQuaternion({
    x: axis.x / axisLength * sine,
    y: axis.y / axisLength * sine,
    z: axis.z / axisLength * sine,
    w: Math.cos(radians / 2),
  })
}

function quaternionFromEulerYXZ(x: number, y: number, z: number): Quaternion {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return normalizeQuaternion({
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 - s1 * s2 * c3,
    w: c1 * c2 * c3 + s1 * s2 * s3,
  })
}

export function quaternionFromDeviceOrientation(alphaDegrees: number, betaDegrees: number, gammaDegrees: number, screenAngleDegrees = 0): Quaternion {
  const deviceRotation = quaternionFromEulerYXZ(betaDegrees * DEG_TO_RAD, alphaDegrees * DEG_TO_RAD, -gammaDegrees * DEG_TO_RAD)
  const cameraAlignment = quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, -HALF_PI)
  const screenAlignment = quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, -screenAngleDegrees * DEG_TO_RAD)
  return multiplyQuaternions(multiplyQuaternions(deviceRotation, cameraAlignment), screenAlignment)
}

function inverseQuaternion(quaternion: Quaternion): Quaternion {
  const normalized = normalizeQuaternion(quaternion)
  return { x: -normalized.x, y: -normalized.y, z: -normalized.z, w: normalized.w }
}

function rotateVector(quaternion: Quaternion, vector: { x: number; y: number; z: number }) {
  const vectorQuaternion: Quaternion = { ...vector, w: 0 }
  const rotated = multiplyQuaternions(multiplyQuaternions(quaternion, vectorQuaternion), inverseQuaternion(quaternion))
  return { x: rotated.x, y: rotated.y, z: rotated.z }
}

export function relativeHeadPose(reference: Quaternion, current: Quaternion, absolute = false, updatedAt = performance.now()): CardboardHeadPose {
  const relative = multiplyQuaternions(inverseQuaternion(reference), current)
  const forward = rotateVector(relative, { x: 0, y: 0, z: -1 })
  const up = rotateVector(relative, { x: 0, y: 1, z: 0 })
  return {
    yawRadians: Math.atan2(-forward.x, -forward.z),
    pitchRadians: Math.asin(clamp(forward.y, -1, 1)),
    rollRadians: Math.atan2(-up.x, up.y),
    absolute,
    updatedAt,
  }
}

export function smoothCardboardHeadPose(
  previous: CardboardHeadPose | null,
  target: CardboardHeadPose,
  deltaMilliseconds: number,
  options: CardboardPoseSmoothingOptions = {},
): CardboardHeadPose {
  if (!previous) return target
  const deadZone = options.deadZoneRadians ?? 0.35 * DEG_TO_RAD
  const timeConstant = Math.max(1, options.timeConstantMilliseconds ?? 70)
  const alpha = 1 - Math.exp(-clamp(deltaMilliseconds, 0, 100) / timeConstant)
  const interpolate = (from: number, to: number) => {
    const delta = shortestAngleDelta(from, to)
    if (Math.abs(delta) <= deadZone) return from
    return from + delta * alpha
  }
  return {
    yawRadians: interpolate(previous.yawRadians, target.yawRadians),
    pitchRadians: interpolate(previous.pitchRadians, target.pitchRadians),
    rollRadians: interpolate(previous.rollRadians, target.rollRadians),
    absolute: target.absolute,
    updatedAt: target.updatedAt,
  }
}

export function headPoseToCanvasTransform(pose: CardboardHeadPose, width: number, height: number, fieldOfView: CardboardFieldOfView = { horizontalFovDegrees: 90, verticalFovDegrees: 80 }): CardboardCanvasTransform {
  const yaw = clamp(pose.yawRadians, -Math.PI / 3, Math.PI / 3)
  const pitch = clamp(pose.pitchRadians, -Math.PI / 3, Math.PI / 3)
  const horizontalFov = clamp(fieldOfView.horizontalFovDegrees, 45, 130) * DEG_TO_RAD
  const verticalFov = clamp(fieldOfView.verticalFovDegrees, 40, 120) * DEG_TO_RAD
  return {
    offsetX: clamp(-Math.tan(yaw) / Math.tan(horizontalFov / 2) * width / 2, -width * 1.5, width * 1.5),
    offsetY: clamp(Math.tan(pitch) / Math.tan(verticalFov / 2) * height / 2, -height * 1.5, height * 1.5),
    rotationRadians: -pose.rollRadians,
  }
}

export function currentScreenOrientationAngle() {
  const angle = screen.orientation?.angle
  if (typeof angle === 'number') return angle
  const legacyOrientation = (window as Window & { orientation?: number }).orientation
  return typeof legacyOrientation === 'number' ? legacyOrientation : 0
}

export async function requestCardboardTrackingPermission(): Promise<CardboardTrackingPermission> {
  if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) return 'insecure'
  const constructor = window.DeviceOrientationEvent as DeviceOrientationConstructor | undefined
  if (!constructor) return 'unsupported'
  if (typeof constructor.requestPermission !== 'function') {
    const sensorPermissions = await queryCardboardSensorPermissions()
    return sensorPermissions.accelerometer === 'denied' || sensorPermissions.gyroscope === 'denied' ? 'denied' : 'granted'
  }
  try {
    return await constructor.requestPermission(false)
  } catch {
    return 'denied'
  }
}

async function querySensorPermission(name: SensorPermissionName): Promise<PermissionState | undefined> {
  if (!navigator.permissions?.query) return undefined
  try {
    return (await navigator.permissions.query({ name } as unknown as PermissionDescriptor)).state
  } catch {
    return undefined
  }
}

export async function queryCardboardSensorPermissions() {
  const [accelerometer, gyroscope] = await Promise.all([
    querySensorPermission('accelerometer'),
    querySensorPermission('gyroscope'),
  ])
  return { accelerometer, gyroscope }
}

export function waitForCardboardOrientationSignal(timeoutMilliseconds = 8_000): Promise<CardboardOrientationSignalSource | null> {
  return new Promise((resolve) => {
    let finished = false
    const finish = (source: CardboardOrientationSignalSource | null) => {
      if (finished) return
      finished = true
      window.clearTimeout(timeout)
      window.removeEventListener('deviceorientation', handleRelative)
      window.removeEventListener('deviceorientationabsolute', handleAbsolute)
      resolve(source)
    }
    const valid = (event: DeviceOrientationEvent) => (
      typeof event.alpha === 'number' && Number.isFinite(event.alpha)
      && typeof event.beta === 'number' && Number.isFinite(event.beta)
      && typeof event.gamma === 'number' && Number.isFinite(event.gamma)
    )
    const handleRelative = (event: DeviceOrientationEvent) => { if (valid(event)) finish('relative') }
    const handleAbsolute = (event: DeviceOrientationEvent) => { if (valid(event)) finish('absolute') }
    const timeout = window.setTimeout(() => finish(null), timeoutMilliseconds)
    window.addEventListener('deviceorientation', handleRelative)
    window.addEventListener('deviceorientationabsolute', handleAbsolute)
  })
}

export async function activateCardboardTracking(timeoutMilliseconds = 8_000): Promise<CardboardTrackingActivation> {
  const permission = await requestCardboardTrackingPermission()
  if (permission !== 'granted') return { permission }

  const signalSource = await waitForCardboardOrientationSignal(timeoutMilliseconds)
  const sensorPermissions = await queryCardboardSensorPermissions()
  if (!signalSource) {
    return {
      permission: sensorPermissions.accelerometer === 'denied' || sensorPermissions.gyroscope === 'denied' ? 'denied' : 'no_signal',
      accelerometerPermission: sensorPermissions.accelerometer,
      gyroscopePermission: sensorPermissions.gyroscope,
    }
  }
  return {
    permission: 'granted',
    signalSource,
    accelerometerPermission: sensorPermissions.accelerometer,
    gyroscopePermission: sensorPermissions.gyroscope,
  }
}
