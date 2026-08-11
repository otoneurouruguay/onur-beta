import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

const publicUrl = process.env.ONUR_PUBLIC_URL || 'https://onur-beta-clinica.fedeshin.chatgpt.site/'
const clientPath = existsSync('dist/client') ? 'dist/client' : 'dist'
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const publicOrigin = new URL(publicUrl).origin

function requireCheck(condition, message) {
  if (!condition) throw new Error(message)
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function fetchBytes(pathname, accept = '*/*') {
  const response = await fetch(new URL(pathname, publicUrl), {
    redirect: 'follow',
    headers: {
      accept,
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
  requireCheck(response.status === 200, `${pathname} respondió HTTP ${response.status}.`)
  requireCheck(new URL(response.url).origin === publicOrigin, `${pathname} redirigió fuera del sitio público.`)
  return Buffer.from(await response.arrayBuffer())
}

const rootBytes = await fetchBytes('/', 'text/html,application/xhtml+xml')
const rootHtml = rootBytes.toString('utf8')
requireCheck(rootHtml.includes('id="root"'), 'Producción no entregó la aplicación ONUr.')

const exerciseBytes = await fetchBytes('/app/ejercicios', 'text/html,application/xhtml+xml')
requireCheck(exerciseBytes.toString('utf8').includes('id="root"'), 'La ruta profesional publicada no entregó ONUr.')

const mainMatch = rootHtml.match(/<script[^>]+src="(\/assets\/index-[^"]+\.js)"/)
requireCheck(mainMatch, 'Producción no referencia el paquete principal esperado.')
const mainPath = mainMatch[1]
const localMainPath = `${clientPath}${mainPath}`
requireCheck(existsSync(localMainPath), `La compilación local no contiene ${mainPath}.`)
const localMain = readFileSync(localMainPath)
const publishedMain = await fetchBytes(mainPath)
requireCheck(digest(localMain) === digest(publishedMain), 'El paquete principal publicado no coincide con la compilación validada.')

const exerciseModuleMatch = publishedMain.toString('utf8').match(/ExerciseBuilderPage-[A-Za-z0-9_-]+\.js/)
requireCheck(exerciseModuleMatch, 'El paquete publicado no referencia el constructor de ejercicios.')
const exerciseModulePath = `/assets/${exerciseModuleMatch[0]}`
const localExerciseModulePath = `${clientPath}${exerciseModulePath}`
requireCheck(existsSync(localExerciseModulePath), `La compilación local no contiene ${exerciseModulePath}.`)
const localExerciseModule = readFileSync(localExerciseModulePath)
const publishedExerciseModule = await fetchBytes(exerciseModulePath)
requireCheck(
  digest(localExerciseModule) === digest(publishedExerciseModule),
  'El constructor de ejercicios publicado no coincide con la compilación validada.',
)
requireCheck(
  publishedExerciseModule.toString('utf8').includes('Patología o condición clínica'),
  'El selector de patologías no está presente en la versión publicada.',
)

const localServiceWorker = readFileSync(`${clientPath}/sw.js`)
const publishedServiceWorker = await fetchBytes('/sw.js')
requireCheck(
  digest(localServiceWorker) === digest(publishedServiceWorker),
  'El caché publicado no coincide con la compilación validada.',
)
requireCheck(
  publishedServiceWorker.toString('utf8').includes(`onur-beta-${packageJson.version}`),
  `Producción no activó el caché de ${packageJson.version}.`,
)

console.log(`Publicación verificada: acceso, ruta profesional, selector, paquete principal y caché ${packageJson.version}.`)
