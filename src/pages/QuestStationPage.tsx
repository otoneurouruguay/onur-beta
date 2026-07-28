import { CheckCircle2, ChevronRight, Glasses, KeyRound, Monitor, RotateCcw, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { SessionRunner } from '../features/sessions/SessionRunner'
import { claimQuestSessionPairing, submitQuestSessionCapture, type ClaimedQuestSession } from '../features/sessions/questRepository'

const CLAIM_STORAGE_KEY = 'onur-quest-active-claim-v1'

function readStoredClaim(): ClaimedQuestSession | null {
  const raw = sessionStorage.getItem(CLAIM_STORAGE_KEY)
  if (!raw) return null
  try {
    const claim = JSON.parse(raw) as ClaimedQuestSession
    if (!claim.pairingId || !claim.deviceToken || !claim.session?.exercises?.length || claim.expiresAt <= new Date().toISOString()) return null
    return claim
  } catch { return null }
}

export function QuestStationPage() {
  const [claim, setClaim] = useState<ClaimedQuestSession | null>(() => readStoredClaim())
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'code' | 'ready' | 'running' | 'sending' | 'send_failed' | 'complete'>(() => claim ? 'ready' : 'code')
  const [pendingResult, setPendingResult] = useState<Parameters<typeof submitQuestSessionCapture>[1] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadSession = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setLoading(true)
      setError('')
      const next = await claimQuestSessionPairing(code)
      sessionStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(next))
      setClaim(next)
      setStage('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar la sesión Quest.')
    } finally { setLoading(false) }
  }

  const sendResult = async (result: Parameters<typeof submitQuestSessionCapture>[1]) => {
    if (!claim) return
    try {
      setStage('sending')
      setError('')
      await submitQuestSessionCapture(claim, result)
      sessionStorage.removeItem(CLAIM_STORAGE_KEY)
      setPendingResult(null)
      setStage('complete')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La ejecución terminó, pero no pudo enviarse al profesional.')
      setStage('send_failed')
    }
  }

  const finish = (activeSeconds: number, skippedExercises: number, eventLog: Parameters<typeof submitQuestSessionCapture>[1]['eventLog']) => {
    const result = { activeSeconds, skippedExercises, eventLog }
    setPendingResult(result)
    void sendResult(result)
  }

  const immersiveQuest = Boolean(claim?.session.exercises.length && claim.session.exercises.every((exercise) => exercise.purpose === 'immersive_context'))
  const stopCriteria = Array.from(new Set(claim?.session.exercises.map((exercise) => exercise.stopCriteria?.trim()).filter(Boolean) ?? [])) as string[]

  if (stage === 'running' && claim) {
    return <SessionRunner session={claim.session} onExit={() => setStage('ready')} onFinish={finish}/>
  }

  return <main className="min-h-screen bg-[#F7F6F4] px-5 py-8 text-[#171717] sm:px-8">
    <div className="mx-auto max-w-2xl">
      <header className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#171717] text-[#EFB33A]"><Glasses size={22}/></span><div><p className="text-sm font-black">ONUr · Estación Quest</p><p className="text-xs text-[#747474]">Uso clínico con supervisión profesional directa</p></div></header>

      {error && <p role="alert" className="mt-6 rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{error}</p>}

      {stage === 'complete' ? <section className="mt-8 rounded-3xl border border-[#E8CE99] bg-white p-8 text-center shadow-[0_22px_60px_rgba(18,50,56,0.08)]">
        <CheckCircle2 className="mx-auto text-[#E49A02]" size={58}/>
        <h1 className="mt-5 text-2xl font-black">Ejecución enviada</h1>
        <p className="mt-3 text-sm leading-6 text-[#747474]">El profesional ya puede revisar los resultados, completar la observación clínica y finalizar la sesión en el perfil del paciente.</p>
        <button type="button" onClick={() => { setClaim(null); setCode(''); setStage('code') }} className="mt-7 inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] px-5 py-3 text-sm font-black"><RotateCcw size={17}/> Cargar otra sesión</button>
      </section> : stage === 'sending' ? <section className="mt-8 rounded-3xl border border-[#E9E7E7] bg-white p-8 text-center"><p role="status" className="text-lg font-black">Enviando la ejecución al profesional…</p><p className="mt-3 text-sm text-[#747474]">No cierres el navegador ni retires la conexión.</p></section> : stage === 'send_failed' && pendingResult ? <section className="mt-8 rounded-3xl border border-[#eccfd2] bg-white p-8 text-center"><h1 className="text-xl font-black">La ejecución quedó guardada en esta pantalla</h1><p className="mt-3 text-sm leading-6 text-[#747474]">No repitas los ejercicios. Restablecé la conexión y reenviá el mismo resultado.</p><button type="button" onClick={() => void sendResult(pendingResult)} className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-[#171717] px-5 text-sm font-black text-white"><RotateCcw size={17}/> Reintentar envío</button></section> : claim ? <section className="mt-8 overflow-hidden rounded-3xl border border-[#E9E7E7] bg-white shadow-[0_22px_60px_rgba(18,50,56,0.08)]">
        <div className="bg-[#171717] p-7 text-white"><p className="text-[11px] font-black uppercase tracking-[.16em] text-[#EFB33A]">Sesión preparada</p><h1 className="mt-3 text-2xl font-black">{claim.session.title}</h1><p className="mt-2 text-sm text-white/65">Paciente: {claim.patientLabel} · {claim.session.exercises.length} ejercicios</p></div>
        <div className="space-y-4 p-6 sm:p-8">
          <div className="flex gap-3 rounded-2xl bg-[#FFF7E8] p-4 text-[#8A5B00]"><Monitor className="mt-0.5 shrink-0" size={19}/><p className="text-xs font-bold leading-5"><strong>Modo de ejecución:</strong> {immersiveQuest ? 'cada escenario 360° abrirá WebXR inmersivo. Entre escenarios saldrás de la inmersión y confirmarás nuevamente el ingreso.' : 'estos ejercicios visuales se muestran en una ventana 2D del navegador de Quest; no usan anclaje espacial.'}</p></div>
          <div className="flex gap-3 rounded-2xl bg-[#F0F8F3] p-4 text-[#28613D]"><ShieldCheck className="mt-0.5 shrink-0" size={19}/><p className="text-xs font-bold leading-5">Confirmá identidad, postura sentada, superficie firme y criterios de detención antes de colocar el visor.</p></div>
          {stopCriteria.length > 0 && <div className="rounded-2xl bg-[#fceced] p-4 text-[#a94952]"><p className="text-xs font-black">Criterios de detención o pausa</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-bold leading-5">{stopCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul></div>}
          <div className="rounded-2xl bg-[#F7F6F4] p-4"><p className="text-xs font-black">Indicación profesional</p><p className="mt-2 text-sm leading-6 text-[#747474]">{claim.session.instructions || 'Seguir las indicaciones del profesional presente.'}</p></div>
          <button type="button" onClick={() => setStage('running')} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] text-sm font-black text-white">Comenzar ejecución <ChevronRight size={18}/></button>
          <p className="text-center text-[11px] leading-5 text-[#747474]">Si salís antes de terminar, podrás reiniciar esta misma ejecución mientras el vínculo siga vigente.</p>
        </div>
      </section> : <section className="mt-8 rounded-3xl border border-[#E9E7E7] bg-white p-6 shadow-[0_22px_60px_rgba(18,50,56,0.08)] sm:p-8">
        <KeyRound className="text-[#E49A02]" size={30}/><h1 className="mt-5 text-2xl font-black">Cargar sesión clínica</h1><p className="mt-3 text-sm leading-6 text-[#747474]">El profesional debe preparar previamente una sesión presencial Quest desde el perfil del paciente. No ingreses credenciales del paciente en este visor.</p>
        <form onSubmit={loadSession} className="mt-7"><label className="text-xs font-black text-[#2F2F2F]">Código temporal<input autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={8} className="mt-3 h-16 w-full rounded-2xl border border-[#E9E7E7] bg-[#F7F6F4] px-4 text-center font-mono text-2xl font-black uppercase tracking-[.28em]" value={code} onChange={(event) => setCode(event.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase())} placeholder="00000000"/></label><button type="submit" disabled={loading || code.length !== 8} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#171717] text-sm font-black text-white disabled:opacity-40">{loading ? 'Verificando…' : 'Cargar sesión'} <ChevronRight size={18}/></button></form>
      </section>}
    </div>
  </main>
}
