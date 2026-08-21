import { lazy, type ComponentType } from 'react'

const REFRESH_KEY_PREFIX = 'onur:lazy-import-refresh:'
const RECOVERABLE_IMPORT_MESSAGES = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'loading chunk',
  'chunkloaderror',
  'unable to preload css',
]

interface RecoveryStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

interface ImportRecoveryOptions {
  storage?: RecoveryStorage | null
  reload?: (() => void) | null
  isOnline?: () => boolean
}

function browserStorage() {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function browserReload() {
  if (typeof window === 'undefined') return null
  return () => window.location.reload()
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export function isRecoverableLazyImportError(error: unknown) {
  const message = errorMessage(error).toLowerCase()
  return RECOVERABLE_IMPORT_MESSAGES.some((marker) => message.includes(marker))
}

export async function importWithRefresh<T>(
  importer: () => Promise<T>,
  importKey: string,
  options: ImportRecoveryOptions = {},
) {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const refreshKey = `${REFRESH_KEY_PREFIX}${importKey}`

  try {
    const importedModule = await importer()

    try {
      storage?.removeItem(refreshKey)
    } catch {
      // El módulo ya cargó; una restricción de almacenamiento no debe bloquearlo.
    }

    return importedModule
  } catch (error) {
    const isOnline = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine)
    const reload = options.reload === undefined ? browserReload() : options.reload

    if (!isRecoverableLazyImportError(error) || !storage || !reload || !isOnline()) throw error

    let previousAttempt: string | null
    try {
      previousAttempt = storage.getItem(refreshKey)
    } catch {
      throw error
    }

    if (previousAttempt) throw error

    try {
      storage.setItem(refreshKey, 'attempted')
    } catch {
      throw error
    }

    reload()

    // La navegación cancela esta importación. Mantenerla pendiente evita que el
    // router muestre brevemente un error mientras el navegador se actualiza.
    return await new Promise<T>(() => undefined)
  }
}

export function lazyWithRefresh<T extends ComponentType<Record<string, never>>>(
  importKey: string,
  importer: () => Promise<{ default: T }>,
) {
  return lazy(() => importWithRefresh(importer, importKey))
}
