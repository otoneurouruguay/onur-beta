// @vitest-environment node

import { createCanvas, loadImage } from '@napi-rs/canvas'
import { resolve } from 'node:path'
import { createWorker, OEM, PSM } from 'tesseract.js'
import { describe, expect, it } from 'vitest'
import { extractFields } from '../src/features/extraction/extractor'
import { clinicalReportSummaryRegion } from '../src/features/extraction/reportOcrProfile'
import type { ExtractedPage, OcrLine, SourceRegion } from '../src/features/extraction/types'

function resultLines(result: any, width: number, height: number, target: SourceRegion = { x: 0, y: 0, width: 1, height: 1 }): OcrLine[] {
  const lines: OcrLine[] = []
  for (const block of result.data.blocks ?? []) for (const paragraph of block.paragraphs) for (const line of paragraph.lines) {
    lines.push({
      text: line.text.trim(),
      confidence: line.confidence,
      region: {
        x: target.x + line.bbox.x0 / width * target.width,
        y: target.y + line.bbox.y0 / height * target.height,
        width: (line.bbox.x1 - line.bbox.x0) / width * target.width,
        height: (line.bbox.y1 - line.bbox.y0) / height * target.height,
      },
    })
  }
  return lines.filter((line) => line.text)
}

describe('OCR de informe vestibular escaneado sintetico', () => {
  it('recupera En suma y Conducta multilinea con el perfil del navegador', async () => {
    const path = resolve('tests/fixtures/synthetic-clinical/vestibular_report_scanned_synthetic.jpg')
    const image = await loadImage(path)
    const canvas = createCanvas(image.width, image.height)
    canvas.getContext('2d').drawImage(image, 0, 0)
    const region = clinicalReportSummaryRegion
    const sourceX = Math.round(canvas.width * region.x)
    const sourceY = Math.round(canvas.height * region.y)
    const sourceWidth = Math.round(canvas.width * region.width)
    const sourceHeight = Math.round(canvas.height * region.height)
    const scale = Math.min(3, 3000 / Math.max(sourceWidth, sourceHeight))
    const crop = createCanvas(Math.round(sourceWidth * scale), Math.round(sourceHeight * scale))
    crop.getContext('2d').drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, crop.width, crop.height)
    const worker = await createWorker(['spa', 'eng'], OEM.LSTM_ONLY, {
      langPath: resolve('public/ocr/lang'),
      workerPath: resolve('node_modules/tesseract.js/src/worker-script/node/index.js'),
    })
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' })
      const full = await worker.recognize(path, { rotateAuto: false }, { text: true, blocks: true })
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1', user_defined_dpi: '300' })
      const summary = await worker.recognize(crop.toBuffer('image/png'), { rotateAuto: false }, { text: true, blocks: true })
      const lines = [...resultLines(full, canvas.width, canvas.height), ...resultLines(summary, crop.width, crop.height, region)]
      const page: ExtractedPage = {
        pageNumber: 1,
        proposedClassification: 'vestibular_report',
        classification: 'vestibular_report',
        classificationConfidence: .92,
        rotationDegrees: 0,
        width: canvas.width,
        height: canvas.height,
        previewUrl: '',
        text: lines.map((line) => line.text).join('\n'),
        lines,
      }
      const fields = extractFields([page], 'vestibular_and_reports')
      expect(fields.find((field) => field.studyType === 'vhit' && field.code === 'study_date')).toMatchObject({ value: '2026-07-17', required: true })
      expect(fields.find((field) => field.code === 'clinical_exam')?.rawValue).toContain('Se realizo examen clinico e instrumentado vestibular')
      expect(fields.find((field) => field.code === 'himp')).toMatchObject({ professionalValue: 'resultado sintetico', required: false })
      expect(fields.find((field) => field.code === 'cranial_nerve_vii')?.professionalValue).toContain('normal')
      expect(fields.find((field) => field.code === 'fixation_system')?.professionalValue).toContain('normal')
      expect(fields.find((field) => field.code === 'visual_suppression')?.professionalValue).toContain('normal')
      expect(fields.find((field) => field.code === 'skew')?.professionalValue).toContain('negativo')
      expect(fields.find((field) => field.code === 'head_shaking')?.professionalValue).toContain('negativo')
      expect(fields.find((field) => field.code === 'positional_tests')?.professionalValue).toContain('no registrado')
      expect(fields.find((field) => field.code === 'gait')?.professionalValue).toContain('resultado sintetico')
      expect(fields.find((field) => field.code === 'conclusion')?.rawValue).toContain('Hallazgo vestibular sintetico')
      expect(fields.find((field) => field.code === 'conclusion')?.rawValue).toContain('informacion perteneciente a una persona real')
      expect(fields.find((field) => field.code === 'conduct')?.rawValue).toContain('Reevaluacion sintetica y plan ficticio supervisado')
      expect(fields.find((field) => field.code === 'document_type')).toMatchObject({ rawValue: 'Informe vestibular / vHIT', status: 'needs_review' })
    } finally {
      await worker.terminate()
    }
  }, 30_000)
})
