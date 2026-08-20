import { CalendarX2, X } from 'lucide-react'
import { useId, useState } from 'react'

export function CancelSessionDialog({ sessionTitle, isPending = false, error, onClose, onConfirm }: { sessionTitle: string; isPending?: boolean; error?: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const titleId = useId()
  const [reason, setReason] = useState('')
  const cleanReason = reason.trim()
  return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/55 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-[#FFF7E8] text-[#A36B00]"><CalendarX2 size={22}/></span><button type="button" aria-label="Cerrar" disabled={isPending} onClick={onClose} className="grid size-10 place-items-center rounded-xl text-[#747474]"><X size={18}/></button></div>
      <h2 id={titleId} className="mt-5 text-xl font-black">Registrar sesión no realizada</h2>
      <p className="mt-2 text-sm leading-6 text-[#747474]"><strong>{sessionTitle}</strong> quedará como cancelada/no realizada. No es una anulación por error y se conservará en el informe.</p>
      <label className="mt-5 block text-xs font-black">Motivo obligatorio<textarea autoFocus rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: paciente no concurrió, indisposición o cambio clínico del día." className="mt-2 w-full rounded-2xl border border-[#DEDCD9] p-3 text-sm font-normal leading-6"/></label>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#fceced] p-3 text-xs font-bold text-[#a94952]">{error}</p>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isPending} onClick={onClose} className="h-11 rounded-2xl border border-[#E9E7E7] px-4 text-xs font-black">Volver</button><button type="button" disabled={cleanReason.length < 3 || isPending} onClick={() => onConfirm(cleanReason)} className="h-11 rounded-2xl bg-[#A36B00] px-4 text-xs font-black text-white disabled:opacity-40">{isPending ? 'Guardando…' : 'Registrar cancelación'}</button></div>
    </section>
  </div>
}
