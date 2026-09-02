import { X } from 'lucide-react'
import { useState } from 'react'
import { RetrospectiveCompletionFields } from '../features/sessions/RetrospectiveCompletionFields'
import type { SessionAssignmentRecord } from '../features/sessions/repository'
import { createRetrospectiveSessionValues, type RetrospectiveSessionValues } from '../features/sessions/schema'

export function RetrospectiveSessionDialog({ assignment, isPending, error, onCancel, onConfirm }: { assignment: SessionAssignmentRecord; isPending: boolean; error?: string; onCancel: () => void; onConfirm: (details: RetrospectiveSessionValues) => void }) {
  const [details, setDetails] = useState(() => createRetrospectiveSessionValues(assignment.exercises, assignment.availableFrom.slice(0, 10)))
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3" role="dialog" aria-modal="true" aria-labelledby="retrospective-title">
    <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-[#F7F6F4] p-5 shadow-2xl sm:p-7">
      <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#E49A02]">Historial clínico</p><h2 id="retrospective-title" className="mt-1 text-xl font-black">Marcar “{assignment.title}” como finalizada</h2><p className="mt-2 text-xs leading-5 text-[#747474]">La sesión quedará protegida como un hecho clínico pasado y no como una planificación pendiente.</p></div><button type="button" aria-label="Cerrar" disabled={isPending} onClick={onCancel} className="rounded-xl border border-[#E9E7E7] bg-white p-2"><X size={17}/></button></div>
      <RetrospectiveCompletionFields exercises={assignment.exercises} value={details} onChange={setDetails} error={error}/>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" disabled={isPending} onClick={onCancel} className="rounded-2xl border border-[#E9E7E7] bg-white px-5 py-3 text-sm font-black">Cancelar</button><button type="button" disabled={isPending} onClick={() => onConfirm(details)} className="rounded-2xl bg-[#28613D] px-5 py-3 text-sm font-black text-white">{isPending ? 'Guardando…' : 'Confirmar finalización'}</button></div>
    </div>
  </div>
}
