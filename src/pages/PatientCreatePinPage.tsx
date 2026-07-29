import { CheckCircle2, KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { useAuth } from '../features/auth/AuthProvider'
import { changePatientPin } from '../lib/auth'
import { isSupabaseConfigured } from '../lib/supabase'

export function PatientCreatePinPage() {
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const auth = useAuth()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe tener exactamente 4 dígitos.')
      return
    }
    if (pin !== confirmation) {
      setError('Los PIN no coinciden.')
      return
    }

    setLoading(true)
    try {
      if (isSupabaseConfigured) {
        await changePatientPin(pin)
        await auth.refreshPatientAccess()
      }
      navigate('/paciente/hoy')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F6F4] px-5 py-10">
      <div className="w-full max-w-md">
        <Brand />
        <section className="mt-10 rounded-2xl border border-[#E9E7E7] bg-white p-6 shadow-[0_20px_48px_rgba(18,50,56,0.08)] sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#FFF7E8] text-[#E49A02]"><KeyRound size={22} /></span>
          <h1 className="mt-6 text-3xl font-black tracking-[-0.035em] text-[#171717]">Creá tu PIN</h1>
          <p className="mt-3 text-sm leading-6 text-[#747474]">Este PIN de 4 dígitos reemplaza la contraseña temporal de tu primer acceso.</p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-black text-[#2F2F2F]">Nuevo PIN</span>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                autoComplete="new-password"
                className="mt-2 h-14 w-full rounded-2xl border border-[#E9E7E7] px-4 text-center text-xl font-black tracking-[0.5em]"
                aria-label="Nuevo PIN"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-[#2F2F2F]">Confirmar PIN</span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                autoComplete="new-password"
                className="mt-2 h-14 w-full rounded-2xl border border-[#E9E7E7] px-4 text-center text-xl font-black tracking-[0.5em]"
                aria-label="Confirmar PIN"
              />
            </label>
            {error && <p role="alert" className="rounded-2xl bg-[#fceced] px-4 py-3 text-xs font-bold text-[#a94952]">{error}</p>}
            <button type="submit" disabled={loading} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] text-sm font-black text-white">
              <CheckCircle2 size={18} /> {loading ? 'Guardando…' : 'Guardar PIN'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] leading-5 text-[#747474]">La cuenta permanecerá activa hasta que el profesional la desactive manualmente.</p>
        </section>
      </div>
    </main>
  )
}
