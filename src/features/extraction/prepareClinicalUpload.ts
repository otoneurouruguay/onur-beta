import { PDFDocument } from 'pdf-lib'

export interface PreparedClinicalUpload {
  file: File
  sourceNames: string[]
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

function inferredMime(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return file.type || ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension ?? ''] ?? '')
}

function validateUploadFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('El archivo supera el máximo de 25 MB.')
  if (!acceptedTypes.has(inferredMime(file))) throw new Error('Usá archivos PDF, JPG, JPEG, PNG o WEBP.')
}

async function webpAsPng(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('El navegador no permite preparar la imagen WEBP.')
    context.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('No fue posible convertir la imagen WEBP.')), 'image/png'))
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

function imagePageSize(width: number, height: number) {
  const landscape = width > height
  const bounds = landscape ? { width: 842, height: 595 } : { width: 595, height: 842 }
  const scale = Math.min(bounds.width / width, bounds.height / height)
  return { pageWidth: bounds.width, pageHeight: bounds.height, width: width * scale, height: height * scale }
}

export async function prepareClinicalUpload(files: File[]): Promise<PreparedClinicalUpload> {
  if (!files.length) throw new Error('Seleccioná al menos un archivo.')
  files.forEach(validateUploadFile)
  if (files.length === 1) return { file: files[0], sourceNames: [files[0].name] }

  const output = await PDFDocument.create()
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const mime = inferredMime(file)
    if (mime === 'application/pdf') {
      const source = await PDFDocument.load(bytes)
      const pages = await output.copyPages(source, source.getPageIndices())
      pages.forEach((page) => output.addPage(page))
      continue
    }
    const imageBytes = mime === 'image/webp' ? await webpAsPng(file) : bytes
    const embedded = mime === 'image/jpeg' ? await output.embedJpg(imageBytes) : await output.embedPng(imageBytes)
    const size = imagePageSize(embedded.width, embedded.height)
    const page = output.addPage([size.pageWidth, size.pageHeight])
    page.drawImage(embedded, { x: (size.pageWidth - size.width) / 2, y: (size.pageHeight - size.height) / 2, width: size.width, height: size.height })
  }
  const bytes = await output.save({ useObjectStreams: true })
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error('El PDF combinado supera el máximo de 25 MB. Reducí el tamaño o la cantidad de archivos.')
  const file = new File([Uint8Array.from(bytes).buffer], `estudio-${files.length}-archivos-${new Date().toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' })
  return { file, sourceNames: files.map((item) => item.name) }
}
