import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { prepareClinicalUpload } from './prepareClinicalUpload'

async function syntheticPdf(name: string, pages: number) {
  const document = await PDFDocument.create()
  for (let index = 0; index < pages; index += 1) document.addPage([300, 400])
  const bytes = await document.save()
  return new File([Uint8Array.from(bytes).buffer], name, { type: 'application/pdf' })
}

describe('preparación de carga clínica múltiple', () => {
  it('reúne varios PDF en orden y conserva sus nombres de origen', async () => {
    const first = await syntheticPdf('vhit-parte-1.pdf', 2)
    const second = await syntheticPdf('vhit-parte-2.pdf', 1)
    const prepared = await prepareClinicalUpload([first, second])
    const combined = await PDFDocument.load(await prepared.file.arrayBuffer())

    expect(prepared.file.type).toBe('application/pdf')
    expect(combined.getPageCount()).toBe(3)
    expect(prepared.sourceNames).toEqual(['vhit-parte-1.pdf', 'vhit-parte-2.pdf'])
  })

  it('mantiene el archivo original cuando se selecciona uno solo', async () => {
    const source = await syntheticPdf('posturografia-inicial.pdf', 1)
    const prepared = await prepareClinicalUpload([source])
    expect(prepared.file).toBe(source)
  })
})
