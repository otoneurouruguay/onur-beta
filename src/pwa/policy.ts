export const PWA_UPDATE_POLICY = {
  registerType: 'autoUpdate',
  injectRegister: false,
  skipWaiting: true,
  clientsClaim: true,
} as const

export const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1_000
