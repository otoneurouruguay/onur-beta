import { FolderOpen, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { PathologyRecommendations } from '../features/clinicalRecommendations/PathologyRecommendations'
import { analyzeExerciseCompatibility, applyExercisePurpose } from '../features/exercise/compatibility'
import { clearExerciseBuilderDraft, readExerciseBuilderDraft, writeExerciseBuilderDraft } from '../features/exercise/builderDraft'
import { defaultExerciseConfig, type ExerciseConfig } from '../features/exercise/types'
import { SessionExerciseEditor } from '../features/sessions/SessionExerciseEditor'
import { useDeleteExerciseTemplate, useExerciseTemplates, useSaveExerciseTemplate } from '../features/templates/hooks'
import { groupExerciseTemplates } from '../features/templates/grouping'
import { getImmersiveScenario } from '../features/immersive/catalog'

function doseLabel(config: ExerciseConfig) {
  return config.doseMode === 'time' ? `${config.durationSeconds} s` : `${config.targetRepetitions} rep.`
}

export function ExerciseBuilderPage() {
  const [searchParams] = useSearchParams()
  const requestedScenario = getImmersiveScenario(searchParams.get('scenario') ?? undefined)
  const [recoveredDraft] = useState(() => requestedScenario ? null : readExerciseBuilderDraft())
  const [config, setConfig] = useState<ExerciseConfig>(() => requestedScenario
    ? applyExercisePurpose({ ...defaultExerciseConfig, immersiveScenarioId: requestedScenario.id }, 'immersive_context')
    : recoveredDraft?.config ?? defaultExerciseConfig)
  const [notice, setNotice] = useState(recoveredDraft ? 'Borrador recuperado automáticamente. Podés continuar donde lo dejaste.' : '')
  const [selectedTemplateId, setSelectedTemplateId] = useState(requestedScenario ? `template-immersive-${requestedScenario.id}` : recoveredDraft?.selectedTemplateId ?? '')
  const { data: templates = [] } = useExerciseTemplates()
  const saveTemplate = useSaveExerciseTemplate()
  const deleteTemplate = useDeleteExerciseTemplate()
  const compatibility = analyzeExerciseCompatibility(config)
  const templateGroups = groupExerciseTemplates(templates)
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)

  useEffect(() => {
    writeExerciseBuilderDraft({ config, selectedTemplateId })
  }, [config, selectedTemplateId])

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Constructor de ejercicios"
        title="Crear ejercicio"
        description="Configurá el estímulo o la tarea física, su dosis y el modo de confirmación. Toda prescripción necesita revisión profesional antes de asignarse."
        actions={<>
          <button type="button" onClick={() => { clearExerciseBuilderDraft(); setConfig(defaultExerciseConfig); setSelectedTemplateId(''); setNotice('Borrador descartado. El constructor volvió a la configuración inicial.') }} className="inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-sm font-black text-[#2F2F2F]"><RotateCcw size={17}/> Restablecer</button>
          <button type="button" disabled={saveTemplate.isPending || (!compatibility.valid && config.purpose !== 'custom_free')} onClick={async () => { try { await saveTemplate.mutateAsync(config); setNotice(config.purpose === 'custom_free' ? 'Plantilla Libre guardada. Requiere revisión profesional antes de asignarse.' : 'Plantilla guardada en la biblioteca.') } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'No fue posible guardar.') } }} className="inline-flex items-center gap-2 rounded-2xl bg-[#E49A02] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Save size={17}/> Guardar plantilla</button>
        </>}
      />

      {notice && <p className="rounded-2xl bg-[#FFF7E8] px-4 py-3 text-sm font-bold text-[#A36B00]">{notice}</p>}

      <PathologyRecommendations templates={templates} onLoadTemplate={(template, pathology) => {
        setConfig({ ...template.config })
        setSelectedTemplateId(template.id)
        setNotice(`Plantilla “${template.name}” cargada desde ${pathology.label}. Revisá la dosis y las precauciones antes de guardarla.`)
      }}/>

      <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
        <div className="flex items-center gap-2"><FolderOpen size={18} className="text-[#E49A02]"/><h2 className="text-sm font-black text-[#171717]">Biblioteca de ejercicios</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="text-xs font-black text-[#2F2F2F]">Elegir plantilla<select value={selectedTemplateId} onChange={(event) => { const id = event.target.value; setSelectedTemplateId(id); const template = templates.find((item) => item.id === id); if (template) { setConfig({ ...template.config }); setNotice(`Plantilla “${template.name}” cargada.`) } }} className="mt-2 h-12 w-full rounded-2xl border border-[#E9E7E7] bg-white px-4 text-sm"><option value="">Seleccionar…</option>{templateGroups.map((group) => <optgroup key={group.id} label={group.label}>{group.templates.map((template) => <option key={template.id} value={template.id}>{template.config.clinicalProtocol === 'pppd' ? `Nivel ${template.config.progressionLevel} · ` : ''}{template.name.replace(/^PPPD · (Habituación visual|Optocinético|Funcional) · /, '')}</option>)}</optgroup>)}</select></label>
          {selectedTemplate && <div className="self-end rounded-2xl bg-[#F7F6F4] px-4 py-3"><p className="text-[10px] font-black text-[#2F2F2F]">{doseLabel(selectedTemplate.config)} × {selectedTemplate.config.rounds}</p><p className="mt-1 text-[10px] text-[#747474]">{selectedTemplate.config.advanceMode === 'manual' ? 'Avance manual' : 'Avance automático'}</p></div>}
        </div>
        {selectedTemplate && !selectedTemplate.id.startsWith('template-') && <button type="button" onClick={async () => { await deleteTemplate.mutateAsync(selectedTemplate.id); setSelectedTemplateId(''); setConfig(defaultExerciseConfig); setNotice('Plantilla eliminada.') }} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#eccfd2] px-3 py-2 text-xs font-black text-[#a94952]"><Trash2 size={15}/> Eliminar plantilla seleccionada</button>}
      </section>

      <SessionExerciseEditor config={config} isFirst onChange={setConfig}/>
    </div>
  )
}
