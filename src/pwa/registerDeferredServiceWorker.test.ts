import { describe, expect, it, vi } from 'vitest'
import { PWA_UPDATE_CHECK_INTERVAL_MS, PWA_UPDATE_POLICY } from './policy'
import { registerDeferredServiceWorker } from './registerDeferredServiceWorker'

describe('actualización diferida de la PWA', () => {
  it('mantiene desactivadas las causas de recarga automática', () => {
    expect(PWA_UPDATE_POLICY).toEqual({
      registerType: 'prompt',
      injectRegister: false,
      skipWaiting: false,
      clientsClaim: false,
    })
  })

  it('busca actualizaciones sin recargar la página actual', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const register = vi.fn().mockResolvedValue({ update })
    const schedule = vi.fn()

    await registerDeferredServiceWorker({
      registrar: { register },
      serviceWorkerUrl: '/sw.js',
      scope: '/',
      schedule,
    })

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
    expect(update).toHaveBeenCalledTimes(1)
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), PWA_UPDATE_CHECK_INTERVAL_MS)

    const scheduledUpdate = schedule.mock.calls[0][0] as () => void
    scheduledUpdate()
    await Promise.resolve()
    expect(update).toHaveBeenCalledTimes(2)
  })
})
