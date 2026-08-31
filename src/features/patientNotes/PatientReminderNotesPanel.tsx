import { Archive, Check, ChevronDown, ChevronUp, NotebookPen, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useArchivePatientReminderNote, useCreatePatientReminderNote, usePatientReminderNotes, useUpdatePatientReminderNote } from './hooks'

export function PatientReminderNotesPanel({ patientId }: { patientId: string }) {
  const { data: notes = [], isPending, isError } = usePatientReminderNotes(patientId)
  const create = useCreatePatientReminderNote(patientId)
  const update = useUpdatePatientReminderNote(patientId)
  const archive = useArchivePatientReminderNote(patientId)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingBody, setEditingBody] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const shown = expanded ? notes : notes.slice(0, 3)
  const busy = create.isPending || update.isPending || archive.isPending

  const add = async () => {
    try {
      setError('')
      await create.mutateAsync(draft)
      setDraft('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar la nota.')
    }
  }

  const saveEdit = async () => {
    try {
      setError('')
      await update.mutateAsync({ noteId: editingId, body: editingBody })
      setEditingId('')
      setEditingBody('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible actualizar la nota.')
    }
  }

  const archiveNote = async (noteId: string) => {
    if (!window.confirm('¿Archivar esta nota recordatoria? Dejará de mostrarse en el perfil.')) return
    try {
      setError('')
      await archive.mutateAsync(noteId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible archivar la nota.')
    }
  }

  return <section aria-labelledby="patient-reminder-notes-title" className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-5 sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#E49A02] text-white"><NotebookPen size={19}/></span><div><h2 id="patient-reminder-notes-title" className="font-black text-[#171717]">Notas recordatorias</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#8A5B00]">Ayuda memoria privada y opcional. No se muestra al paciente ni se incorpora a evaluaciones, sesiones o informes.</p></div></div>
      <div className="flex w-full min-w-0 gap-2 lg:max-w-xl"><textarea aria-label="Nueva nota recordatoria" maxLength={1500} rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ej.: en la próxima sesión intentar marcha con giros suaves…" className="min-h-20 min-w-0 flex-1 resize-y rounded-2xl border border-[#E8CE99] bg-white p-3 text-sm"/><button type="button" disabled={busy || !draft.trim()} onClick={() => void add()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-end rounded-2xl bg-[#E49A02] px-4 py-3 text-xs font-black text-white disabled:opacity-40"><Plus size={16}/> Agregar</button></div>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#fceced] px-3 py-2 text-xs font-bold text-[#a94952]">{error}</p>}
    {isPending ? <p className="mt-4 text-xs text-[#8A5B00]">Cargando notas…</p> : isError ? <p role="alert" className="mt-4 text-xs font-bold text-[#a94952]">No fue posible cargar las notas.</p> : notes.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-[#E8CE99] bg-white/60 p-4 text-xs text-[#8A5B00]">No hay notas recordatorias. Podés dejar este espacio vacío.</p> : <div className="mt-5 space-y-3">{shown.map((note) => <article key={note.id} className="rounded-2xl border border-[#E8CE99] bg-white p-4">{editingId === note.id ? <div className="space-y-3"><textarea autoFocus aria-label="Editar nota recordatoria" maxLength={1500} rows={3} value={editingBody} onChange={(event) => setEditingBody(event.target.value)} className="w-full resize-y rounded-xl border border-[#E8CE99] p-3 text-sm"/><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditingId(''); setEditingBody('') }} className="inline-flex items-center gap-1 rounded-xl border border-[#E9E7E7] px-3 py-2 text-xs font-black"><X size={14}/> Cancelar</button><button type="button" disabled={busy || !editingBody.trim()} onClick={() => void saveEdit()} className="inline-flex items-center gap-1 rounded-xl bg-[#28613D] px-3 py-2 text-xs font-black text-white disabled:opacity-40"><Check size={14}/> Guardar</button></div></div> : <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="whitespace-pre-wrap text-sm leading-6 text-[#2F2F2F]">{note.body}</p><p className="mt-2 text-[10px] text-[#8A5B00]">Actualizada {new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(note.updatedAt))}</p></div><div className="flex shrink-0 gap-1"><button type="button" disabled={busy} onClick={() => { setEditingId(note.id); setEditingBody(note.body) }} aria-label="Editar nota" className="rounded-xl border border-[#E9E7E7] p-2 text-[#5E5E5E] disabled:opacity-40"><Pencil size={14}/></button><button type="button" disabled={busy} onClick={() => void archiveNote(note.id)} aria-label="Archivar nota" className="rounded-xl border border-[#E9E7E7] p-2 text-[#5E5E5E] disabled:opacity-40"><Archive size={14}/></button></div></div>}</article>)}</div>}
    {notes.length > 3 && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#8A5B00]">{expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>} {expanded ? 'Mostrar menos' : `Ver todas (${notes.length})`}</button>}
  </section>
}
