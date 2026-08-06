import { Camera, ClipboardPaste, FileImage, Plus, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { validateClinicalFile } from './localOcr'

interface Props {
  files: File[]
  previewUrl: string
  pageCount: number
  disabled?: boolean
  onFiles: (files: File[]) => void
  onError: (message: string) => void
}

function uniqueFiles(current: File[], candidates: File[]) {
  const keys = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`))
  return [...current, ...candidates.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })]
}

export function ClinicalFileDropzone({ files, previewUrl, pageCount, disabled, onFiles, onError }: Props) {
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const accept = (candidates: File[], replace = false) => {
    if (!candidates.length) return
    try {
      candidates.forEach(validateClinicalFile)
      onFiles(replace ? candidates : uniqueFiles(files, candidates))
      onError('')
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Archivo no válido.')
    }
  }
  useEffect(() => {
    const paste = (event: globalThis.ClipboardEvent) => {
      if (disabled) return
      const candidates = Array.from(event.clipboardData?.files ?? []).filter((item) => item.type.startsWith('image/') || item.type === 'application/pdf')
      if (candidates.length) { event.preventDefault(); accept(candidates) }
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  })
  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); accept(Array.from(event.dataTransfer.files)) }
  const pasteHere = (event: ClipboardEvent) => accept(Array.from(event.clipboardData.files).filter((item) => item.type.startsWith('image/') || item.type === 'application/pdf'))
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  return <section onPaste={pasteHere} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop} className={`rounded-2xl border-2 border-dashed p-5 transition ${dragging ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E8CE99] bg-[#F7F6F4]'}`}>
    {files.length ? <div className="grid gap-4 sm:grid-cols-[120px_1fr] sm:items-start">
      <div className="grid h-28 place-items-center overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white">{previewUrl ? <img src={previewUrl} alt="Vista previa local" className="h-full w-full object-contain"/> : <FileImage className="text-[#E49A02]"/>}</div>
      <div className="min-w-0"><p className="text-sm font-black text-[#2F2F2F]">{files.length} archivo{files.length === 1 ? '' : 's'} seleccionado{files.length === 1 ? '' : 's'}</p><p className="mt-1 text-xs text-[#747474]">{(totalBytes / 1024 / 1024).toFixed(2)} MB de origen · {pageCount || files.length} página{pageCount === 1 ? '' : 's'} preparadas</p>
        <ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2"><FileImage size={14} className="shrink-0 text-[#E49A02]"/><span className="min-w-0 flex-1 truncate text-xs font-bold text-[#2F2F2F]">{index + 1}. {file.name}</span><button type="button" disabled={disabled} onClick={() => onFiles(files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Quitar ${file.name}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#a94952]"><Trash2 size={14}/></button></li>)}</ul>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={disabled} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] bg-white px-3 py-2 text-xs font-black text-[#2F2F2F]"><Plus size={14}/> Agregar páginas o archivos</button><button type="button" disabled={disabled} onClick={() => onFiles([])} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] bg-white px-3 py-2 text-xs font-black text-[#747474]"><RefreshCw size={14}/> Empezar de nuevo</button></div>
      </div>
    </div> : <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="grid min-h-40 w-full place-items-center text-center"><span><UploadCloud className="mx-auto text-[#E49A02]" size={30}/><strong className="mt-3 block text-sm text-[#2F2F2F]">Subí todas las páginas del estudio juntas</strong><span className="mt-2 block text-xs leading-5 text-[#747474]">Podés mezclar varios PDF, JPG, JPEG, PNG o WEBP. ONUr los reúne en un único informe privado.</span><span className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ClipboardPaste size={14}/> También podés arrastrar o pegar con Ctrl+V</span></span></button>}
    <input ref={input} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(event) => { accept(Array.from(event.target.files ?? [])); event.target.value = '' }}/>
    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white"><Camera size={14}/> Tomar fotografía<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { accept(Array.from(event.target.files ?? [])); event.target.value = '' }}/></label>
  </section>
}
