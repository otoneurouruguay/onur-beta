import { Activity, BookOpen, Check, ChevronDown, Plus, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { clinicalSources } from '../clinicalGeneration/catalog'
import type { ExerciseTemplateRecord } from '../templates/repository'
import { pathologyRecommendations, type PathologyRecommendation } from './catalog'

interface PathologyRecommendationsProps {
  templates: ExerciseTemplateRecord[]
  onLoadTemplate: (template: ExerciseTemplateRecord, pathology: PathologyRecommendation) => void
  selectedTemplateIds?: readonly string[]
}

const evidenceLabels: Record<PathologyRecommendation['evidence'], string> = {
  direct: 'Evidencia directa',
  mixed: 'Evidencia mixta',
  indirect: 'Evidencia indirecta',
  governance: 'Guía diagnóstica y de manejo',
}

export function PathologyRecommendations({ templates, onLoadTemplate, selectedTemplateIds = [] }: PathologyRecommendationsProps) {
  const [selectedId, setSelectedId] = useState('')
  const selected = pathologyRecommendations.find((pathology) => pathology.id === selectedId)
  const sources = selected
    ? clinicalSources.filter((source) => selected.sourceIds.includes(source.id))
    : []

  return <details className="group overflow-hidden rounded-2xl border border-[#D9E7DF] bg-white">
    <summary className="flex cursor-pointer list-none items-start gap-3 bg-[#F0F8F3] p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#28613D] text-white"><Activity size={19}/></span>
      <div className="min-w-0 flex-1"><h2 className="text-base font-black text-[#173A26]">Orientación por patología</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[#47705A]">Abrí esta guía cuando quieras partir de un diagnóstico confirmado. Es opcional y no reemplaza la selección profesional.</p>{selected && <p className="mt-2 text-[10px] font-black text-[#28613D]">Seleccionada: {selected.label}</p>}</div>
      <ChevronDown aria-hidden="true" className="mt-2 shrink-0 text-[#28613D] transition-transform group-open:rotate-180" size={18}/>
    </summary>
    <div className="border-t border-[#D9E7DF] bg-[#F0F8F3] p-5 sm:p-6">
      <label className="mt-5 block text-xs font-black text-[#173A26]">Patología o condición clínica<select aria-label="Patología o condición clínica" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#B9D9C5] bg-white px-4 text-sm text-[#173A26]"><option value="">Seleccionar…</option>{pathologyRecommendations.map((pathology) => <option key={pathology.id} value={pathology.id}>{pathology.label}</option>)}</select></label>
    </div>

    {selected ? <div className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#28613D] px-3 py-1.5 text-[10px] font-black text-white">{evidenceLabels[selected.evidence]}</span><span className="text-[10px] font-bold text-[#747474]">{selected.sourceIds.length} fuentes aplicables</span></div>
      <div><h3 className="text-lg font-black text-[#171717]">{selected.label}</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-[#5E5E5E]">{selected.clinicalFrame}</p><p className="mt-2 text-[11px] font-bold leading-5 text-[#47705A]">{selected.evidenceNote}</p></div>

      <div className="grid gap-3 lg:grid-cols-2">{selected.options.map((option) => {
        const optionTemplates = option.templateIds.map((id) => templates.find((template) => template.id === id)).filter((template): template is ExerciseTemplateRecord => Boolean(template))
        return <article key={option.title} className="rounded-2xl border border-[#E9E7E7] p-4">
          <h4 className="text-sm font-black text-[#2F2F2F]">{option.title}</h4>
          <p className="mt-2 text-xs leading-5 text-[#747474]">{option.summary}</p>
          {optionTemplates.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{optionTemplates.map((template) => {
            const added = selectedTemplateIds.includes(template.id)
            return <button key={template.id} type="button" aria-pressed={added} onClick={() => onLoadTemplate(template, selected)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left text-[10px] font-black ${added ? 'border-[#9FC9AE] bg-[#F0F8F3] text-[#28613D]' : 'border-[#E8CE99] bg-[#FFF7E8] text-[#8A5B00]'}`}>{added ? <Check size={13}/> : <Plus size={13}/>} {added ? 'Agregado · ' : ''}{template.name}</button>
          })}</div>}
        </article>
      })}</div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
        <div className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-4 text-[#7A5100]"><div className="flex items-center gap-2 text-xs font-black"><ShieldAlert size={16}/> Precauciones para decidir</div><ul className="mt-3 space-y-2 text-[11px] leading-5">{selected.cautions.map((caution) => <li key={caution}>• {caution}</li>)}</ul></div>
        <div className="rounded-2xl bg-[#F7F6F4] p-4"><div className="flex items-center gap-2 text-xs font-black text-[#2F2F2F]"><BookOpen size={16}/> Bibliografía aplicable</div><div className="mt-3 flex flex-wrap gap-2">{sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" title={`${source.title}${source.limitations ? ` · ${source.limitations}` : ''}`} className={`rounded-full border bg-white px-3 py-2 text-[10px] font-black ${source.evidenceRole === 'secondary_teaching' ? 'border-[#E8CE99] text-[#8A5B00]' : 'border-[#DEDCD9] text-[#5E5E5E]'}`}>{source.id} · {source.year || 's/f'}{source.evidenceRole === 'secondary_teaching' ? ' · docente' : ''}</a>)}</div></div>
      </div>
    </div> : <div className="p-5 text-xs leading-5 text-[#747474] sm:p-6">Incluye hipofunción unilateral y bilateral, VPPB, migraña vestibular, PPPD, mareo visual, cinetosis, Ménière, presbivestibulopatía, posconmoción y schwannoma vestibular.</div>}
  </details>
}
