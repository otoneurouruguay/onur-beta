import { createWorker, OEM, PSM } from 'tesseract.js'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { bapRecognitionProfile, binarizeBapDarkText, binarizeBapLightText, detectBapTemplate, expandedBapRegion, type BapPreprocessMode, type BapRecognitionRegion } from './bapOcrProfile'
import { classifyPage, comparePatientIdentity, EXTRACTOR_VERSION, extractFields, type PatientIdentityForMatch } from './extractor'
import { clinicalReportSummaryRegion } from './reportOcrProfile'
import type { ExtractedPage, ExtractionProgress, IntakeKind, LocalExtractionDraft, OcrLine } from './types'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const maxFileSize = 25 * 1024 * 1024

function localIsoDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function inferredMime(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return file.type || ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension ?? ''] ?? '')
}

export function validateClinicalFile(file: File) {
  if (file.size > maxFileSize) throw new Error('El archivo supera el máximo de 25 MB.')
  if (!acceptedTypes.has(inferredMime(file))) throw new Error('Usá un archivo PDF, JPG, JPEG, PNG o WEBP.')
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No fue posible preparar la vista previa.')), 'image/jpeg', .9))
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No fue posible leer la imagen.')) }
    image.src = url
  })
}

function improveContrast(source: HTMLCanvasElement) {
  const target = document.createElement('canvas')
  target.width = source.width
  target.height = source.height
  const context = target.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('El navegador no permite procesar la imagen localmente.')
  context.drawImage(source, 0, 0)
  const image = context.getImageData(0, 0, target.width, target.height)
  for (let index = 0; index < image.data.length; index += 4) {
    const grey = image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114
    const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.35 + 128))
    image.data[index] = contrasted
    image.data[index + 1] = contrasted
    image.data[index + 2] = contrasted
  }
  context.putImageData(image, 0, 0)
  return target
}

function rotateCanvas(source: HTMLCanvasElement, degrees: 90 | 270) {
  const target = document.createElement('canvas')
  target.width = source.height
  target.height = source.width
  const context = target.getContext('2d')
  if (!context) throw new Error('El navegador no permite corregir la orientación.')
  context.translate(target.width / 2, target.height / 2)
  context.rotate(degrees * Math.PI / 180)
  context.drawImage(source, -source.width / 2, -source.height / 2)
  return target
}

function recognitionScore(text: string, confidence: number) {
  const source = text.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const signals = ['posturograf', 'bap', 'adelante', 'condicion', 'score los', 'sway', 'vhit', 'ganancia', 'vestibular', 'conclusion']
  return signals.filter((signal) => source.includes(signal)).length * 500 + Math.min(300, source.replace(/\s/g, '').length) + confidence
}

function resultLines(
  result: Awaited<ReturnType<Awaited<ReturnType<typeof createWorker>>['recognize']>>,
  canvas: HTMLCanvasElement,
  target: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 1, height: 1 },
  metadata: Pick<OcrLine, 'regionId' | 'method' | 'passId'> = {},
) {
  const lines: OcrLine[] = []
  for (const block of result.data.blocks ?? []) for (const paragraph of block.paragraphs) for (const line of paragraph.lines) {
    lines.push({
      text: line.text.trim(),
      confidence: line.confidence,
      region: {
        x: target.x + line.bbox.x0 / canvas.width * target.width,
        y: target.y + line.bbox.y0 / canvas.height * target.height,
        width: (line.bbox.x1 - line.bbox.x0) / canvas.width * target.width,
        height: (line.bbox.y1 - line.bbox.y0) / canvas.height * target.height,
      },
      ...metadata,
    })
  }
  return lines.filter((line) => line.text)
}

function bapRegionCanvas(source: HTMLCanvasElement, region: { x: number; y: number; width: number; height: number }, requestedScale: number, mode: BapPreprocessMode) {
  const sourceX = Math.round(source.width * region.x)
  const sourceY = Math.round(source.height * region.y)
  const sourceWidth = Math.max(1, Math.round(source.width * region.width))
  const sourceHeight = Math.max(1, Math.round(source.height * region.height))
  const scale = Math.min(requestedScale, 3000 / Math.max(sourceWidth, sourceHeight))
  const target = document.createElement('canvas')
  target.width = Math.max(1, Math.round(sourceWidth * scale))
  target.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = target.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('El navegador no permite preparar las regiones BAP.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, target.width, target.height)
  if (mode !== 'original') {
    const image = context.getImageData(0, 0, target.width, target.height)
    if (mode === 'light_text') binarizeBapLightText(image.data)
    else binarizeBapDarkText(image.data, mode === 'grayscale' ? 155 : mode === 'dark_text_low' ? 128 : 145)
    context.putImageData(image, 0, 0)
  }
  return target
}

function regionPsm(region: BapRecognitionRegion) {
  if (region.psm === 'line') return PSM.SINGLE_LINE
  if (region.psm === 'block') return PSM.SINGLE_BLOCK
  return PSM.SPARSE_TEXT
}

function textRegion(source: HTMLCanvasElement, region: { x: number; y: number; width: number; height: number }) {
  const sourceX = Math.round(source.width * region.x)
  const sourceY = Math.round(source.height * region.y)
  const sourceWidth = Math.max(1, Math.round(source.width * region.width))
  const sourceHeight = Math.max(1, Math.round(source.height * region.height))
  const scale = Math.min(3, 3000 / Math.max(sourceWidth, sourceHeight))
  const target = document.createElement('canvas')
  target.width = Math.max(1, Math.round(sourceWidth * scale))
  target.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = target.getContext('2d')
  if (!context) throw new Error('El navegador no permite preparar el bloque de texto clinico.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, target.width, target.height)
  return target
}

function mergeOcrLines(groups: OcrLine[][]) {
  const merged: OcrLine[] = []
  for (const line of groups.flat()) {
    const key = line.text.toLocaleLowerCase('es-UY').replace(/\s+/g, ' ').trim()
    const duplicate = merged.findIndex((candidate) => candidate.passId === line.passId && candidate.text.toLocaleLowerCase('es-UY').replace(/\s+/g, ' ').trim() === key && Math.abs(candidate.region.y - line.region.y) < .025)
    if (duplicate < 0) merged.push(line)
    else if (line.confidence > merged[duplicate].confidence) merged[duplicate] = line
  }
  return merged.sort((a, b) => a.region.y - b.region.y || a.region.x - b.region.x)
}

async function recognizeCanvas(canvas: HTMLCanvasElement, intakeKind: IntakeKind) {
  const base = `${import.meta.env.BASE_URL}ocr/`
  const worker = await createWorker(['spa', 'eng'], OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`, langPath: `${base}lang`, corePath: `${base}core`,
    workerBlobURL: false, gzip: true,
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' })
    const primary = await worker.recognize(canvas, { rotateAuto: false }, { text: true, blocks: true })
    const candidates = [{ result: primary, canvas, degrees: 0 }]
    if (recognitionScore(primary.data.text, primary.data.confidence) < 650) {
      for (const degrees of [90, 270] as const) {
        const rotated = rotateCanvas(canvas, degrees)
        candidates.push({ result: await worker.recognize(rotated, { rotateAuto: false }, { text: true, blocks: true }), canvas: rotated, degrees })
      }
    }
    const selected = candidates.sort((a, b) => recognitionScore(b.result.data.text, b.result.data.confidence) - recognitionScore(a.result.data.text, a.result.data.confidence))[0]
    const results = [selected.result]
    const lineGroups = [resultLines(selected.result, selected.canvas, undefined, { regionId: 'full_page', method: 'ocr_original', passId: 'full-original' })]
    if (intakeKind === 'posturography_bap' || selected.result.data.confidence < 72) {
      const contrasted = improveContrast(selected.canvas)
      const contrastedResult = await worker.recognize(contrasted, { rotateAuto: false }, { text: true, blocks: true })
      results.push(contrastedResult)
      lineGroups.push(resultLines(contrastedResult, contrasted, undefined, { regionId: 'full_page', method: 'ocr_grayscale', passId: 'full-grayscale' }))
    }
    if (intakeKind === 'vestibular_and_reports') {
      // Los informes escaneados suelen concentrar "En suma" y "Conducta" en
      // el tercio inferior. PSM.SPARSE_TEXT separa esas frases en fragmentos;
      // una segunda lectura como bloque preserva sus renglones y continuidad.
      const prepared = textRegion(selected.canvas, clinicalReportSummaryRegion)
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1', user_defined_dpi: '300' })
      const summaryResult = await worker.recognize(prepared, { rotateAuto: false }, { text: true, blocks: true })
      results.push(summaryResult)
      lineGroups.push(resultLines(summaryResult, prepared, clinicalReportSummaryRegion, { regionId: 'report_summary', method: 'ocr_original', passId: 'report-summary' }))
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' })
    }
    if (intakeKind === 'posturography_bap') {
      for (const region of bapRecognitionProfile) {
        const target = expandedBapRegion(region.bbox, region.id.endsWith('_high_priority') ? 0 : .03)
        const passCount = Math.max(region.scales.length, region.modes.length)
        for (let pass = 0; pass < passCount; pass += 1) {
          const scale = region.scales[pass % region.scales.length]
          const mode = region.modes[pass % region.modes.length]
          const prepared = bapRegionCanvas(selected.canvas, target, scale, mode)
          await worker.setParameters({ tessedit_pageseg_mode: regionPsm(region), preserve_interword_spaces: '1', user_defined_dpi: '300' })
          const regionResult = await worker.recognize(prepared, { rotateAuto: false }, { text: true, blocks: true })
          results.push(regionResult)
          const method = mode === 'original' ? 'ocr_original' : mode === 'grayscale' ? 'ocr_grayscale' : 'ocr_threshold'
          lineGroups.push(resultLines(regionResult, prepared, target, { regionId: region.id, method, passId: `${region.id}-${mode}-${scale}` }))
        }
      }
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' })
    }
    const lines = mergeOcrLines(lineGroups)
    return {
      text: lines.map((line) => line.text).join('\n'),
      confidence: Math.max(...results.map((result) => result.data.confidence)),
      rotationDegrees: selected.degrees,
      lines,
      canvas: selected.canvas,
    }
  } finally { await worker.terminate() }
}

async function imageCanvas(file: File) {
  const image = await loadImage(file)
  const maxDimension = 4200
  const scale = Math.min(3, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no permite preparar la imagen.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function analyzeCanvas(canvas: HTMLCanvasElement, pageNumber: number, intakeKind: IntakeKind, embeddedText = '', embeddedLines: OcrLine[] = []): Promise<ExtractedPage> {
  const ocr = embeddedText.trim().length > 80 ? { text: embeddedText, confidence: 95, rotationDegrees: 0, lines: embeddedLines, canvas } : await recognizeCanvas(canvas, intakeKind)
  const template = detectBapTemplate(ocr.text, ocr.canvas.width, ocr.canvas.height)
  const genericClassification = classifyPage(ocr.text)
  const classification = intakeKind === 'posturography_bap' && template.detected ? { classification: 'posturography' as const, confidence: Math.max(template.confidence, genericClassification.confidence) } : genericClassification
  const previewUrl = URL.createObjectURL(await canvasBlob(ocr.canvas))
  return { pageNumber, proposedClassification: classification.classification, classification: classification.classification, classificationConfidence: classification.confidence, rotationDegrees: ocr.rotationDegrees, width: ocr.canvas.width, height: ocr.canvas.height, previewUrl, text: ocr.text, lines: ocr.lines, template: { type: template.detected ? 'bap_2_32' : 'generic', confidence: template.confidence, matchedSignals: template.matchedSignals, aspectRatio: template.aspectRatio } }
}

async function analyzePdf(file: File, intakeKind: IntakeKind, progress: (value: ExtractionProgress) => void) {
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: ExtractedPage[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    progress({ currentPage: pageNumber, totalPages: pdf.numPages, phase: 'rendering' })
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2.2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('El navegador no permite renderizar el PDF.')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const textContent = await page.getTextContent()
    const embeddedLines: OcrLine[] = textContent.items.flatMap((item) => {
      if (!('str' in item) || !item.str.trim()) return []
      const point = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
      const height = Math.max(8, Math.abs(item.transform[3]) * viewport.scale)
      return [{ text: item.str, confidence: 99, region: { x: Math.max(0, point[0] / canvas.width), y: Math.max(0, (point[1] - height) / canvas.height), width: Math.min(1, Math.max(.01, item.width * viewport.scale / canvas.width)), height: Math.min(1, height / canvas.height) } }]
    })
    const embeddedText = embeddedLines.map((line) => line.text).join('\n')
    progress({ currentPage: pageNumber, totalPages: pdf.numPages, phase: embeddedText.trim().length > 80 ? 'classifying' : 'ocr' })
    pages.push(await analyzeCanvas(canvas, pageNumber, intakeKind, embeddedText, embeddedLines))
    page.cleanup()
  }
  await pdf.cleanup()
  return pages
}

export async function analyzeClinicalFile(file: File, intakeKind: IntakeKind, patient: PatientIdentityForMatch, onProgress: (value: ExtractionProgress) => void): Promise<LocalExtractionDraft> {
  validateClinicalFile(file)
  let pages: ExtractedPage[] = []
  if (inferredMime(file) === 'application/pdf') pages = await analyzePdf(file, intakeKind, onProgress)
  else {
    onProgress({ currentPage: 1, totalPages: 1, phase: 'ocr' })
    pages = [await analyzeCanvas(await imageCanvas(file), 1, intakeKind)]
  }
  const match = comparePatientIdentity(pages, patient)
  onProgress({ currentPage: pages.length, totalPages: pages.length, phase: 'done' })
  const fields = extractFields(pages, intakeKind)
  const studyDate = typeof fields.find((field) => field.code === 'study_date')?.value === 'string' ? String(fields.find((field) => field.code === 'study_date')?.value) : ''
  return { intakeKind, extractorVersion: EXTRACTOR_VERSION, pages, fields, patientMatchStatus: match.status, mismatchFields: match.mismatchFields, studyDate, uploadDate: localIsoDate() }
}

export function releaseExtractionPreviews(draft: LocalExtractionDraft | null) {
  draft?.pages.forEach((page) => URL.revokeObjectURL(page.previewUrl))
}
