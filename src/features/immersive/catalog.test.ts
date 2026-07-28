import { describe, expect, it } from 'vitest'
import { captureRequiredScenarios, immersiveScenarios } from './catalog'

describe('catálogo clínico 360°', () => {
  it('mantiene doce escenarios aprobados y separa las capturas faltantes', () => {
    expect(immersiveScenarios).toHaveLength(12)
    expect(captureRequiredScenarios.length).toBeGreaterThanOrEqual(7)
    expect(immersiveScenarios.some((scenario) => /supermercado|farmacia/i.test(scenario.title))).toBe(false)
  })

  it('todos los derivados son equirectangulares 2:1, trazables y compatibles', () => {
    for (const scenario of immersiveScenarios) {
      expect(scenario.source.pageUrl).toMatch(/^https:\/\//)
      expect(scenario.source.licenseUrl).toMatch(/^https:\/\//)
      expect(scenario.source.originalSha256).toMatch(/^[a-f0-9]{64}$/)
      for (const derivative of Object.values(scenario.derivatives)) {
        expect(derivative.width / derivative.height).toBe(2)
        expect(derivative.sha256).toMatch(/^[a-f0-9]{64}$/)
        expect(derivative.bytes).toBeGreaterThan(20_000)
      }
      expect(scenario.recommendedSeconds).toBeLessThanOrEqual(scenario.maximumSeconds)
      if (scenario.ambientAudio) {
        expect(scenario.ambientAudio.sha256).toMatch(/^[a-f0-9]{64}$/)
        expect(scenario.ambientAudio.source.pageUrl).toMatch(/^https:\/\//)
        expect(scenario.ambientAudio.defaultVolume).toBeLessThanOrEqual(20)
      }
    }
  })

  it('solo ofrece referencia espacial en escenas estáticas y audio trazable', () => {
    expect(immersiveScenarios.filter((scenario) => scenario.spatialTargetAllowed).length).toBeGreaterThanOrEqual(5)
    expect(immersiveScenarios.filter((scenario) => scenario.spatialTargetAllowed).every((scenario) => scenario.motion === 'static')).toBe(true)
    expect(immersiveScenarios.filter((scenario) => scenario.ambientAudio)).toHaveLength(4)
  })

  it('los videos no exceden el segmento validado ni se rotulan como manejo', () => {
    const videos = immersiveScenarios.filter((scenario) => scenario.mediaKind === 'video')
    expect(videos).toHaveLength(2)
    for (const scenario of videos) {
      expect(scenario.maximumSeconds).toBeLessThanOrEqual(scenario.derivatives.quest.durationSeconds ?? 0)
      expect(`${scenario.title} ${scenario.clinicalUse}`).not.toMatch(/manejo|automóvil/i)
    }
  })
})
