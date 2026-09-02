import { describe, expect, it, vi } from 'vitest'
import { importWithRefresh, isRecoverableLazyImportError } from './lazyWithRefresh'

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('recuperación de módulos de una publicación anterior', () => {
  it('reconoce el error que producen los imports dinámicos obsoletos', () => {
    expect(isRecoverableLazyImportError(new TypeError(
      'Failed to fetch dynamically imported module: https://example.test/assets/DashboardPage-old.js',
    ))).toBe(true)
    expect(isRecoverableLazyImportError(new Error('La consulta clínica falló.'))).toBe(false)
  })

  it('actualiza la página una sola vez cuando falta un módulo obsoleto', async () => {
    const storage = createStorage()
    const reload = vi.fn()
    const error = new TypeError('Failed to fetch dynamically imported module')

    void importWithRefresh(() => Promise.reject(error), 'dashboard', {
      storage,
      reload,
      isOnline: () => true,
    })

    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
    expect(storage.getItem('onur:lazy-import-refresh:dashboard')).toBe('attempted')
  })

  it('no entra en un ciclo de actualizaciones si el segundo intento falla', async () => {
    const storage = createStorage({ 'onur:lazy-import-refresh:dashboard': 'attempted' })
    const reload = vi.fn()
    const error = new TypeError('Failed to fetch dynamically imported module')

    await expect(importWithRefresh(() => Promise.reject(error), 'dashboard', {
      storage,
      reload,
      isOnline: () => true,
    })).rejects.toBe(error)
    expect(reload).not.toHaveBeenCalled()
  })

  it('limpia el intento guardado cuando el módulo nuevo carga', async () => {
    const storage = createStorage({ 'onur:lazy-import-refresh:dashboard': 'attempted' })
    const importedModule = { default: 'dashboard' }

    await expect(importWithRefresh(() => Promise.resolve(importedModule), 'dashboard', {
      storage,
    })).resolves.toBe(importedModule)
    expect(storage.getItem('onur:lazy-import-refresh:dashboard')).toBeNull()
  })
})
