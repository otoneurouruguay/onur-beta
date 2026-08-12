export const PWA_CACHE_ID = 'onur-beta-0.1.0-beta.56'

export const PWA_UPDATE_POLICY = {
  registerType: 'autoUpdate',
  injectRegister: false,
  skipWaiting: true,
  clientsClaim: true,
} as const

export const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1_000
