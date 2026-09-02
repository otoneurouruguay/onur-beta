import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

interface DeleteDocumentDialogProps {
  documentLabel: string
  filename: string
  removesStudyData: boolean
  isPending: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteDocumentDialog({
  documentLabel,
  filename,
  removesStudyData,
  isPending,
  error,
  onCancel,
  onConfirm,
}: DeleteDocumentDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    cancelButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPending, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#171717]/55 px-4 py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onCancel()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-lg rounded-2xl border border-[#E9E7E7] bg-white p-6 shadow-[0_28px_80px_rgba(23,23,23,0.24)] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#FCECED] text-[#A94952]" aria-hidden="true">
            <AlertTriangle size={21} />
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="grid size-11 place-items-center rounded-lg text-[#747474] transition hover:bg-[#F7F6F4] hover:text-[#171717] disabled:opacity-50"
            aria-label="Cerrar confirmación"
          >
            <X size={19} />
          </button>
        </div>

        <h2 id={titleId} className="mt-5 font-['Poppins'] text-2xl font-semibold text-[#171717]">Eliminar {documentLabel.toLocaleLowerCase('es-UY')}</h2>
        <p id={descriptionId} className="mt-3 text-sm leading-6 text-[#747474]">
          Se eliminará permanentemente <strong className="text-[#171717]">{filename}</strong>.
          {removesStudyData && ' También se borrarán los valores y la revisión del estudio vinculados a este archivo.'}
          {' '}Esta acción no se puede deshacer.
        </p>

        {error && <p role="alert" className="mt-4 rounded-xl bg-[#FCECED] p-3 text-sm font-bold text-[#A94952]">{error}</p>}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="h-11 rounded-lg border border-[#D8D5D2] px-5 text-sm font-bold text-[#2F2F2F] transition hover:bg-[#F7F6F4] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#A94952] px-5 text-sm font-bold text-white transition hover:bg-[#8F3942] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 size={17} /> {isPending ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </div>
      </section>
    </div>
  )
}
