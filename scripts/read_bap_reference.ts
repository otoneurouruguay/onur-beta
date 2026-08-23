import { resolve } from 'node:path'
import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas'
import { createWorker, OEM, PSM } from 'tesseract.js'
import { bapRecognitionProfile, binarizeBapDarkText, binarizeBapLightText, detectBapTemplate, expandedBapRegion, type BapPreprocessMode, type BapRecognitionRegion } from '../src/features/extraction/bapOcrProfile'
import { extractFields } from '../src/features/extraction/extractor'
import type { ExtractedPage, OcrLine, SourceRegion } from '../src/features/extraction/types'

function psm(region: BapRecognitionRegion) {
  if (region.psm === 'line') return PSM.SINGLE_LINE
  if (region.psm === 'block') return PSM.SINGLE_BLOCK
  return PSM.SPARSE_TEXT
}

function resultLines(result: any, canvas: Canvas, target: SourceRegion, region: BapRecognitionRegion | null, passId: string, mode: BapPreprocessMode = 'original') {
  const lines: OcrLine[] = []
  for (const block of result.data.blocks ?? []) for (const paragraph of block.paragraphs) for (const line of paragraph.lines) lines.push({
    text: line.text.trim(), confidence: line.confidence,
    region: { x: target.x + line.bbox.x0 / canvas.width * target.width, y: target.y + line.bbox.y0 / canvas.height * target.height, width: (line.bbox.x1 - line.bbox.x0) / canvas.width * target.width, height: (line.bbox.y1 - line.bbox.y0) / canvas.height * target.height },
    regionId: region?.id ?? 'full_page', method: mode === 'original' ? 'ocr_original' : mode === 'grayscale' ? 'ocr_grayscale' : 'ocr_threshold', passId,
  })
  return lines.filter((line) => line.text)
}

function prepareRegion(source: Canvas, region: SourceRegion, requestedScale: number, mode: BapPreprocessMode) {
  const sourceX = Math.round(source.width * region.x), sourceY = Math.round(source.height * region.y)
  const sourceWidth = Math.max(1, Math.round(source.width * region.width)), sourceHeight = Math.max(1, Math.round(source.height * region.height))
  const scale = Math.min(requestedScale, 3000 / Math.max(sourceWidth, sourceHeight))
  const target = createCanvas(Math.max(1, Math.round(sourceWidth * scale)), Math.max(1, Math.round(sourceHeight * scale)))
  const context = target.getContext('2d')
  context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, target.width, target.height)
  if (mode !== 'original') {
    const image = context.getImageData(0, 0, target.width, target.height)
    if (mode === 'light_text') binarizeBapLightText(image.data)
    else binarizeBapDarkText(image.data, mode === 'grayscale' ? 155 : mode === 'dark_text_low' ? 128 : 145)
    context.putImageData(image, 0, 0)
  }
  return target
}

export async function readBapReferenceImage(path: string) {
  const image = await loadImage(path)
  const canvas = createCanvas(image.width, image.height)
  canvas.getContext('2d').drawImage(image, 0, 0)
  const worker = await createWorker(['spa', 'eng'], OEM.LSTM_ONLY, { langPath: resolve('public/ocr/lang'), workerPath: resolve('node_modules/tesseract.js/src/worker-script/node/index.js') })
  const groups: OcrLine[][] = []
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' })
    const full = await worker.recognize(path, { rotateAuto: false }, { text: true, blocks: true })
    groups.push(resultLines(full, canvas, { x: 0, y: 0, width: 1, height: 1 }, null, 'full-original'))
    for (const region of bapRecognitionProfile) {
      const target = expandedBapRegion(region.bbox, region.id.endsWith('_high_priority') ? 0 : .03)
      const passCount = Math.max(region.scales.length, region.modes.length)
      for (let pass = 0; pass < passCount; pass += 1) {
        const scale = region.scales[pass % region.scales.length]
        const mode = region.modes[pass % region.modes.length]
        const prepared = prepareRegion(canvas, target, scale, mode)
        await worker.setParameters({ tessedit_pageseg_mode: psm(region), preserve_interword_spaces: '1', user_defined_dpi: '300' })
        const result = await worker.recognize(prepared.toBuffer('image/png'), { rotateAuto: false }, { text: true, blocks: true })
        groups.push(resultLines(result, prepared, target, region, `${region.id}-${mode}-${scale}`, mode))
      }
    }
  } finally { await worker.terminate() }
  const lines = groups.flat().sort((a, b) => a.region.y - b.region.y || a.region.x - b.region.x)
  const text = lines.map((line) => line.text).join('\n')
  const template = detectBapTemplate(text, canvas.width, canvas.height)
  const page: ExtractedPage = { pageNumber: 1, proposedClassification: template.detected ? 'posturography' : 'unrecognized', classification: template.detected ? 'posturography' : 'unrecognized', classificationConfidence: template.confidence, rotationDegrees: 0, width: canvas.width, height: canvas.height, previewUrl: '', text, lines, template: { type: template.detected ? 'bap_2_32' : 'generic', confidence: template.confidence, matchedSignals: template.matchedSignals, aspectRatio: template.aspectRatio } }
  return { page, fields: extractFields([page], 'posturography_bap') }
}
