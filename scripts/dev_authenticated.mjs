import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { spawnSync } from 'node:child_process'

if ((!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) && existsSync('.env.staging.local')) {
  loadEnvFile('.env.staging.local')
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('La vista local autenticada exige SUPABASE_URL y SUPABASE_ANON_KEY.')
}

try {
  const parsedUrl = new URL(supabaseUrl)
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) throw new Error()
} catch {
  throw new Error('SUPABASE_URL no es una URL HTTPS válida de Supabase.')
}

if (supabaseAnonKey.length < 40) throw new Error('SUPABASE_ANON_KEY no es válida.')

const command = process.env.npm_execpath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
const forwardedArguments = process.argv.slice(2)
const commandArguments = process.env.npm_execpath
  ? [process.env.npm_execpath, 'run', 'dev:vite', '--', ...forwardedArguments]
  : ['run', 'dev:vite', '--', ...forwardedArguments]
const developmentEnvironment = {
  ...process.env,
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
}

for (const privateKey of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_PASSWORD', 'PATIENT_AUTH_PEPPER', 'PROFESSIONAL_PASSWORD']) {
  delete developmentEnvironment[privateKey]
}

const result = spawnSync(command, commandArguments, {
  stdio: 'inherit',
  env: developmentEnvironment,
})

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
