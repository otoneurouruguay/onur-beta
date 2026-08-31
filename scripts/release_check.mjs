import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { loadEnvFile } from 'node:process'

const publicUrl = process.env.ONUR_PUBLIC_URL || 'https://onur-beta-clinica.fedeshin.chatgpt.site/'
const npmCommand = process.env.npm_execpath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
const reuseBuild = process.argv.includes('--reuse-build')

if ((!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) && existsSync('.env.staging.local')) {
  loadEnvFile('.env.staging.local')
}
const publicSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const publicSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

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
requireCheck(
  packageJson.scripts?.dev === 'node scripts/dev_authenticated.mjs',
  'La vista previa local no usa el arranque autenticado obligatorio.',
)
requireCheck(existsSync('scripts/dev_authenticated.mjs'), 'Falta el arranque autenticado para la vista previa local.')
const authenticatedDevelopmentScript = readFileSync('scripts/dev_authenticated.mjs', 'utf8')
for (const marker of [
  'VITE_SUPABASE_URL: supabaseUrl',
  'VITE_SUPABASE_ANON_KEY: supabaseAnonKey',
  "'SUPABASE_SERVICE_ROLE_KEY'",
  "'SUPABASE_DB_PASSWORD'",
  "'PATIENT_AUTH_PEPPER'",
  "'PROFESSIONAL_PASSWORD'",
]) {
  requireCheck(
    authenticatedDevelopmentScript.includes(marker),
    `El arranque local autenticado no contiene el control obligatorio: ${marker}.`,
  )
}
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

const compiledJavaScript = readdirSync(`${clientPath}/assets`)
  .filter((filename) => filename.endsWith('.js'))
  .map((filename) => readFileSync(`${clientPath}/assets/${filename}`, 'utf8'))
  .join('\n')
requireCheck(Boolean(publicSupabaseUrl && publicSupabaseAnonKey), 'Falta la configuración pública de autenticación para verificar la publicación.')
requireCheck(
  compiledJavaScript.includes(publicSupabaseUrl) && compiledJavaScript.includes(publicSupabaseAnonKey),
  'La compilación no contiene la conexión de autenticación. Usá npm run build:authenticated antes de publicar.',
)
for (const marker of [
  'onur:lazy-import-refresh:',
  'Actualizar y volver a intentar',
  'Patología o condición clínica',
  'Borrador recuperado automáticamente',
  'Agregar a la selección',
  'Estroboscópicos · experimental',
  'Imágenes rápidas · cognitivo-visual',
  'Velocidad de seguimiento ocular',
  'Grave · 220 Hz',
  'Muy agudo · 1320 Hz',
  'Episodio clínico',
  'Notas recordatorias',
  'Ayuda memoria privada y opcional',
  'Ajuste óptico avanzado del teléfono y visor',
  'Fundamento, límites y fuentes',
  'Buscar por nombre, objetivo o consigna',
  'Filtrar por dispositivo',
  'Filtrar por patología o protocolo',
  'Los filtros sólo cambian la biblioteca visible',
  'Registrar esta sesión pasada como ya finalizada',
  'Registrada retrospectivamente',
  'Sin métricas retrospectivas',
  'Clínica actual',
  'Estudios e informes cargados',
  'Esta posturografía ya está cargada',
  'Ya existe una posturografía',
  'si corresponde.',
  'complete_supervised_in_person_session_v2',
  'Repetir / programar',
  'Días consecutivos',
  'Serie programada',
  'repeat_session_assignment_as_home',
  'Datos del paciente',
  'N.º de afiliado',
  'session_plans(title)',
  'Conclusión transcripta para confirmar',
  'Sugerencia clínica fundamentada para confirmar',
  'Conducta original transcripta',
  'Fuentes relevantes del catálogo',
  'Historial clínico de solo lectura',
  'Ejercicios de la sesión',
  'Sin detalle individual',
  'Ver sesión',
  'DHI_AR_25',
  'Enviar al portal',
  'Iniciar cuestionario',
  'Guardar avance',
  'Cuestionario enviado',
  'Continuar presencial',
  'Cancelar asignación',
  'create_assessment_assignment',
  'complete_assessment',
  'cancel_assessment',
]) {
  requireCheck(compiledJavaScript.includes(marker), `La compilación no contiene el control obligatorio: ${marker}.`)
}

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

const exerciseResponse = await fetch(new URL('/app/ejercicios', publicUrl), {
  redirect: 'follow',
  headers: {
    accept: 'text/html,application/xhtml+xml',
    'cache-control': 'no-cache',
  },
})
requireCheck(exerciseResponse.status === 200, `La ruta profesional respondió HTTP ${exerciseResponse.status}.`)
requireCheck(
  new URL(exerciseResponse.url).origin === new URL(publicUrl).origin,
  'La ruta profesional redirigió fuera del sitio público.',
)
const exerciseHtml = await exerciseResponse.text()
requireCheck(exerciseHtml.includes('id="root"'), 'La ruta profesional no entregó la aplicación ONUr.')

console.log('\nChecklist técnico aprobado: acceso público y profundo, vista previa autenticada, controles clínicos, borradores protegidos, caché autoactivable, identidad PWA, pruebas y compilación.')
