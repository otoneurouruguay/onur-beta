import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const publicUrl = process.env.ONUR_PUBLIC_URL || 'https://onur-beta-clinica.fedeshin.chatgpt.site/'
const npmCommand = process.env.npm_execpath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
const reuseBuild = process.argv.includes('--reuse-build')

function runNpmScript(name) {
  const argumentsList = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', name]
    : ['run', name]
  const result = spawnSync(npmCommand, argumentsList, { stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function requireCheck(condition, message) {
  if (!condition) throw new Error(message)
}

if (!reuseBuild) {
  for (const script of ['typecheck', 'lint', 'test:run', 'build:authenticated']) {
    runNpmScript(script)
  }
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const serviceWorkerPath = existsSync('dist/client/sw.js') ? 'dist/client/sw.js' : 'dist/sw.js'
const clientPath = existsSync('dist/client') ? 'dist/client' : 'dist'
requireCheck(existsSync(serviceWorkerPath), 'La compilación no generó sw.js.')

const serviceWorker = readFileSync(serviceWorkerPath, 'utf8')
const expectedCacheId = `onur-beta-${packageJson.version}`
requireCheck(serviceWorker.includes(expectedCacheId), `El caché publicado no coincide con ${packageJson.version}.`)
const skipWaitingCalls = [...serviceWorker.matchAll(/self\.skipWaiting\s*\(\)/g)]
requireCheck(
  skipWaitingCalls.length >= 1,
  'El service worker no activa inmediatamente el caché nuevo.',
)
requireCheck(/\bclientsClaim\s*\(/.test(serviceWorker), 'El service worker nuevo no toma control de las pestañas abiertas.')

const manifest = JSON.parse(readFileSync(`${clientPath}/manifest.webmanifest`, 'utf8'))
const requiredIcons = new Map([
  ['otoneuro-app-192.png', '192x192:any'],
  ['otoneuro-app-512.png', '512x512:any'],
  ['otoneuro-app-maskable-192.png', '192x192:maskable'],
  ['otoneuro-app-maskable-512.png', '512x512:maskable'],
])
for (const icon of manifest.icons ?? []) {
  const expected = requiredIcons.get(icon.src)
  if (expected === `${icon.sizes}:${icon.purpose}`) requiredIcons.delete(icon.src)
}
requireCheck(requiredIcons.size === 0, `Faltan íconos PWA oficiales: ${[...requiredIcons.keys()].join(', ')}.`)

for (const [filename, expectedSize] of [
  ['favicon-32.png', 32],
  ['favicon-48.png', 48],
  ['otoneuro-apple-touch-icon.png', 180],
  ['otoneuro-app-192.png', 192],
  ['otoneuro-app-512.png', 512],
  ['otoneuro-app-maskable-192.png', 192],
  ['otoneuro-app-maskable-512.png', 512],
]) {
  const png = readFileSync(`${clientPath}/${filename}`)
  requireCheck(png.toString('ascii', 1, 4) === 'PNG', `${filename} no es un PNG válido.`)
  requireCheck(
    png.readUInt32BE(16) === expectedSize && png.readUInt32BE(20) === expectedSize,
    `${filename} no mide ${expectedSize}x${expectedSize}.`,
  )
}

const response = await fetch(publicUrl, {
  redirect: 'manual',
  headers: { 'cache-control': 'no-cache' },
})
requireCheck(response.status === 200, `El sitio público respondió HTTP ${response.status}.`)
const html = await response.text()
requireCheck(html.includes('id="root"'), 'La URL pública no entregó la aplicación ONUr.')

console.log('\nChecklist técnico aprobado: acceso, borradores protegidos, caché autoactivable, identidad PWA, pruebas y compilación.')
