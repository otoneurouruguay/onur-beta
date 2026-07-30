import { PWA_UPDATE_CHECK_INTERVAL_MS } from './policy'

interface UpdatableServiceWorkerRegistration {
  update: () => Promise<unknown>
}

interface ServiceWorkerRegistrar {
  register: (
    scriptURL: string | URL,
    options?: RegistrationOptions,
  ) => Promise<UpdatableServiceWorkerRegistration>
}

interface DeferredRegistrationOptions {
  registrar?: ServiceWorkerRegistrar
  serviceWorkerUrl?: string
  scope?: string
  schedule?: (callback: () => void, delay: number) => unknown
}

export async function registerDeferredServiceWorker({
  registrar = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
  serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`,
  scope = import.meta.env.BASE_URL,
  schedule = typeof window === 'undefined' ? undefined : window.setInterval.bind(window),
}: DeferredRegistrationOptions = {}) {
  if (!registrar) return null

  const registration = await registrar.register(serviceWorkerUrl, { scope })
  await registration.update()

  schedule?.(() => {
    void registration.update().catch(() => undefined)
  }, PWA_UPDATE_CHECK_INTERVAL_MS)

  return registration
}

export function startDeferredServiceWorkerRegistration() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !('serviceWorker' in navigator)) return

  const register = () => {
    void registerDeferredServiceWorker().catch(() => undefined)
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
