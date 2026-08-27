import { CalendarDays, Plus, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { addDaysToDateKey, clinicDateKey, MAX_REPETITION_DATES, repetitionScheduleDates, validateRepetitionDates, type RepetitionScheduleMode } from '../features/sessions/repetition'

interface RepeatSessionDialogProps {
  sessionTitle: string
  isPending?: boolean
  error?: string
  today?: string
  onCancel: () => void
  onConfirm: (input: { dates: string[]; seriesId: string }) => void
}

export function RepeatSessionDialog({ sessionTitle, isPending = false, error, today = clinicDateKey(), onCancel, onConfirm }: RepeatSessionDialogProps) {
  const titleId = useId()
  const [seriesId] = useState(() => crypto.randomUUID())
  const [mode, setMode] = useState<RepetitionScheduleMode>('once')
  const [startDate, setStartDate] = useState(() => addDaysToDateKey(today, 1))
  const [count, setCount] = useState(7)
  const [customDate, setCustomDate] = useState(() => addDaysToDateKey(today, 1))
  const [customDates, setCustomDates] = useState<string[]>([])
  const [localError, setLocalError] = useState('')
  const dates = useMemo(() => repetitionScheduleDates({ mode, startDate, count, customDates }), [count, customDates, mode, startDate])
  const validationError = validateRepetitionDates(dates, today)

  const addCustomDate = () => {
    if (!customDate) return
    if (customDate < today) {
      setLocalError('Las nuevas sesiones deben programarse desde hoy en adelante.')
      return
    }
    if (customDates.includes(customDate)) {
      setLocalError('Esa fecha ya está incluida.')
      return
    }
    if (customDates.length >= MAX_REPETITION_DATES) {
      setLocalError(`Podés programar hasta ${MAX_REPETITION_DATES} sesiones por vez.`)
      return
    }
    setCustomDates((current) => [...current, customDate].sort())
    setCustomDate(addDaysToDateKey(customDate, 1))
    setLocalError('')
  }

  const confirm = () => {
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setLocalError('')
    onConfirm({ dates, seriesId })
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) onCancel() }}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#FFF7E8] text-[#A36B00]"><CalendarDays size={22}/></span><button type="button" aria-label="Cerrar" disabled={isPending} onClick={onCancel} className="grid size-10 place-items-center rounded-xl text-[#747474] hover:bg-[#F7F6F4] disabled:opacity-40"><X size={18}/></button></div>
      <h2 id={titleId} className="mt-5 text-xl font-black text-[#171717]">Repetir o programar sesión</h2>
      <p className="mt-2 text-sm leading-6 text-[#747474]">Se copiarán los ejercicios de <strong className="text-[#2F2F2F]">{sessionTitle}</strong>. Cada fecha comenzará desde cero y no heredará resultados, comentarios ni el estado de la sesión original.</p>

      <div className="mt-6 grid gap-2 rounded-2xl bg-[#F7F6F4] p-1 sm:grid-cols-3" aria-label="Forma de programación">
        {([['once', 'Una vez'], ['consecutive', 'Días consecutivos'], ['custom', 'Fechas específicas']] as const).map(([value, label]) => <button key={value} type="button" disabled={isPending} aria-pressed={mode === value} onClick={() => { setMode(value); setLocalError('') }} className={`min-h-11 rounded-xl px-3 text-xs font-black ${mode === value ? 'bg-white text-[#A36B00] shadow-sm' : 'text-[#747474]'}`}>{label}</button>)}
      </div>

      {mode === 'once' && <label className="mt-6 block text-xs font-black text-[#2F2F2F]">Nueva fecha<input autoFocus type="date" min={today} value={startDate} disabled={isPending} onChange={(event) => { setStartDate(event.target.value); setLocalError('') }} className="mt-2 h-12 w-full rounded-2xl border border-[#DEDCD9] px-4 text-sm font-normal"/></label>}

      {mode === 'consecutive' && <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-black text-[#2F2F2F]">Primera fecha<input type="date" min={today} value={startDate} disabled={isPending} onChange={(event) => { setStartDate(event.target.value); setLocalError('') }} className="mt-2 h-12 w-full rounded-2xl border border-[#DEDCD9] px-4 text-sm font-normal"/></label><label className="text-xs font-black text-[#2F2F2F]">Cantidad de días<input aria-label="Cantidad de días" type="number" min="1" max={MAX_REPETITION_DATES} value={count} disabled={isPending} onChange={(event) => { setCount(Number(event.target.value)); setLocalError('') }} className="mt-2 h-12 w-full rounded-2xl border border-[#DEDCD9] px-4 text-sm font-normal"/></label></div>}

      {mode === 'custom' && <div className="mt-6"><label className="block text-xs font-black text-[#2F2F2F]">Agregar fecha<span className="mt-2 flex gap-2"><input aria-label="Fecha específica" type="date" min={today} value={customDate} disabled={isPending} onChange={(event) => { setCustomDate(event.target.value); setLocalError('') }} className="h-12 min-w-0 flex-1 rounded-2xl border border-[#DEDCD9] px-4 text-sm font-normal"/><button type="button" disabled={isPending || !customDate} onClick={addCustomDate} className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] px-4 text-xs font-black text-[#8A5B00] disabled:opacity-40"><Plus size={16}/> Agregar</button></span></label>{customDates.length > 0 && <div className="mt-4 flex flex-wrap gap-2" aria-label="Fechas elegidas">{customDates.map((date) => <button key={date} type="button" disabled={isPending} onClick={() => setCustomDates((current) => current.filter((item) => item !== date))} className="inline-flex items-center gap-2 rounded-full border border-[#DEDCD9] bg-white px-3 py-2 text-[11px] font-black text-[#5E5E5E]">{formatDate(date)} <X size={13}/><span className="sr-only">Quitar</span></button>)}</div>}</div>}

      {dates.length > 0 && !validationError && <div className="mt-6 rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] p-4"><p className="text-sm font-black text-[#28613D]">Se crearán {dates.length} {dates.length === 1 ? 'sesión nueva' : 'sesiones nuevas'}</p><p className="mt-1 text-xs leading-5 text-[#496451]">{dateSummary(dates)} Cada una estará disponible únicamente durante su fecha para evitar que dos sesiones se superpongan en el portal.</p></div>}
      <p className="mt-4 text-xs leading-5 text-[#747474]">La sesión original conservará su historial y seguirá figurando con su resultado actual.</p>
      {(localError || error) && <p role="alert" className="mt-4 rounded-xl bg-[#fceced] p-3 text-xs font-bold text-[#a94952]">{localError || error}</p>}

      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={isPending} onClick={onCancel} className="h-11 rounded-2xl border border-[#E9E7E7] px-4 text-xs font-black text-[#2F2F2F] disabled:opacity-40">Cancelar</button><button type="button" disabled={Boolean(validationError) || isPending} onClick={confirm} className="h-11 rounded-2xl bg-[#E49A02] px-5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{isPending ? 'Programando…' : `Crear ${dates.length || ''} ${dates.length === 1 ? 'sesión' : 'sesiones'}`}</button></div>
    </section>
  </div>
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-UY', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00.000Z`))
}

function dateSummary(dates: string[]) {
  if (dates.length === 1) return `Fecha: ${formatDate(dates[0])}.`
  return `Desde ${formatDate(dates[0])} hasta ${formatDate(dates.at(-1) ?? dates[0])}.`
}
