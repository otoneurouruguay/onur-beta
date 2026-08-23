// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('privacidad del OCR local', () => {
  it('carga worker, core e idiomas desde rutas relativas del bundle sin proveedor externo ni clave secreta', async () => {
    const source = await readFile(resolve('src/features/extraction/localOcr.ts'), 'utf8')
    expect(source).toContain('import.meta.env.BASE_URL')
    expect(source).not.toMatch(/https?:\/\//)
    expect(source).not.toMatch(/api[_-]?key|authorization\s*:/i)
  })
})
