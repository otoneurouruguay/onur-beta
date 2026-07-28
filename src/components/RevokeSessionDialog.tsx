import { ShieldAlert, X } from 'lucide-react'
import { useId, useState } from 'react'

interface RevokeSessionDialogProps {
  sessionTitle: string
  isPending?: boolean
  error?: string
  onCancel: () => void
  onConfirm: (reason: string) => void
}

const commonReasons = [
  'Error en la selección de un ejercicio',
  'Era una sesión de prueba',
  'La sesión estaba duplicada',
  'Cambio del plan clínico',
] as const

export function RevokeSessionDialog({ sessionTitle, isPending = false, error, onCancel, onConfirm }: RevokeSessionDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const [reason, setReason] = useState('')
  const cleanReason = reason.trim()
  const valid = cleanReason.length >= 8 && cleanReason.length <= 500

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) onCancel() }}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#F1EFEC] text-[#696969]"><ShieldAlert size={22}/></span>
        <button type="button" aria-label="Cerrar" disabled={isPending} onClick={onCancel} className="grid size-10 place-items-center rounded-xl text-[#747474] hover:bg-[#F7F6F4] disabled:opacity-40"><X size={18}/></button>
      </div>
      <h2 id={titleId} className="mt-5 text-xl font-black text-[#171717]">Anular sesión</h2>
      <p id={descriptionId} className="mt-2 text-sm leading-6 text-[#747474]"><strong className="text-[#2F2F2F]">{sessionTitle}</strong> quedará visible en gris. No podrá ejecutarse y su motivo aparecerá en el informe final.</p>
      <div className="mt-5 flex flex-wrap gap-2">{commonReasons.map((item) => <button key={item} type="button" disabled={isPending} onClick={() => setReason(item)} className="rounded-full border border-[#DEDCD9] bg-[#F7F6F4] px-3 py-2 text-[10px] font-black text-[#5E5E5E] disabled:opacity-40">{item}</button>)}</div>
      <label className="mt-5 block text-xs font-black text-[#2F2F2F]">Motivo obligatorio<textarea autoFocus rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: error en la selección de un ejercicio o sesión utilizada para una prueba técnica." className="mt-2 w-full rounded-2xl border border-[#DEDCD9] p-3 text-sm font-normal leading-6 outline-none focus:border-[#E49A02]"/></label>
      <div className="mt-2 flex justify-between text-[10px] text-[#747474]"><span>{cleanReason.length > 0 && cleanReason.length < 8 ? 'Escribí al menos 8 caracteres.' : 'El registro se conserva para trazabilidad.'}</span><span>{reason.length}/500</span></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#fceced] p-3 text-xs font-bold text-[#a94952]">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" disabled={isPending} onClick={onCancel} className="h-11 rounded-2xl border border-[#E9E7E7] px-4 text-xs font-black text-[#2F2F2F] disabled:opacity-40">Cancelar</button>
        <button type="button" disabled={!valid || isPending} onClick={() => onConfirm(cleanReason)} className="h-11 rounded-2xl bg-[#696969] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{isPending ? 'Anulando…' : 'Anular y conservar registro'}</button>
      </div>
    </section>
  </div>
}
