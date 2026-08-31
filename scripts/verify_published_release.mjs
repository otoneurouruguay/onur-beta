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
const exerciseEditorModuleMatch = publishedExerciseModule.toString('utf8').match(/grouping-[A-Za-z0-9_-]+\.js/)
requireCheck(exerciseEditorModuleMatch, 'El constructor publicado no referencia el editor compartido de ejercicios.')
const exerciseEditorModulePath = `/assets/${exerciseEditorModuleMatch[0]}`
const localExerciseEditorModulePath = `${clientPath}${exerciseEditorModulePath}`
requireCheck(existsSync(localExerciseEditorModulePath), `La compilación local no contiene ${exerciseEditorModulePath}.`)
const localExerciseEditorModule = readFileSync(localExerciseEditorModulePath)
const publishedExerciseEditorModule = await fetchBytes(exerciseEditorModulePath)
requireCheck(
  digest(localExerciseEditorModule) === digest(publishedExerciseEditorModule),
  'El editor compartido de ejercicios publicado no coincide con la compilación validada.',
)
for (const marker of ['Ajuste óptico avanzado del teléfono y visor', 'Fundamento, límites y fuentes']) {
  requireCheck(publishedExerciseEditorModule.toString('utf8').includes(marker), `El editor de ejercicios publicado no contiene: ${marker}.`)
}

const patientProfileModuleMatch = publishedMain.toString('utf8').match(/PatientProfilePage-[A-Za-z0-9_-]+\.js/)
requireCheck(patientProfileModuleMatch, 'El paquete publicado no referencia el perfil del paciente.')
const patientProfileModulePath = `/assets/${patientProfileModuleMatch[0]}`
const localPatientProfileModulePath = `${clientPath}${patientProfileModulePath}`
requireCheck(existsSync(localPatientProfileModulePath), `La compilación local no contiene ${patientProfileModulePath}.`)
const localPatientProfileModule = readFileSync(localPatientProfileModulePath)
const publishedPatientProfileModule = await fetchBytes(patientProfileModulePath)
requireCheck(
  digest(localPatientProfileModule) === digest(publishedPatientProfileModule),
  'El perfil del paciente publicado no coincide con la compilación validada.',
)
for (const marker of ['Repetir / programar', 'Serie programada', 'Días consecutivos', 'Datos del paciente', 'Notas privadas', 'Notas recordatorias', 'Ayuda memoria privada y opcional', 'Ver sesión']) {
  requireCheck(publishedPatientProfileModule.toString('utf8').includes(marker), `La repetición de sesiones publicada no contiene: ${marker}.`)
}

const sessionHistoryModuleMatch = publishedMain.toString('utf8').match(/SessionHistoryPage-[A-Za-z0-9_-]+\.js/)
requireCheck(sessionHistoryModuleMatch, 'El paquete publicado no referencia el historial de sesiones.')
const sessionHistoryModulePath = `/assets/${sessionHistoryModuleMatch[0]}`
const localSessionHistoryModulePath = `${clientPath}${sessionHistoryModulePath}`
requireCheck(existsSync(localSessionHistoryModulePath), `La compilación local no contiene ${sessionHistoryModulePath}.`)
const localSessionHistoryModule = readFileSync(localSessionHistoryModulePath)
const publishedSessionHistoryModule = await fetchBytes(sessionHistoryModulePath)
requireCheck(
  digest(localSessionHistoryModule) === digest(publishedSessionHistoryModule),
  'El historial de sesiones publicado no coincide con la compilación validada.',
)
for (const marker of ['Historial clínico de solo lectura', 'Ejercicios de la sesión', 'Resultado general', 'Comentarios', 'Sin detalle individual']) {
  requireCheck(publishedSessionHistoryModule.toString('utf8').includes(marker), `El historial de sesiones publicado no contiene: ${marker}.`)
}

const studyReviewModuleMatch = publishedMain.toString('utf8').match(/StudyReviewPage-[A-Za-z0-9_-]+\.js/)
requireCheck(studyReviewModuleMatch, 'El paquete publicado no referencia la revisión de estudios.')
const studyReviewModulePath = `/assets/${studyReviewModuleMatch[0]}`
const localStudyReviewModulePath = `${clientPath}${studyReviewModulePath}`
requireCheck(existsSync(localStudyReviewModulePath), `La compilación local no contiene ${studyReviewModulePath}.`)
const localStudyReviewModule = readFileSync(localStudyReviewModulePath)
const publishedStudyReviewModule = await fetchBytes(studyReviewModulePath)
requireCheck(
  digest(localStudyReviewModule) === digest(publishedStudyReviewModule),
  'La revisión clínica publicada no coincide con la compilación validada.',
)
for (const marker of ['Conclusión transcripta para confirmar', 'Sugerencia clínica fundamentada para confirmar', 'Conducta original transcripta', 'Fuentes relevantes del catálogo']) {
  requireCheck(publishedStudyReviewModule.toString('utf8').includes(marker), `La revisión clínica publicada no contiene: ${marker}.`)
}

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

console.log(`Publicación verificada: acceso, ciclos, ficha del paciente, historial de sesiones, sugerencias clínicas trazables, paquetes y caché ${packageJson.version}.`)
