import { Check, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { signInPatient, signInProfessional, validatePatientCredentials, validateProfessionalCredentials } from '../lib/auth'
import { isSupabaseConfigured } from '../lib/supabase'

type LoginMode = 'professional' | 'patient'

export function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('professional')
  const [showSecret, setShowSecret] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const selectMode = (nextMode: LoginMode) => {
    setMode(nextMode)
    setIdentifier('')
    setSecret('')
    setError(null)
    setShowSecret(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!isSupabaseConfigured) {
      setError('El servicio de autenticación no está disponible. No se habilitó ningún acceso sin verificar.')
      return
    }

    const validationError = mode === 'professional'
      ? validateProfessionalCredentials(identifier, secret)
      : validatePatientCredentials(identifier, secret)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      if (mode === 'professional') {
        await signInProfessional(identifier, secret)
        navigate('/app')
      } else {
        const result = await signInPatient(identifier, secret)
        navigate(result.mustChangePin ? '/paciente/crear-pin' : '/paciente/hoy')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[0.88fr_1.12fr]">
      <section className="relative hidden overflow-hidden bg-[#171717] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <Brand light />

        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E49A02]">Plataforma clínica vestíbulo-visual</p>
          <h1 className="mt-5 max-w-lg text-[42px] leading-[1.08] tracking-[-0.045em] xl:text-[50px]">
            Claridad clínica en cada decisión.
          </h1>
          <p className="mt-6 max-w-lg text-[15px] leading-7 text-white/60">
            Identificá al paciente, acompañá su sesión y seguí su evolución en un entorno sereno, preciso y trazable.
          </p>
          <div className="mt-9 space-y-4">
            {['Sesiones guiadas y supervisadas', 'Progreso clínico visible', 'Registro profesional protegido'].map((item) => (
              <p key={item} className="flex items-center gap-3 text-sm text-white/75">
                <span className="grid size-6 place-items-center rounded-full bg-white/10 text-[#E49A02]"><Check size={13} /></span>
                {item}
              </p>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3 border-t border-white/10 pt-6 text-xs text-white/45">
          <ShieldCheck size={16} className="text-[#E49A02]" />
          Privacidad, revisión profesional y trazabilidad por diseño.
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#F7F6F4] px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px] rounded-2xl border border-[#E2DED9] bg-white p-6 shadow-[0_18px_50px_rgba(23,23,23,0.055)] sm:p-9">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#A36B00]">ONUr Beta</p>
          <h2 className="mt-2 text-[30px] tracking-[-0.04em] text-[#171717]">Ingresar</h2>
          <p className="mt-2 text-sm leading-6 text-[#747474]">Elegí tu perfil para acceder al entorno clínico.</p>

          <div className="mt-7 grid grid-cols-2 rounded-xl bg-[#F1EFEC] p-1">
            <button type="button" onClick={() => selectMode('professional')} aria-pressed={mode === 'professional'} className={`flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${mode === 'professional' ? 'bg-white text-[#171717] shadow-sm' : 'text-[#747474]'}`}>
              <UserRound size={16} /> Profesional
            </button>
            <button type="button" onClick={() => selectMode('patient')} aria-pressed={mode === 'patient'} className={`flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${mode === 'patient' ? 'bg-white text-[#171717] shadow-sm' : 'text-[#747474]'}`}>
              <UsersRound size={16} /> Paciente
            </button>
          </div>

          <form className="mt-7 space-y-5" onSubmit={submit}>
            <label className="block">
              <span className="text-xs font-semibold text-[#2F2F2F]">{mode === 'professional' ? 'Correo profesional' : 'Usuario'}</span>
              <input
                type={mode === 'professional' ? 'email' : 'text'}
                name="identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder={mode === 'professional' ? 'profesional@ejemplo.com' : 'Nombre de usuario'}
                className="mt-2 h-12 w-full rounded-lg border border-[#D9D6D2] bg-white px-3.5 text-sm text-[#171717] transition placeholder:text-[#A1A1A1] focus:border-[#E49A02]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#2F2F2F]">{mode === 'professional' ? 'Contraseña' : 'PIN o cédula temporal'}</span>
              <span className="relative mt-2 block">
                <input
                  type={showSecret ? 'text' : 'password'}
                  name="secret"
                  value={secret}
                  onChange={(event) => setSecret(mode === 'patient' ? event.target.value.replace(/\D/g, '') : event.target.value)}
                  inputMode={mode === 'patient' ? 'numeric' : undefined}
                  maxLength={mode === 'patient' ? 12 : undefined}
                  autoComplete="current-password"
                  required
                  placeholder={mode === 'patient' ? '4 dígitos o cédula temporal' : 'Ingresá tu contraseña'}
                  className="h-12 w-full rounded-lg border border-[#D9D6D2] bg-white px-3.5 pr-12 text-sm text-[#171717] transition placeholder:text-[#A1A1A1] focus:border-[#E49A02]"
                />
                <button type="button" onClick={() => setShowSecret((visible) => !visible)} className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded-lg text-[#747474] hover:text-[#171717]" aria-label={showSecret ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showSecret ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {mode === 'professional' && <div className="-mt-2 text-right"><Link to="/recuperar-clave" className="text-xs font-semibold text-[#8A5B00]">¿Olvidaste tu contraseña?</Link></div>}
            {error && <p role="alert" className="rounded-lg bg-[#FCECED] px-4 py-3 text-xs font-semibold text-[#A94952]">{error}</p>}

            <button type="submit" disabled={loading || !isSupabaseConfigured} className="h-11 w-full rounded-lg bg-[#E49A02] px-5 text-sm font-semibold text-[#171717] shadow-[0_8px_20px_rgba(228,154,2,0.18)] transition hover:bg-[#D99000] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Ingresando…' : isSupabaseConfigured ? 'Ingresar' : 'Acceso no disponible'}
            </button>
          </form>

          <div className="mt-6 flex gap-2.5 rounded-xl bg-[#F7F6F4] p-3.5 text-[11px] leading-5 text-[#747474]">
            <LockKeyhole size={15} className="mt-0.5 shrink-0 text-[#8A5B00]" />
            <span><strong className="font-semibold text-[#2F2F2F]">Acceso verificado:</strong>{' '}{isSupabaseConfigured ? 'se exige correo o usuario y su clave correspondiente.' : 'falta la conexión de autenticación y el acceso permanece bloqueado.'}</span>
          </div>
        </div>
      </section>
    </main>
  )
}
