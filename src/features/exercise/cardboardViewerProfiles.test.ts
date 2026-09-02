import { beforeEach, describe, expect, it } from 'vitest'
import { CARDBOARD_VIEWER_PROFILE_STORAGE_KEY, cardboardEyeOpticalOffset, cardboardEyeProjectionFrustum, defaultCardboardViewerProfile, normalizeCardboardViewerProfile, readCardboardViewerProfileStore } from './cardboardViewerProfiles'

beforeEach(() => localStorage.clear())

describe('perfiles ópticos Cardboard', () => {
  it('recupera un perfil estándar cuando no hay configuración local', () => {
    expect(readCardboardViewerProfileStore().profiles[0]).toEqual(defaultCardboardViewerProfile)
  })

  it('normaliza valores dañados o fuera del rango seguro de interfaz', () => {
    expect(normalizeCardboardViewerProfile({ imageSeparationPercent: 99, verticalOffsetPercent: -99, horizontalFovDegrees: 10, verticalFovDegrees: 200 })).toMatchObject({
      imageSeparationPercent: 15,
      verticalOffsetPercent: -15,
      horizontalFovDegrees: 60,
      verticalFovDegrees: 105,
    })
  })

  it('aplica separación simétrica y el mismo desplazamiento vertical a ambos ojos', () => {
    const profile = { ...defaultCardboardViewerProfile, imageSeparationPercent: 5, verticalOffsetPercent: -4 }
    expect(cardboardEyeOpticalOffset(profile, 'left', 400, 300)).toEqual({ offsetX: -20, offsetY: -12 })
    expect(cardboardEyeOpticalOffset(profile, 'right', 400, 300)).toEqual({ offsetX: 20, offsetY: -12 })
  })

  it('aplica separación, altura y ambos campos visuales a la proyección del video 360°', () => {
    const profile = { ...defaultCardboardViewerProfile, imageSeparationPercent: -5, verticalOffsetPercent: 4, horizontalFovDegrees: 96, verticalFovDegrees: 82 }
    const left = cardboardEyeProjectionFrustum(profile, 'left')
    const right = cardboardEyeProjectionFrustum(profile, 'right')
    expect(left.left + left.right).toBeLessThan(0)
    expect(right.left + right.right).toBeGreaterThan(0)
    expect(left.top + left.bottom).toBeGreaterThan(0)
    expect(left.right - left.left).toBeCloseTo(2 * 0.1 * Math.tan(96 * Math.PI / 360))
    expect(left.top - left.bottom).toBeCloseTo(2 * 0.1 * Math.tan(82 * Math.PI / 360))
  })

  it('descarta almacenamiento inválido sin romper el reproductor', () => {
    localStorage.setItem(CARDBOARD_VIEWER_PROFILE_STORAGE_KEY, '{incorrecto')
    expect(readCardboardViewerProfileStore().activeProfileId).toBe('standard')
  })
})
