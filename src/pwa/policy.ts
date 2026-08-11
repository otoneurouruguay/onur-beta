export const PWA_CACHE_ID = 'onur-beta-0.1.0-beta.54'

export const PWA_UPDATE_POLICY = {
  registerType: 'prompt',
  injectRegister: false,
  skipWaiting: false,
  clientsClaim: false,
} as const

export const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1_000
