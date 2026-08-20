import { ArrowDown, ArrowUp, ChevronLeft, Copy, FilePenLine, ListChecks, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { statusLabel } from '../components/statusLabels'
import { ClinicalSuggestionsPanel } from '../features/clinicalEpisodes/ClinicalSuggestionsPanel'
import { useClinicalEpisode } from '../features/clinicalEpisodes/hooks'
import { defaultExerciseConfig, type ExerciseConfig } from '../features/exercise/types'
import { usePatient } from '../features/patients/hooks'
import { useCreateSessionAssignment, useSessionAssignments, useTreatmentCycles, useUpdateSessionAssignment } from '../features/sessions/hooks'
import { canManageSessionAssignment } from '../features/sessions/repository'
import { appendExerciseTemplate, DEFAULT_SESSION_TITLE } from '../features/sessions/builder'
import { clearSessionBuilderDraft, readSessionBuilderDraft, sessionBuilderDraftKey, writeSessionBuilderDraft } from '../features/sessions/builderDraft'
import { SessionExerciseEditor } from '../features/sessions/SessionExerciseEditor'
import { RetrospectiveCompletionFields } from '../features/sessions/RetrospectiveCompletionFields'
import { SessionSequenceWarning } from '../features/sessions/SessionSequenceWarning'
import { createRetrospectiveSessionValues, validateSession, type SessionFormValues } from '../features/sessions/schema'
import { useExerciseTemplates } from '../features/templates/hooks'
import { groupExerciseTemplates } from '../features/templates/grouping'

const FREE_SESSION_TITLE = 'Sesión presencial libre'

export function SessionBuilderPage() {
  const { patientId = '', assignmentId } = useParams()
  const navigate = useNavigate()
  const { data: patient } = usePatient(patientId)
  const { data: cycles = [] } = useTreatmentCycles(patientId)
  const { data: assignments = [], isPending: assignmentsPending } = useSessionAssignments(patientId)
  const create = useCreateSessionAssignment(patientId)
  const update = useUpdateSessionAssignment(patientId)
  const draftKey = sessionBuilderDraftKey(patientId, assignmentId)
  const [recoveredDraft] = useState(() => readSessionBuilderDraft(draftKey))
  const [selected, setSelected] = useState(recoveredDraft?.selectedExerciseIndex ?? 0)
  const [exerciseNotice, setExerciseNotice] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const assignment = assignmentId ? assignments.find((item) => item.id === assignmentId) : undefined
  const isEditing = Boolean(assignmentId)
  const initializedAssignmentId = useRef('')
  const { data: templates = [] } = useExerciseTemplates()
  const templateGroups = groupExerciseTemplates(templates)
  const [values, setValues] = useState<SessionFormValues>(recoveredDraft?.values ?? { kind: 'exercise', title: DEFAULT_SESSION_TITLE, instructions: 'Realizar según las indicaciones brindadas por el profesional.', mode: 'home', treatmentCycleId: '', availableFrom: new Date().toISOString().slice(0, 10), availableUntil: '', exercises: [{ ...defaultExerciseConfig }] })
  const { data: clinicalEpisode } = useClinicalEpisode(patientId, values.treatmentCycleId)

  useEffect(() => {
    if (!assignmentId || !assignment || initializedAssignmentId.current === assignmentId) return
    initializedAssignmentId.current = assignmentId
    if (recoveredDraft) {
      setValues(recoveredDraft.values)
      setSelected(recoveredDraft.selectedExerciseIndex)
      return
    }
    setValues({ kind: assignment.kind ?? 'exercise', title: assignment.title, instructions: assignment.instructions, mode: assignment.mode, treatmentCycleId: assignment.treatmentCycleId, availableFrom: assignment.availableFrom.slice(0, 10), availableUntil: assignment.availableUntil.slice(0, 10), exercises: assignment.exercises.map((exercise) => ({ ...exercise })) })
    setSelected(0)
  }, [assignment, assignmentId, recoveredDraft])
  useEffect(() => { if (isEditing) return; const active = cycles.find((cycle) => cycle.status === 'active'); if (active && !values.treatmentCycleId) setValues((current) => ({ ...current, treatmentCycleId: active.id })) }, [cycles, isEditing, values.treatmentCycleId])
  useEffect(() => {
    if (isEditing && initializedAssignmentId.current !== assignmentId) return
    writeSessionBuilderDraft(draftKey, { values, selectedExerciseIndex: selected })
  }, [assignmentId, draftKey, isEditing, selected, values])

  const clearExerciseError = () => setErrors((current) => { if (!current.exercises) return current; const next = { ...current }; delete next.exercises; return next })
  const addTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    setValues((current) => {
      const result = appendExerciseTemplate(current, { ...template.config, selectionOrigin: 'manual' })
      setSelected(result.selectedIndex)
      setExerciseNotice(`${template.name} se agregó como ejercicio ${result.selectedIndex + 1}. La sesión ahora contiene ${result.values.exercises.length} ${result.values.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}.`)
      return result.values
    })
    clearExerciseError()
  }
  const addBlankExercise = () => {
    setValues((current) => {
      const exercises = [...current.exercises, { ...defaultExerciseConfig, selectionOrigin: 'manual' as const, name: `Ejercicio ${current.exercises.length + 1}` }]
      setSelected(exercises.length - 1)
      setExerciseNotice(`Se agregó el ejercicio ${exercises.length}. La sesión ahora contiene ${exercises.length} ejercicios.`)
      return { ...current, exercises }
    })
    clearExerciseError()
  }
  const duplicateSelectedExercise = () => {
    setValues((current) => {
      const exercises = [...current.exercises, { ...current.exercises[selected], selectionOrigin: 'manual' as const, clinicalSuggestionId: undefined, name: `${current.exercises[selected].name} (copia)` }]
      setSelected(exercises.length - 1)
      setExerciseNotice(`Se duplicó el ejercicio. La sesión ahora contiene ${exercises.length} ejercicios.`)
      return { ...current, exercises }
    })
    clearExerciseError()
  }
  const updateExercise = (config: ExerciseConfig) => { setValues((current) => ({ ...current, exercises: current.exercises.map((exercise, index) => index === selected ? { ...config, selectionOrigin: config.purpose === 'custom_free' ? 'free' : exercise.selectionOrigin === 'suggested' ? 'suggested_modified' : config.selectionOrigin ?? 'manual' } : exercise) })); clearExerciseError() }
  const addClinicalSuggestion = (exercise: ExerciseConfig, title: string) => {
    setValues((current) => {
      const untouchedStarter = current.exercises.length === 1 && JSON.stringify(current.exercises[0]) === JSON.stringify(defaultExerciseConfig)
      const exercises = untouchedStarter ? [exercise] : [...current.exercises, exercise]
      setSelected(exercises.length - 1)
      setExerciseNotice(`${title} se agregó como ejercicio ${exercises.length}. Podés modificar todos sus parámetros o eliminarlo.`)
      return { ...current, mode: exercise.clinicalSuggestionId === 'bppv-reposition' ? 'in_person' : current.mode, exercises }
    })
    clearExerciseError()
  }
  const move = (direction: -1 | 1) => {
    const target = selected + direction
    if (target < 0 || target >= values.exercises.length) return
    setValues((current) => { const next = [...current.exercises]; [next[selected], next[target]] = [next[target], next[selected]]; return { ...current, exercises: next } })
    setSelected(target)
    clearExerciseError()
  }
  const chooseKind = (kind: 'exercise' | 'free_note') => {
    setErrors({})
    setSelected(0)
    setValues((current) => kind === 'free_note'
      ? { ...current, kind, title: current.title === DEFAULT_SESSION_TITLE ? FREE_SESSION_TITLE : current.title, instructions: '', mode: 'in_person', exercises: [] }
      : { ...current, kind, title: current.title === FREE_SESSION_TITLE ? DEFAULT_SESSION_TITLE : current.title, instructions: current.instructions || 'Realizar según las indicaciones brindadas por el profesional.', exercises: current.exercises.length ? current.exercises : [{ ...defaultExerciseConfig }] })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const submissionValues = values.kind === 'free_note' ? values : { ...values, exercises: values.exercises.map((exercise) => ({ ...exercise, selectionOrigin: exercise.selectionOrigin ?? (exercise.purpose === 'custom_free' ? 'free' : 'manual') as ExerciseConfig['selectionOrigin'] })) }
    const found = validateSession(submissionValues)
    setErrors(found)
    if (Object.keys(found).length) return
    try {
      if (isEditing && assignment) {
        await update.mutateAsync({ assignment, values: submissionValues })
        clearSessionBuilderDraft(draftKey)
        navigate(`/app/pacientes/${patientId}`, { state: { notice: 'Sesión actualizada correctamente.' } })
      } else {
        await create.mutateAsync(submissionValues)
        clearSessionBuilderDraft(draftKey)
        navigate(`/app/pacientes/${patientId}`, { state: { notice: values.registerAsCompleted ? 'Sesión creada y registrada como finalizada retrospectivamente.' : values.kind === 'free_note' ? 'Sesión presencial libre creada.' : 'Sesión creada y asignada correctamente.' } })
      }
    } catch (caught) {
      setErrors({ form: caught instanceof Error ? caught.message : isEditing ? 'No fue posible actualizar la sesión.' : 'No fue posible crear la sesión.' })
    }
  }
  const input = 'mt-2 h-11 min-w-0 w-full rounded-2xl border border-[#E9E7E7] bg-white px-3 text-sm'

  if (isEditing && assignmentsPending) return <p className="text-sm text-[#747474]">Cargando sesión…</p>
  if (isEditing && !assignment) return <div className="space-y-4"><p className="text-sm text-[#747474]">Sesión no encontrada.</p><Link to={`/app/pacientes/${patientId}`} className="text-xs font-black text-[#E49A02]">Volver al perfil</Link></div>
  if (assignment && !canManageSessionAssignment(assignment)) return <div className="space-y-4"><p className="rounded-2xl bg-[#FFF7E8] p-5 text-sm font-bold text-[#8A5B00]">Esta sesión ya tiene actividad registrada. Para conservar el historial clínico no puede modificarse.</p><Link to={`/app/pacientes/${patientId}`} className="text-xs font-black text-[#E49A02]">Volver al perfil</Link></div>

  return <div className="space-y-7">
    <Link to={`/app/pacientes/${patientId}`} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver al perfil</Link>
    <PageHeader eyebrow="Planificación" title={isEditing ? 'Editar sesión' : 'Crear y asignar sesión'} description={patient ? `Configuración para ${patient.fullName}. El ciclo puede combinar sesiones guiadas y registros presenciales libres.` : 'Prepará una sesión.'}/>
    {recoveredDraft && <p className="rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] px-4 py-3 text-sm font-bold text-[#28613D]">Borrador recuperado automáticamente. Los ejercicios y la dosis se conservaron al cambiar de pantalla.</p>}
    {cycles.length === 0 ? <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-6"><h2 className="font-black text-[#8A5B00]">Primero necesitás un ciclo activo</h2><p className="mt-2 text-sm text-[#8A5B00]">Las sesiones quedan asociadas al ciclo para conservar el historial y preparar el informe final.</p><Link to={`/app/pacientes/${patientId}/ciclos/nuevo`} className="mt-4 inline-flex rounded-2xl bg-[#8A5B00] px-4 py-3 text-sm font-black text-white">Iniciar ciclo</Link></section> : <form onSubmit={submit} className="min-w-0 space-y-7 pb-20 sm:pb-0">
      <section className="grid gap-3 rounded-2xl border border-[#E9E7E7] bg-white p-5 sm:grid-cols-2">
        <button type="button" onClick={() => chooseKind('exercise')} className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left ${values.kind !== 'free_note' ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E9E7E7]'}`}><ListChecks className="mt-0.5 shrink-0 text-[#E49A02]" size={21}/><span><strong className="block text-sm text-[#171717]">Sesión con ejercicios</strong><span className="mt-1 block text-xs leading-5 text-[#747474]">Plan estructurado para domicilio o presencial, con reproductor y seguimiento.</span></span></button>
        <button type="button" onClick={() => chooseKind('free_note')} className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left ${values.kind === 'free_note' ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E9E7E7]'}`}><FilePenLine className="mt-0.5 shrink-0 text-[#E49A02]" size={21}/><span><strong className="block text-sm text-[#171717]">Presencial libre</strong><span className="mt-1 block text-xs leading-5 text-[#747474]">Al ejecutarla, escribís qué se hizo o registrás que la consulta fue cancelada.</span></span></button>
      </section>

      <section className="grid min-w-0 gap-5 rounded-2xl border border-[#E9E7E7] bg-white p-6 md:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-xs font-black text-[#2F2F2F] xl:col-span-2">Título<input className={input} value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}/>{errors.title && <small className="text-[#a94952]">{errors.title}</small>}</label>
        <label className="min-w-0 text-xs font-black text-[#2F2F2F]">Modalidad<select disabled={values.kind === 'free_note'} className={`${input} disabled:bg-[#F7F6F4]`} value={values.mode} onChange={(event) => { setValues((current) => ({ ...current, mode: event.target.value as SessionFormValues['mode'] })); clearExerciseError() }}><option value="home">Domiciliaria</option><option value="in_person">Presencial</option></select></label>
        <label className="min-w-0 text-xs font-black text-[#2F2F2F]">Ciclo<select className={input} value={values.treatmentCycleId} onChange={(event) => setValues((current) => ({ ...current, treatmentCycleId: event.target.value }))}>{cycles.filter((cycle) => cycle.status !== 'completed').map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label} · {statusLabel(cycle.status).toLocaleLowerCase('es')}</option>)}</select></label>
        <label className="min-w-0 text-xs font-black text-[#2F2F2F]">Fecha de la sesión<input type="date" className={input} value={values.availableFrom} onChange={(event) => setValues((current) => ({ ...current, availableFrom: event.target.value, registerAsCompleted: event.target.value < new Date().toISOString().slice(0, 10) ? current.registerAsCompleted : false }))}/></label>
        {values.kind !== 'free_note' && <label className="min-w-0 text-xs font-black text-[#2F2F2F]">Disponible hasta (opcional)<input type="date" className={input} value={values.availableUntil} onChange={(event) => setValues((current) => ({ ...current, availableUntil: event.target.value }))}/></label>}
        <label className="min-w-0 text-xs font-black text-[#2F2F2F] md:col-span-2">{values.kind === 'free_note' ? 'Motivo o nota previa (opcional)' : 'Indicaciones para el paciente'}<textarea className="mt-2 min-h-20 w-full min-w-0 rounded-2xl border border-[#E9E7E7] p-3 text-sm" value={values.instructions} onChange={(event) => setValues((current) => ({ ...current, instructions: event.target.value }))} placeholder={values.kind === 'free_note' ? 'Ej.: trabajo físico variado, control presencial…' : undefined}/></label>
        {errors.kind && <p className="text-xs font-bold text-[#a94952] md:col-span-2">{errors.kind}</p>}
      </section>

      {values.availableFrom < new Date().toISOString().slice(0, 10) && <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-5">
        <label className="flex items-start gap-3 text-sm font-black text-[#7A5100]"><input type="checkbox" className="mt-0.5 size-5" checked={Boolean(values.registerAsCompleted)} onChange={(event) => setValues((current) => ({ ...current, registerAsCompleted: event.target.checked, retrospective: event.target.checked ? current.retrospective ?? createRetrospectiveSessionValues(current.exercises, current.availableFrom) : current.retrospective }))}/><span>Registrar esta sesión pasada como ya finalizada<span className="mt-1 block text-xs font-normal leading-5 text-[#8A5B00]">Usá esta opción solamente si la sesión realmente ocurrió. Quedará diferenciada de una sesión ejecutada en vivo.</span></span></label>
      </section>}
      {values.registerAsCompleted && values.retrospective && (
        <RetrospectiveCompletionFields
          exercises={values.exercises}
          value={values.retrospective}
          onChange={(retrospective) => setValues((current) => ({ ...current, retrospective }))}
          error={errors.retrospective}
        />
      )}

      {values.kind !== 'free_note' && (
        <ClinicalSuggestionsPanel
          patientId={patientId}
          episode={clinicalEpisode}
          templates={templates}
          onAdd={addClinicalSuggestion}
        />
      )}
      {values.kind === 'free_note' ? <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-6"><h2 className="font-black text-[#7A5100]">Registro flexible al momento de atender</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#8A5B00]">Esta sesión no contiene ejercicios predefinidos. Al abrirla desde el perfil podrás marcarla como realizada o cancelada y escribir el detalle clínico; el texto quedará en el historial y en el informe del ciclo.</p></section> : <section className="min-w-0">
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-[#171717]">Ejercicios de la sesión</h2><span className="rounded-full bg-[#FFF1D5] px-3 py-1 text-xs font-black text-[#8A5B00]">{values.exercises.length} {values.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</span></div><p className="mt-1 text-xs text-[#747474]">Cada ejercicio que agregues queda en la lista de abajo y se reproduce en ese orden.</p></div><div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:w-auto"><select aria-label="Agregar ejercicio desde biblioteca" defaultValue="" onChange={(event) => { addTemplate(event.target.value); event.target.value = '' }} className="min-w-0 max-w-full rounded-2xl border border-[#E9E7E7] bg-white px-3 text-xs font-black text-[#2F2F2F]"><option value="">Agregar desde biblioteca…</option>{templateGroups.map((group) => <optgroup key={group.id} label={group.label}>{group.templates.map((template) => <option key={template.id} value={template.id}>{template.config.clinicalProtocol === 'pppd' ? `Nivel ${template.config.progressionLevel} · ` : ''}{template.name.replace(/^PPPD · (Habituación visual|Optocinético|Funcional) · /, '')}</option>)}</optgroup>)}</select><button type="button" onClick={addBlankExercise} className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-xs font-black text-[#2F2F2F]"><Plus size={16}/> Nuevo</button></div></div>
        {exerciseNotice && <p role="status" className="mb-4 rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] px-4 py-3 text-xs font-bold text-[#28613D]">{exerciseNotice}</p>}
        <SessionSequenceWarning exercises={values.exercises} onReorder={(exercises) => { setValues((current) => ({ ...current, exercises })); setSelected(0) }}/>
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black text-[#2F2F2F]">Secuencia completa</h3><p className="text-[11px] text-[#747474]">Seleccioná uno para editarlo</p></div>
        <ol className="mb-5 grid max-w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">{values.exercises.map((exercise, index) => <li key={`${exercise.name}-${index}`}><button aria-current={selected === index ? 'step' : undefined} type="button" onClick={() => setSelected(index)} className={`h-full w-full rounded-2xl border p-4 text-left ${selected === index ? 'border-[#E49A02] bg-[#FFF7E8] ring-2 ring-[#E49A02]/10' : 'border-[#E9E7E7] bg-white'}`}><span className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase text-[#E49A02]">Ejercicio {index + 1}</span>{selected === index && <span className="rounded-full bg-[#E49A02] px-2 py-0.5 text-[9px] font-black uppercase text-white">Editando</span>}</span><p className="mt-2 text-sm font-black text-[#2F2F2F]">{exercise.name}</p><p className="mt-1 text-xs text-[#747474]">{exercise.doseMode === 'time' ? `${exercise.durationSeconds}s` : `${exercise.targetRepetitions} rep.`} × {exercise.rounds}{exercise.displayMode === 'vr_box' ? ' · VR Box' : exercise.displayMode === 'quest_browser' ? ' · Quest' : ' · Pantalla'}</p>{exercise.selectionOrigin && <span className="mt-2 inline-flex rounded-full bg-[#F1EFEC] px-2 py-1 text-[9px] font-black text-[#5E5E5E]">{exercise.selectionOrigin === 'suggested' ? 'Sugerido' : exercise.selectionOrigin === 'suggested_modified' ? 'Sugerido · modificado' : exercise.selectionOrigin === 'free' ? 'Libre' : 'Manual'}</span>}</button></li>)}</ol>
        <div className="mb-4 flex flex-wrap gap-2"><button type="button" disabled={selected === 0} onClick={() => move(-1)} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] px-3 py-2 text-xs font-bold disabled:opacity-30"><ArrowUp size={16}/> Mover antes</button><button type="button" disabled={selected === values.exercises.length - 1} onClick={() => move(1)} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] px-3 py-2 text-xs font-bold disabled:opacity-30"><ArrowDown size={16}/> Mover después</button><button type="button" onClick={duplicateSelectedExercise} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] px-3 py-2 text-xs font-bold"><Copy size={16}/> Duplicar</button><button type="button" disabled={values.exercises.length === 1} onClick={() => { setValues((current) => ({ ...current, exercises: current.exercises.filter((_, index) => index !== selected) })); setSelected(Math.max(0, selected - 1)); setExerciseNotice('El ejercicio se eliminó de la secuencia.') }} className="inline-flex items-center gap-2 rounded-xl border border-[#eccfd2] px-3 py-2 text-xs font-bold text-[#a94952] disabled:opacity-30"><Trash2 size={16}/> Eliminar</button></div>
        {errors.exercises && <p className="mb-4 text-sm font-bold text-[#a94952]">{errors.exercises}</p>}
        {values.exercises[selected] && <SessionExerciseEditor config={values.exercises[selected]} isFirst={selected === 0} setting={values.mode} onChange={updateExercise}/>}
      </section>}

      {errors.form && <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{errors.form}</p>}
      <div className="sticky bottom-0 z-10 -mx-4 flex border-t border-[#E9E7E7] bg-[#F7F6F4]/95 px-4 py-3 backdrop-blur sm:bottom-4 sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"><button disabled={create.isPending || update.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] px-6 py-4 text-sm font-black text-white shadow-xl sm:w-auto"><Save size={17}/>{isEditing ? update.isPending ? 'Guardando…' : 'Guardar cambios' : create.isPending ? 'Asignando…' : values.kind === 'free_note' ? 'Crear sesión libre' : 'Guardar y asignar sesión'}</button></div>
    </form>}
  </div>
}
