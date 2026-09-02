import { Search, SlidersHorizontal, X } from 'lucide-react'
import { exercisePurposeLabels } from '../exercise/compatibility'
import type { ExercisePurpose } from '../exercise/types'
import {
  defaultExerciseTemplateFilters,
  hasActiveExerciseTemplateFilters,
  type ExerciseTemplateFilters as ExerciseTemplateFilterValues,
} from './filtering'

interface ExerciseTemplateFiltersProps {
  filters: ExerciseTemplateFilterValues
  resultCount: number
  totalCount: number
  onChange: (filters: ExerciseTemplateFilterValues) => void
}

const purposeOptions = Object.entries(exercisePurposeLabels) as [ExercisePurpose, string][]

export function ExerciseTemplateFilters({ filters, resultCount, totalCount, onChange }: ExerciseTemplateFiltersProps) {
  const active = hasActiveExerciseTemplateFilters(filters)
  const update = <Key extends keyof ExerciseTemplateFilterValues>(key: Key, value: ExerciseTemplateFilterValues[Key]) => {
    onChange({ ...filters, [key]: value })
  }

  const selectClassName = 'mt-1.5 h-11 w-full rounded-xl border border-[#E9E7E7] bg-white px-3 text-xs font-bold text-[#2F2F2F] outline-none focus:border-[#E49A02] focus:ring-2 focus:ring-[#E49A02]/15'

  return (
    <div className="mt-5 rounded-2xl border border-[#EEE9DF] bg-[#FCFBF8] p-4" aria-label="Buscar y filtrar ejercicios">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block min-w-0 flex-1 text-xs font-black text-[#2F2F2F]">
          <span className="sr-only">Buscar ejercicio</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-[#8A8A8A]"/>
          <input
            type="search"
            aria-label="Buscar ejercicio"
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
            placeholder="Buscar por nombre, objetivo o consigna…"
            className="h-11 w-full rounded-xl border border-[#E9E7E7] bg-white pl-10 pr-4 text-sm outline-none placeholder:text-[#9A9A9A] focus:border-[#E49A02] focus:ring-2 focus:ring-[#E49A02]/15"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-[#5F5F5F]"><SlidersHorizontal size={15}/>{resultCount} de {totalCount} ejercicios</span>
          {active && <button type="button" onClick={() => onChange(defaultExerciseTemplateFilters)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5D7B8] bg-white px-3 py-2 text-xs font-black text-[#A36B00]"><X size={14}/> Limpiar filtros</button>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <label className="text-[11px] font-black text-[#5F5F5F]">Objetivo
          <select aria-label="Filtrar por objetivo" value={filters.purpose} onChange={(event) => update('purpose', event.target.value as ExerciseTemplateFilterValues['purpose'])} className={selectClassName}>
            <option value="all">Todos los objetivos</option>
            {purposeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-black text-[#5F5F5F]">Dispositivo
          <select aria-label="Filtrar por dispositivo" value={filters.device} onChange={(event) => update('device', event.target.value as ExerciseTemplateFilterValues['device'])} className={selectClassName}>
            <option value="all">Todos los dispositivos</option>
            <option value="standard">Pantalla 2D</option>
            <option value="vr_box">VR Box sin Cardboard</option>
            <option value="cardboard">VR Box con Cardboard</option>
            <option value="quest_browser">Quest</option>
          </select>
        </label>
        <label className="text-[11px] font-black text-[#5F5F5F]">Modalidad
          <select aria-label="Filtrar por modalidad" value={filters.modality} onChange={(event) => update('modality', event.target.value as ExerciseTemplateFilterValues['modality'])} className={selectClassName}>
            <option value="all">Todas las modalidades</option>
            <option value="visual_stimulus">Estímulo visual</option>
            <option value="guided_physical">Tarea física guiada</option>
          </select>
        </label>
        <label className="text-[11px] font-black text-[#5F5F5F]">Patología / protocolo
          <select aria-label="Filtrar por patología o protocolo" value={filters.protocol} onChange={(event) => update('protocol', event.target.value as ExerciseTemplateFilterValues['protocol'])} className={selectClassName}>
            <option value="all">Todos</option>
            <option value="pppd">PPPD</option>
            <option value="stroboscopic_experimental">Estroboscópico experimental</option>
            <option value="general">Sin protocolo específico</option>
            <option value="personal">Mis plantillas</option>
          </select>
        </label>
        <label className="text-[11px] font-black text-[#5F5F5F]">Dosis
          <select aria-label="Filtrar por dosis" value={filters.dose} onChange={(event) => update('dose', event.target.value as ExerciseTemplateFilterValues['dose'])} className={selectClassName}>
            <option value="all">Tiempo o repeticiones</option>
            <option value="time">Por tiempo</option>
            <option value="repetitions">Por repeticiones</option>
          </select>
        </label>
        <label className="text-[11px] font-black text-[#5F5F5F]">Tipo de estímulo
          <select aria-label="Filtrar por tipo de estímulo" value={filters.stimulus} onChange={(event) => update('stimulus', event.target.value as ExerciseTemplateFilterValues['stimulus'])} className={selectClassName}>
            <option value="all">Todos los estímulos</option>
            <option value="fixed_target">Blanco fijo</option>
            <option value="moving_target">Blanco móvil</option>
            <option value="moving_background">Fondo móvil</option>
            <option value="cognitive">Cognitivo-visual</option>
            <option value="immersive">Escenario 360°</option>
            <option value="physical">Tarea física</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-[#747474]">Los filtros sólo cambian la biblioteca visible. No quitan ni modifican los ejercicios ya agregados a la sesión.</p>
    </div>
  )
}
