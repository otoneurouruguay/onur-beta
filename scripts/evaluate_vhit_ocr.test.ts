// @vitest-environment node

import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas'
import { resolve } from 'node:path'
import { createWorker, OEM, PSM } from 'tesseract.js'
import { describe, expect, it } from 'vitest'
import { classifyPage, extractFields } from '../src/features/extraction/extractor'
import { detectVestibularTemplate } from '../src/features/extraction/vestibularOcrProfile'
import type { ExtractedPage, OcrLine } from '../src/features/extraction/types'

function rotateCanvas(source: Canvas, degrees: 90 | 270) {
  const target = createCanvas(source.height, source.width)
  const context = target.getContext('2d')
  context.translate(target.width / 2, target.height / 2)
  context.rotate(degrees * Math.PI / 180)
  context.drawImage(source, -source.width / 2, -source.height / 2)
  return target
}

function recognitionScore(text: string, confidence: number) {
  const source = text.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return ['vhit', 'ganancia', 'derecha', 'izquierda'].filter((signal) => source.includes(signal)).length * 500 + Math.min(300, source.replace(/\s/g, '').length) + confidence
}

function resultLines(result: any, canvas: Canvas, passId: string): OcrLine[] {
  const lines: OcrLine[] = []
  for (const block of result.data.blocks ?? []) for (const paragraph of block.paragraphs) for (const line of paragraph.lines) {
    lines.push({
      text: line.text.trim(), confidence: line.confidence, regionId: 'full_page', method: 'ocr_original', passId,
      region: { x: line.bbox.x0 / canvas.width, y: line.bbox.y0 / canvas.height, width: (line.bbox.x1 - line.bbox.x0) / canvas.width, height: (line.bbox.y1 - line.bbox.y0) / canvas.height },
    })
  }
  return lines.filter((line) => line.text)
}

describe('OCR vHIT sintético orientado', () => {
  it('corrige la orientación y recupera las ganancias sin interpretar curvas', async () => {
    const image = await loadImage(resolve('tests/fixtures/synthetic-clinical/vhit_rotated_partial_synthetic.png'))
    const original = createCanvas(image.width, image.height)
    original.getContext('2d').drawImage(image, 0, 0)
    const worker = await createWorker(['spa', 'eng'], OEM.LSTM_ONLY, {
      langPath: resolve('public/ocr/lang'),
      workerPath: resolve('node_modules/tesseract.js/src/worker-script/node/index.js'),
    })
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' })
      const candidates = []
      for (const [degrees, canvas] of [[0, original], [90, rotateCanvas(original, 90)], [270, rotateCanvas(original, 270)]] as const) {
        const result = await worker.recognize(canvas.toBuffer('image/png'), { rotateAuto: false }, { text: true, blocks: true })
        candidates.push({ degrees, canvas, result, score: recognitionScore(result.data.text, result.data.confidence) })
      }
      const selected = candidates.sort((first, second) => second.score - first.score)[0]
      const lines = resultLines(selected.result, selected.canvas, `full-${selected.degrees}`)
      const template = detectVestibularTemplate(lines.map((line) => line.text).join('\n'), selected.canvas.width, selected.canvas.height)
      const classification = classifyPage(lines.map((line) => line.text).join('\n'))
      const page: ExtractedPage = {
        pageNumber: 1, proposedClassification: classification.classification, classification: classification.classification,
        classificationConfidence: classification.confidence, rotationDegrees: selected.degrees, width: selected.canvas.width, height: selected.canvas.height,
        previewUrl: '', text: lines.map((line) => line.text).join('\n'), lines,
        template: { type: template.type, confidence: template.confidence, matchedSignals: template.matchedSignals, aspectRatio: template.aspectRatio },
      }
      const fields = extractFields([page], 'vestibular_and_reports')
      const value = (code: string) => fields.find((field) => field.studyType === 'vhit' && field.code === code)?.value
      expect(selected.degrees).not.toBe(0)
      expect(template.type).toBe('vhit_labeled')
      expect(page.classification).toBe('vhit_graph')
      expect(value('gain_right')).toBe(.91)
      expect(value('gain_left')).toBe(.87)
      expect(fields.some((field) => field.metricCode.includes('curve_interpretation'))).toBe(false)
    } finally {
      await worker.terminate()
    }
  }, 45_000)
})
