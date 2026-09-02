import { useCallback, useState } from 'react'

export interface CardboardViewerProfile {
  id: string
  name: string
  imageSeparationPercent: number
  verticalOffsetPercent: number
  horizontalFovDegrees: number
  verticalFovDegrees: number
  lensDistortionPercent: number
}

interface CardboardViewerProfileStore {
  activeProfileId: string
  profiles: CardboardViewerProfile[]
}

export type CardboardEye = 'left' | 'right'

export const CARDBOARD_VIEWER_PROFILE_STORAGE_KEY = 'onur-cardboard-viewer-profiles-v1'

export const defaultCardboardViewerProfile: CardboardViewerProfile = {
  id: 'standard',
  name: 'VR Box estándar',
  imageSeparationPercent: 0,
  verticalOffsetPercent: 0,
  horizontalFovDegrees: 90,
  verticalFovDegrees: 80,
  lensDistortionPercent: 18,
}

const limits = {
  imageSeparationPercent: [-15, 15],
  verticalOffsetPercent: [-15, 15],
  horizontalFovDegrees: [60, 115],
  verticalFovDegrees: [45, 105],
  lensDistortionPercent: [0, 35],
} as const

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeCardboardViewerProfile(profile: Partial<CardboardViewerProfile>, fallbackId = 'standard'): CardboardViewerProfile {
  const numeric = <Key extends keyof typeof limits>(key: Key, fallback: number) => {
    const value = Number(profile[key])
    const [minimum, maximum] = limits[key]
    return Number.isFinite(value) ? clamp(value, minimum, maximum) : fallback
  }
  return {
    id: typeof profile.id === 'string' && profile.id.trim() ? profile.id : fallbackId,
    name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim().slice(0, 60) : 'Perfil Cardboard',
    imageSeparationPercent: numeric('imageSeparationPercent', defaultCardboardViewerProfile.imageSeparationPercent),
    verticalOffsetPercent: numeric('verticalOffsetPercent', defaultCardboardViewerProfile.verticalOffsetPercent),
    horizontalFovDegrees: numeric('horizontalFovDegrees', defaultCardboardViewerProfile.horizontalFovDegrees),
    verticalFovDegrees: numeric('verticalFovDegrees', defaultCardboardViewerProfile.verticalFovDegrees),
    lensDistortionPercent: numeric('lensDistortionPercent', defaultCardboardViewerProfile.lensDistortionPercent),
  }
}

function defaultStore(): CardboardViewerProfileStore {
  return { activeProfileId: defaultCardboardViewerProfile.id, profiles: [{ ...defaultCardboardViewerProfile }] }
}

export function readCardboardViewerProfileStore(storage: Pick<Storage, 'getItem'> = localStorage): CardboardViewerProfileStore {
  try {
    const raw = storage.getItem(CARDBOARD_VIEWER_PROFILE_STORAGE_KEY)
    if (!raw) return defaultStore()
    const parsed = JSON.parse(raw) as Partial<CardboardViewerProfileStore>
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles.map((profile, index) => normalizeCardboardViewerProfile(profile, `profile-${index + 1}`))
      : []
    if (profiles.length === 0) return defaultStore()
    const activeProfileId = profiles.some((profile) => profile.id === parsed.activeProfileId) ? parsed.activeProfileId! : profiles[0].id
    return { activeProfileId, profiles }
  } catch {
    return defaultStore()
  }
}

function writeCardboardViewerProfileStore(store: CardboardViewerProfileStore, storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(CARDBOARD_VIEWER_PROFILE_STORAGE_KEY, JSON.stringify(store)) } catch { /* El perfil continúa en memoria si el navegador bloquea el almacenamiento. */ }
}

function nextProfileId() {
  try { return crypto.randomUUID() } catch { return `cardboard-${Date.now()}-${Math.random().toString(36).slice(2)}` }
}

export function cardboardEyeOpticalOffset(profile: CardboardViewerProfile, eye: CardboardEye, width: number, height: number) {
  const horizontalDirection = eye === 'left' ? -1 : 1
  return {
    offsetX: horizontalDirection * profile.imageSeparationPercent / 100 * width,
    offsetY: profile.verticalOffsetPercent / 100 * height,
  }
}

export function cardboardEyeCenterPercent(profile: CardboardViewerProfile, eye: CardboardEye) {
  return {
    left: 50 + (eye === 'left' ? -1 : 1) * profile.imageSeparationPercent,
    top: 50 + profile.verticalOffsetPercent,
  }
}

export function cardboardEyeProjectionFrustum(profile: CardboardViewerProfile, eye: CardboardEye, near = 0.1) {
  const horizontalHalfExtent = near * Math.tan(profile.horizontalFovDegrees * Math.PI / 360)
  const verticalHalfExtent = near * Math.tan(profile.verticalFovDegrees * Math.PI / 360)
  const eyeDirection = eye === 'left' ? -1 : 1
  const horizontalShift = -eyeDirection * profile.imageSeparationPercent / 100 * horizontalHalfExtent * 2
  const verticalShift = profile.verticalOffsetPercent / 100 * verticalHalfExtent * 2
  return {
    left: -horizontalHalfExtent + horizontalShift,
    right: horizontalHalfExtent + horizontalShift,
    top: verticalHalfExtent + verticalShift,
    bottom: -verticalHalfExtent + verticalShift,
  }
}

export function useCardboardViewerProfiles() {
  const [store, setStore] = useState<CardboardViewerProfileStore>(() => readCardboardViewerProfileStore())
  const activeProfile = store.profiles.find((profile) => profile.id === store.activeProfileId) ?? store.profiles[0]

  const persist = useCallback((update: (current: CardboardViewerProfileStore) => CardboardViewerProfileStore) => {
    setStore((current) => {
      const next = update(current)
      writeCardboardViewerProfileStore(next)
      return next
    })
  }, [])

  const selectProfile = useCallback((profileId: string) => persist((current) => current.profiles.some((profile) => profile.id === profileId)
    ? { ...current, activeProfileId: profileId }
    : current), [persist])

  const updateActiveProfile = useCallback((changes: Partial<Omit<CardboardViewerProfile, 'id'>>) => persist((current) => ({
    ...current,
    profiles: current.profiles.map((profile) => profile.id === current.activeProfileId
      ? normalizeCardboardViewerProfile({ ...profile, ...changes }, profile.id)
      : profile),
  })), [persist])

  const createProfile = useCallback(() => {
    const id = nextProfileId()
    persist((current) => {
      const source = current.profiles.find((profile) => profile.id === current.activeProfileId) ?? defaultCardboardViewerProfile
      const profile = normalizeCardboardViewerProfile({ ...source, id, name: `Perfil ${current.profiles.length + 1}` }, id)
      return { activeProfileId: id, profiles: [...current.profiles, profile] }
    })
  }, [persist])

  const removeActiveProfile = useCallback(() => persist((current) => {
    if (current.profiles.length <= 1) return current
    const profiles = current.profiles.filter((profile) => profile.id !== current.activeProfileId)
    return { activeProfileId: profiles[0].id, profiles }
  }), [persist])

  const resetActiveProfile = useCallback(() => updateActiveProfile({
    imageSeparationPercent: defaultCardboardViewerProfile.imageSeparationPercent,
    verticalOffsetPercent: defaultCardboardViewerProfile.verticalOffsetPercent,
    horizontalFovDegrees: defaultCardboardViewerProfile.horizontalFovDegrees,
    verticalFovDegrees: defaultCardboardViewerProfile.verticalFovDegrees,
    lensDistortionPercent: defaultCardboardViewerProfile.lensDistortionPercent,
  }), [updateActiveProfile])

  return {
    profiles: store.profiles,
    activeProfile,
    selectProfile,
    updateActiveProfile,
    createProfile,
    removeActiveProfile,
    resetActiveProfile,
  }
}
