import { ArrowDown, ArrowUp, Check, FolderOpen, ListPlus, RotateCcw, Save, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { PathologyRecommendations } from '../features/clinicalRecommendations/PathologyRecommendations'
import { analyzeExerciseCompatibility, applyExercisePurpose } from '../features/exercise/compatibility'
import { clearExerciseBuilderDraft, readExerciseBuilderDraft, writeExerciseBuilderDraft } from '../features/exercise/builderDraft'
import { defaultExerciseConfig, type ExerciseConfig } from '../features/exercise/types'
import { usePatients } from '../features/patients/hooks'
import { sessionValuesFromExerciseSelection } from '../features/sessions/builder'
import { readSessionBuilderDraft, sessionBuilderDraftKey, writeSessionBuilderDraft } from '../features/sessions/builderDraft'
import { SessionExerciseEditor } from '../features/sessions/SessionExerciseEditor'
import { useDeleteExerciseTemplate, useExerciseTemplates, useSaveExerciseTemplate } from '../features/templates/hooks'
import { groupExerciseTemplates } from '../features/templates/grouping'
import { getImmersiveScenario } from '../features/immersive/catalog'

function doseLabel(config: ExerciseConfig) {
  return config.doseMode === 'time' ? `${config.durationSeconds} s` : `${config.targetRepetitions} rep.`
}

export function ExerciseBuilderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedScenario = getImmersiveScenario(searchParams.get('scenario') ?? undefined)
  const [recoveredDraft] = useState(() => requestedScenario ? null : readExerciseBuilderDraft())
  const [config, setConfig] = useState<ExerciseConfig>(() => requestedScenario
    ? applyExercisePurpose({ ...defaultExerciseConfig, immersiveScenarioId: requestedScenario.id }, 'immersive_context')
    : recoveredDraft?.config ?? defaultExerciseConfig)
  const [notice, setNotice] = useState(recoveredDraft ? 'Borrador recuperado automáticamente. Podés continuar donde lo dejaste.' : '')
  const [selectedTemplateId, setSelectedTemplateId] = useState(requestedScenario ? `template-immersive-${requestedScenario.id}` : recoveredDraft?.selectedTemplateId ?? '')
  const [pathologySelection, setPathologySelection] = useState(recoveredDraft?.pathologySelection ?? [])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const { data: templates = [] } = useExerciseTemplates()
  const { data: patients = [] } = usePatients()
  const saveTemplate = useSaveExerciseTemplate()
  const deleteTemplate = useDeleteExerciseTemplate()
  const compatibility = analyzeExerciseCompatibility(config)
  const templateGroups = groupExerciseTemplates(templates)
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)
  const selectedTemplateIndex = pathologySelection.findIndex((item) => item.templateId === selectedTemplateId)

  useEffect(() => {
    writeExerciseBuilderDraft({ config, selectedTemplateId, pathologySelection })
  }, [config, pathologySelection, selectedTemplateId])

  const updateConfig = (next: ExerciseConfig) => {
    setConfig(next)
    setPathologySelection((current) => current.map((item) => item.templateId === selectedTemplateId
      ? { ...item, name: next.name, config: { ...next } }
      : item))
  }

  const addTemplateToSelection = (template: (typeof templates)[number], sourceLabel: string, configuredExercise = template.config) => {
    const existingIndex = pathologySelection.findIndex((item) => item.templateId === template.id)
    setSelectedTemplateId(template.id)
    if (existingIndex >= 0) {
      setConfig({ ...pathologySelection[existingIndex].config })
      setNotice(`“${template.name}” ya estaba agregado como ejercicio ${existingIndex + 1}. Quedó seleccionado para editar.`)
      return
    }
    setConfig({ ...configuredExercise })
    setPathologySelection((current) => [...current, { templateId: template.id, name: configuredExercise.name, config: { ...configuredExercise } }])
    setNotice(`“${configuredExercise.name}” se agregó desde ${sourceLabel}. La selección ahora tiene ${pathologySelection.length + 1} ejercicios.`)
  }

  const loadLibraryTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    const selectedExercise = pathologySelection.find((item) => item.templateId === template.id)
    setConfig({ ...(selectedExercise?.config ?? template.config) })
    setNotice(selectedExercise
      ? `“${template.name}” ya forma parte de la selección y quedó listo para editar.`
      : `Plantilla “${template.name}” cargada. Usá “Agregar a la selección” para sumarla.`)
  }

  const removePathologyTemplate = (templateId: string) => {
    setPathologySelection((current) => current.filter((item) => item.templateId !== templateId))
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId('')
      setConfig(defaultExerciseConfig)
    }
    setNotice('El ejercicio se quitó de la selección para la sesión.')
  }

  const movePathologyTemplate = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= pathologySelection.length) return
    setPathologySelection((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const preparePatientSession = () => {
    if (!selectedPatientId || pathologySelection.length === 0) return
    const key = sessionBuilderDraftKey(selectedPatientId)
    const existingDraft = readSessionBuilderDraft(key)
    if (existingDraft && !window.confirm('Este paciente ya tiene una sesión en borrador. ¿Querés reemplazarla por la selección actual?')) return
    writeSessionBuilderDraft(key, {
      values: sessionValuesFromExerciseSelection(pathologySelection.map((item) => item.config), new Date().toISOString().slice(0, 10)),
      selectedExerciseIndex: 0,
    })
    navigate(`/app/pacientes/${selectedPatientId}/sesiones/nueva`)
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Constructor de ejercicios"
        title="Crear ejercicio"
        description="Configurá el estímulo o la tarea física, su dosis y el modo de confirmación. Toda prescripción necesita revisión profesional antes de asignarse."
        actions={<>
          <button type="button" onClick={() => { clearExerciseBuilderDraft(); setConfig(defaultExerciseConfig); setSelectedTemplateId(''); setPathologySelection([]); setSelectedPatientId(''); setNotice('Borrador descartado. El constructor volvió a la configuración inicial.') }} className="inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-sm font-black text-[#2F2F2F]"><RotateCcw size={17}/> Restablecer</button>
          <button type="button" disabled={saveTemplate.isPending || (!compatibility.valid && config.purpose !== 'custom_free')} onClick={async () => { try { await saveTemplate.mutateAsync(config); setNotice(config.purpose === 'custom_free' ? 'Plantilla Libre guardada. Requiere revisión profesional antes de asignarse.' : 'Plantilla guardada en la biblioteca.') } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'No fue posible guardar.') } }} className="inline-flex items-center gap-2 rounded-2xl bg-[#E49A02] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Save size={17}/> Guardar plantilla</button>
        </>}
      />

      {notice && <p className="rounded-2xl bg-[#FFF7E8] px-4 py-3 text-sm font-bold text-[#A36B00]">{notice}</p>}

      <PathologyRecommendations templates={templates} selectedTemplateIds={pathologySelection.map((item) => item.templateId)} onLoadTemplate={(template, pathology) => addTemplateToSelection(template, pathology.label)}/>

      <section className={`rounded-2xl border p-5 sm:p-6 ${pathologySelection.length > 0 ? 'border-[#B9D9C5] bg-[#F0F8F3]' : 'border-[#E9E7E7] bg-white'}`} aria-labelledby="pathology-selection-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#28613D] text-white"><ListPlus size={19}/></span><div><h2 id="pathology-selection-title" className="text-base font-black text-[#173A26]">Selección para una sesión</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[#47705A]">Los ejercicios elegidos por patología o desde la biblioteca se suman una sola vez. Podés editarlos, cambiar el orden y transferir toda la lista al paciente.</p></div></div><span className="self-start rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#28613D]">{pathologySelection.length} {pathologySelection.length === 1 ? 'ejercicio' : 'ejercicios'}</span></div>
        {pathologySelection.length === 0 ? <p className="mt-5 rounded-2xl bg-[#F7F6F4] p-4 text-xs leading-5 text-[#747474]">Elegí una patología y usá los botones con “+”, o seleccioná un ejercicio de la biblioteca y tocá “Agregar a la selección”.</p> : <>
          <ol aria-label="Ejercicios seleccionados para la sesión" className="mt-5 grid gap-3 lg:grid-cols-2">{pathologySelection.map((item, index) => <li key={item.templateId} className={`rounded-2xl border bg-white p-4 ${selectedTemplateId === item.templateId ? 'border-[#E49A02] ring-2 ring-[#E49A02]/10' : 'border-[#D9E7DF]'}`}><button type="button" onClick={() => { setSelectedTemplateId(item.templateId); setConfig({ ...item.config }); setNotice(`Ejercicio ${index + 1} seleccionado para editar.`) }} className="w-full text-left"><span className="text-[10px] font-black uppercase tracking-[.12em] text-[#28613D]">Ejercicio {index + 1}</span><p className="mt-2 text-sm font-black text-[#2F2F2F]">{item.config.name}</p><p className="mt-1 text-xs text-[#747474]">{doseLabel(item.config)} × {item.config.rounds} · {item.config.advanceMode === 'manual' ? 'avance manual' : 'avance automático'}</p></button><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={index === 0} onClick={() => movePathologyTemplate(index, -1)} className="rounded-xl border border-[#E9E7E7] p-2 disabled:opacity-30" aria-label={`Mover antes ${item.config.name}`}><ArrowUp size={15}/></button><button type="button" disabled={index === pathologySelection.length - 1} onClick={() => movePathologyTemplate(index, 1)} className="rounded-xl border border-[#E9E7E7] p-2 disabled:opacity-30" aria-label={`Mover después ${item.config.name}`}><ArrowDown size={15}/></button><button type="button" onClick={() => removePathologyTemplate(item.templateId)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-[#eccfd2] px-3 py-2 text-[10px] font-black text-[#a94952]"><Trash2 size={14}/> Quitar</button></div></li>)}</ol>
          <div className="mt-5 grid gap-3 rounded-2xl border border-[#B9D9C5] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="text-xs font-black text-[#173A26]">Paciente<select aria-label="Paciente para la selección" value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#B9D9C5] bg-white px-4 text-sm"><option value="">Seleccionar paciente…</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label><button type="button" disabled={!selectedPatientId} onClick={preparePatientSession} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#28613D] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"><UserPlus size={17}/> Preparar sesión con los {pathologySelection.length}</button></div>
        </>}
      </section>

      <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
        <div className="flex items-start gap-2"><FolderOpen size={18} className="mt-0.5 shrink-0 text-[#E49A02]"/><div><h2 className="text-sm font-black text-[#171717]">Biblioteca de ejercicios</h2><p className="mt-1 text-xs leading-5 text-[#747474]">Elegí un ejercicio, revisá su configuración y sumalo a la selección de la sesión.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="text-xs font-black text-[#2F2F2F]">Elegir plantilla<select value={selectedTemplateId} onChange={(event) => loadLibraryTemplate(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#E9E7E7] bg-white px-4 text-sm"><option value="">Seleccionar…</option>{templateGroups.map((group) => <optgroup key={group.id} label={group.label}>{group.templates.map((template) => <option key={template.id} value={template.id}>{template.config.clinicalProtocol === 'pppd' ? `Nivel ${template.config.progressionLevel} · ` : ''}{template.name.replace(/^PPPD · (Habituación visual|Optocinético|Funcional) · /, '')}</option>)}</optgroup>)}</select></label>
          {selectedTemplate && <div className="self-end rounded-2xl bg-[#F7F6F4] px-4 py-3"><p className="text-[10px] font-black text-[#2F2F2F]">{doseLabel(selectedTemplate.config)} × {selectedTemplate.config.rounds}</p><p className="mt-1 text-[10px] text-[#747474]">{selectedTemplate.config.advanceMode === 'manual' ? 'Avance manual' : 'Avance automático'}</p></div>}
        </div>
        {selectedTemplate && <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"><button type="button" disabled={selectedTemplateIndex >= 0} onClick={() => addTemplateToSelection(selectedTemplate, 'la biblioteca', config)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#28613D] px-4 py-3 text-xs font-black text-white disabled:cursor-default disabled:bg-[#D9E7DF] disabled:text-[#28613D] sm:w-auto">{selectedTemplateIndex >= 0 ? <Check size={16}/> : <ListPlus size={16}/>} {selectedTemplateIndex >= 0 ? 'Ya está en la selección' : 'Agregar a la selección'}</button>{!selectedTemplate.id.startsWith('template-') && <button type="button" onClick={async () => { await deleteTemplate.mutateAsync(selectedTemplate.id); setPathologySelection((current) => current.filter((item) => item.templateId !== selectedTemplate.id)); setSelectedTemplateId(''); setConfig(defaultExerciseConfig); setNotice('Plantilla eliminada.') }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eccfd2] px-3 py-2 text-xs font-black text-[#a94952]"><Trash2 size={15}/> Eliminar plantilla seleccionada</button>}</div>}
      </section>

      <SessionExerciseEditor config={config} isFirst onChange={updateConfig}/>
    </div>
  )
}
