import { CalendarCheck, Info } from 'lucide-react'
import type { ExerciseConfig } from '../exercise/types'
import type { RetrospectiveSessionValues } from './schema'

const input = 'mt-2 min-h-11 w-full min-w-0 rounded-2xl border border-[#E2E0DD] bg-white px-3 py-2 text-sm'

function optionalNumber(value: string) {
  return value === '' ? null : Number(value)
}

export function RetrospectiveCompletionFields({ exercises, value, onChange, error }: { exercises: ExerciseConfig[]; value: RetrospectiveSessionValues; onChange: (value: RetrospectiveSessionValues) => void; error?: string }) {
  const update = <K extends keyof RetrospectiveSessionValues>(key: K, next: RetrospectiveSessionValues[K]) => onChange({ ...value, [key]: next })
  const togglePerformed = (index: number, checked: boolean) => update('performedExerciseIndexes', checked ? [...new Set([...value.performedExerciseIndexes, index])].sort((a, b) => a - b) : value.performedExerciseIndexes.filter((item) => item !== index))

  return <section className="rounded-2xl border border-[#B9D9C5] bg-[#F8FCF9] p-5 sm:p-6">
    <div className="flex items-start gap-3"><CalendarCheck className="mt-0.5 shrink-0 text-[#28613D]" size={21}/><div><h2 className="text-sm font-black text-[#173A26]">Registro retrospectivo</h2><p className="mt-1 text-xs leading-5 text-[#47705A]">Documentá únicamente lo que realmente quedó registrado. La fecha de carga y el profesional se guardan en auditoría.</p></div></div>
    <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="min-w-0 text-xs font-black">Fecha y hora reales<input type="datetime-local" className={input} value={value.performedAt} onChange={(event) => update('performedAt', event.target.value)}/></label>
      <label className="min-w-0 text-xs font-black">Dispositivo<select className={input} value={value.device} onChange={(event) => update('device', event.target.value as RetrospectiveSessionValues['device'])}><option value="standard">Pantalla 2D / PC</option><option value="vr_box">VR Box sin Cardboard</option><option value="cardboard">VR Box con Cardboard</option><option value="quest">Meta Quest</option><option value="external">Tarea externa</option><option value="mixed">Mixto</option></select></label>
      <label className="flex min-h-20 items-start gap-3 rounded-2xl border border-[#D9E7DF] bg-white p-4 text-xs font-black md:col-span-2"><input type="checkbox" className="mt-0.5 size-4" checked={value.withoutMetrics} onChange={(event) => update('withoutMetrics', event.target.checked)}/><span>Sin métricas retrospectivas<span className="mt-1 block font-normal leading-5 text-[#747474]">Conserva fecha, ejercicios, omisiones y observación; no inventa duración ni síntomas.</span></span></label>
    </div>

    {exercises.length > 0 && <div className="mt-5"><h3 className="text-xs font-black text-[#173A26]">Qué se realizó</h3><div className="mt-3 space-y-3">{exercises.map((exercise, index) => {
      const performed = value.performedExerciseIndexes.includes(index)
      return <div key={`${exercise.name}-${index}`} className="rounded-2xl border border-[#D9E7DF] bg-white p-4"><label className="flex items-start gap-3 text-xs font-black"><input type="checkbox" className="mt-0.5 size-4" checked={performed} onChange={(event) => togglePerformed(index, event.target.checked)}/><span><span className="block">{index + 1}. {exercise.name}</span><span className="mt-1 block font-normal text-[#747474]">{performed ? 'Realizado' : 'Omitido: requiere motivo'}</span></span></label>{!performed && <input className={input} value={value.omittedExerciseReasons[String(index)] ?? ''} onChange={(event) => update('omittedExerciseReasons', { ...value.omittedExerciseReasons, [String(index)]: event.target.value })} placeholder="Motivo de omisión"/>}</div>
    })}</div></div>}

    {!value.withoutMetrics && <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <label className="min-w-0 text-xs font-black">Duración aproximada (min)<input type="number" min="1" max="600" className={input} value={value.durationMinutes || ''} onChange={(event) => update('durationMinutes', Number(event.target.value))}/></label>
      <label className="min-w-0 text-xs font-black">Síntoma inicial 0–10<input type="number" min="0" max="10" className={input} value={value.initialDiscomfort ?? ''} onChange={(event) => update('initialDiscomfort', optionalNumber(event.target.value))}/></label>
      <label className="min-w-0 text-xs font-black">Máximo durante 0–10<input type="number" min="0" max="10" className={input} value={value.peakDiscomfort ?? ''} onChange={(event) => update('peakDiscomfort', optionalNumber(event.target.value))}/></label>
      <label className="min-w-0 text-xs font-black">Síntoma final 0–10<input type="number" min="0" max="10" className={input} value={value.finalDiscomfort ?? ''} onChange={(event) => update('finalDiscomfort', optionalNumber(event.target.value))}/></label>
      <label className="min-w-0 text-xs font-black">Recuperación (min)<input type="number" min="0" max="1440" className={input} value={value.recoveryMinutes ?? ''} onChange={(event) => update('recoveryMinutes', optionalNumber(event.target.value))}/></label>
    </div>}

    <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
      <label className="min-w-0 text-xs font-black">Observación profesional<textarea className={`${input} min-h-24 resize-y leading-5`} value={value.professionalObservation} onChange={(event) => update('professionalObservation', event.target.value)} placeholder="Qué se hizo, calidad, asistencia y respuesta observada"/></label>
      <label className="min-w-0 text-xs font-black">Comentario del paciente (si fue registrado)<textarea className={`${input} min-h-24 resize-y leading-5`} value={value.patientComment} onChange={(event) => update('patientComment', event.target.value)}/></label>
      {!value.withoutMetrics && <><label className="min-w-0 text-xs font-black">Respuesta tardía<textarea className={`${input} min-h-20 resize-y leading-5`} value={value.delayedResponse} onChange={(event) => update('delayedResponse', event.target.value)} placeholder="Ej.: volvió a basal; aumento tardío…"/></label><label className="min-w-0 text-xs font-black">Decisión de progresión<textarea className={`${input} min-h-20 resize-y leading-5`} value={value.progressionDecision} onChange={(event) => update('progressionDecision', event.target.value)} placeholder="Mantener, progresar una variable o regresar…"/></label></>}
    </div>
    <div className="mt-4 flex gap-2 rounded-xl bg-white p-3 text-[11px] leading-5 text-[#5E5E5E]"><Info size={15} className="mt-0.5 shrink-0"/>La etiqueta “Registrada retrospectivamente” quedará visible en el historial.</div>
    {error && <p role="alert" className="mt-4 text-xs font-bold text-[#a94952]">{error}</p>}
  </section>
}
