import { cp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

const projectRoot = process.cwd()
const target = join(projectRoot, 'public', 'ocr')
const coreSource = join(projectRoot, 'node_modules', 'tesseract.js-core')
const workerSource = join(projectRoot, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js')

await rm(target, { recursive: true, force: true })
await mkdir(join(target, 'core'), { recursive: true })
await mkdir(join(target, 'lang'), { recursive: true })
await cp(workerSource, join(target, 'worker.min.js'))

// ONUr siempre crea el worker con OEM.LSTM_ONLY. El cargador web elige una
// de estas variantes según el soporte SIMD; los otros cores no se solicitan.
const lstmBrowserCores = [
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js',
]

for (const filename of lstmBrowserCores) {
  await cp(join(coreSource, filename), join(target, 'core', filename))
}

for (const language of ['spa', 'eng']) {
  const source = join(projectRoot, 'node_modules', `@tesseract.js-data/${language}`, '4.0.0_best_int', `${language}.traineddata.gz`)
  await cp(source, join(target, 'lang', `${language}.traineddata.gz`))
}
