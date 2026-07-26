import { describe, expect, it } from 'vitest'
import { averageQuaternions, headPoseToCanvasTransform, quaternionAngularDistance, quaternionFromAxisAngle, relativeHeadPose, smoothCardboardHeadPose, waitForCardboardOrientationSignal } from './cardboardTracking'

const identity = { x: 0, y: 0, z: 0, w: 1 }

describe('seguimiento Cardboard 3DoF', () => {
  it('calibra la orientación actual como origen angular', () => {
    const pose = relativeHeadPose(identity, identity, false, 10)
    expect(Math.abs(pose.yawRadians)).toBe(0)
    expect(Math.abs(pose.pitchRadians)).toBe(0)
    expect(Math.abs(pose.rollRadians)).toBe(0)
    expect(pose.updatedAt).toBe(10)
  })

  it('recupera yaw, pitch y roll desde la orientación relativa', () => {
    expect(relativeHeadPose(identity, quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 6)).yawRadians).toBeCloseTo(Math.PI / 6, 5)
    expect(relativeHeadPose(identity, quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 8)).pitchRadians).toBeCloseTo(Math.PI / 8, 5)
    expect(relativeHeadPose(identity, quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 10)).rollRadians).toBeCloseTo(Math.PI / 10, 5)
  })

  it('contrarresta el giro de cabeza para mantener la dirección virtual', () => {
    const transform = headPoseToCanvasTransform({ yawRadians: Math.PI / 12, pitchRadians: Math.PI / 18, rollRadians: Math.PI / 20, absolute: false, updatedAt: 0 }, 400, 300)
    expect(transform.offsetX).toBeLessThan(0)
    expect(transform.offsetY).toBeGreaterThan(0)
    expect(transform.rotationRadians).toBeCloseTo(-Math.PI / 20, 5)
  })

  it('promedia muestras estables sin invertir cuaterniones equivalentes', () => {
    const rotation = quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 12)
    const averaged = averageQuaternions([rotation, { x: -rotation.x, y: -rotation.y, z: -rotation.z, w: -rotation.w }])
    expect(quaternionAngularDistance(rotation, averaged)).toBeCloseTo(0, 8)
  })

  it('usa el campo visual del perfil para ajustar la compensación angular', () => {
    const pose = { yawRadians: Math.PI / 12, pitchRadians: 0, rollRadians: 0, absolute: false, updatedAt: 0 }
    const narrow = headPoseToCanvasTransform(pose, 400, 300, { horizontalFovDegrees: 60, verticalFovDegrees: 60 })
    const wide = headPoseToCanvasTransform(pose, 400, 300, { horizontalFovDegrees: 110, verticalFovDegrees: 90 })
    expect(Math.abs(narrow.offsetX)).toBeGreaterThan(Math.abs(wide.offsetX))
  })

  it('absorbe el ruido subgrado y suaviza los saltos entre lecturas', () => {
    const initial = { yawRadians: 0, pitchRadians: 0, rollRadians: 0, absolute: false, updatedAt: 0 }
    const jitter = smoothCardboardHeadPose(initial, { ...initial, yawRadians: 0.2 * Math.PI / 180, updatedAt: 16 }, 16)
    expect(jitter.yawRadians).toBe(0)

    const targetYaw = 30 * Math.PI / 180
    const firstFrame = smoothCardboardHeadPose(initial, { ...initial, yawRadians: targetYaw, updatedAt: 32 }, 16)
    expect(firstFrame.yawRadians).toBeGreaterThan(0)
    expect(firstFrame.yawRadians).toBeLessThan(targetYaw)
  })

  it('comprueba una señal real antes de autorizar la preparación Cardboard', async () => {
    const signal = waitForCardboardOrientationSignal(1_000)
    const event = new Event('deviceorientation')
    Object.defineProperties(event, {
      alpha: { value: 12 },
      beta: { value: 90 },
      gamma: { value: 0 },
      absolute: { value: false },
    })
    window.dispatchEvent(event)
    await expect(signal).resolves.toBe('relative')
  })
})
