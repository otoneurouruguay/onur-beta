import { ArrowDown, ArrowUp, ChevronLeft, Copy, FilePenLine, ListChecks, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { statusLabel } from '../components/statusLabels'
import { defaultExerciseConfig, type ExerciseConfig } from '../features/exercise/types'
import { usePatient } from '../features/patients/hooks'
import { useCreateSessionAssignment, useSessionAssignments, useTreatmentCycles, useUpdateSessionAssignment } from '../features/sessions/hooks'
import { canManageSessionAssignment } from '../features/sessions/repository'
import { appendExerciseTemplate, DEFAULT_SESSION_TITLE } from '../features/sessions/builder'
import { SessionExerciseEditor } from '../features/sessions/SessionExerciseEditor'
import { SessionSequenceWarning } from '../features/sessions/SessionSequenceWarning'
import { validateSession, type SessionFormValues } from '../features/sessions/schema'
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
  const [selected, setSelected] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const assignment = assignmentId ? assignments.find((item) => item.id === assignmentId) : undefined
  const isEditing = Boolean(assignmentId)
  const initializedAssignmentId = useRef('')
  const { data: templates = [] } = useExerciseTemplates()
  const templateGroups = groupExerciseTemplates(templates)
  const [values, setValues] = useState<SessionFormValues>({ kind: 'exercise', title: DEFAULT_SESSION_TITLE, instructions: 'Realizar según las indicaciones brindadas por el profesional.', mode: 'home', treatmentCycleId: '', availableFrom: new Date().toISOString().slice(0, 10), availableUntil: '', exercises: [{ ...defaultExerciseConfig }] })

  useEffect(() => {
    if (!assignmentId || !assignment || initializedAssignmentId.current === assignmentId) return
    initializedAssignmentId.current = assignmentId
    setValues({ kind: assignment.kind ?? 'exercise', title: assignment.title, instructions: assignment.instructions, mode: assignment.mode, treatmentCycleId: assignment.treatmentCycleId, availableFrom: assignment.availableFrom.slice(0, 10), availableUntil: assignment.availableUntil.slice(0, 10), exercises: assignment.exercises.map((exercise) => ({ ...exercise })) })
    setSelected(0)
  }, [assignment, assignmentId])
  useEffect(() => { if (isEditing) return; const active = cycles.find((cycle) => cycle.status === 'active'); if (active && !values.treatmentCycleId) setValues((current) => ({ ...current, treatmentCycleId: active.id })) }, [cycles, isEditing, values.treatmentCycleId])

  const clearExerciseError = () => setErrors((current) => { if (!current.exercises) return current; const next = { ...current }; delete next.exercises; return next })
  const updateExercise = (config: ExerciseConfig) => { setValues((current) => ({ ...current, exercises: current.exercises.map((exercise, index) => index === selected ? config : exercise) })); clearExerciseError() }
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
    const found = validateSession(values)
    setErrors(found)
    if (Object.keys(found).length) return
    try {
      if (isEditing && assignment) {
        await update.mutateAsync({ assignment, values })
        navigate(`/app/pacientes/${patientId}`, { state: { notice: 'Sesión actualizada correctamente.' } })
      } else {
        await create.mutateAsync(values)
        navigate(`/app/pacientes/${patientId}`, { state: { notice: values.kind === 'free_note' ? 'Sesión presencial libre creada.' : 'Sesión creada y asignada correctamente.' } })
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
    {cycles.length === 0 ? <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-6"><h2 className="font-black text-[#8A5B00]">Primero necesitás un ciclo activo</h2><p className="mt-2 text-sm text-[#8A5B00]">Las sesiones quedan asociadas al ciclo para conservar el historial y preparar el informe final.</p><Link to={`/app/pacientes/${patientId}/ciclos/nuevo`} className="mt-4 inline-flex rounded-2xl bg-[#8A5B00] px-4 py-3 text-sm font-black text-white">Iniciar ciclo</Link></section> : <form onSubmit={submit} className="min-w-0 space-y-7 pb-20 sm:pb-0">
      <section className="grid gap-3 rounded-2xl border border-[#E9E7E7] bg-white p-5 sm:grid-cols-2">
        <button type="button" onClick={() => chooseKind('exercise')} className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left ${values.kind !== 'free_note' ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E9E7E7]'}`}><ListChecks className="mt-0.5 shrink-0 text-[#E49A02]" size={21}/><span><strong className="block text-sm text-[#171717]">Sesión con ejercicios</strong><span className="mt-1 block text-xs leading-5 text-[#747474]">Plan estructurado para domicilio o presencial, con reproductor y seguimiento.</span></span></button>
        <button type="button" onClick={() => chooseKind('free_note')} className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left ${values.kind === 'free_note' ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E9E7E7]'}`}><FilePenLine className="mt-0.5 shrink-0 text-[#E49A02]" size={21}/><span><strong className="block text-sm text-[#171717]">Presencial libre</strong><span className="mt-1 block text-xs leading-5 text-[#747474]">Al ejecutarla, escribís qué se hizo o registrás que la consulta fue cancelada.</span></span></button>
      </section>

      <section className="grid min-w-0 gap-5 rounded-2xl border border-[#E9E7E7] bg-white p-6 md:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-xs font-black text-[#2F2F2F] xl:col-span-2">Título<input className={input} value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}/>{errors.title && <small className="text-[#a94952]">{errors.title}</small>}</label>
        <label className="min-w-0 text-xs font-black text-[#2F2F2F]">Modalidad<select disabled={values.kind === 'free_note'} className={`${input} disabled:bg-[#F7F6F4]`} value={values.mode} onChange={(event) => { setValues((current) => ({ ...current, mode: event.target.value as SessionFormValues['mode'] })); clearExerciseError() }}><option value="home">Domiciliaria</option><option value="in_person">Presencial</option></select></label>
        <label className="min-w-0 text-xs font-black text-[#2F2F2F]">Ciclo<select className={input} value={values.treatmentCycleId} onChange={(event) => setValues((current) => ({ ...current, treatmentCycleId: event.target.value }))}>{cycles.filter((cycle) => cycle.status !== 'completed').map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label} · {statusLabel(cycle.status).toLocaleLowerCase('es')}</option>)}</select></label>
        <label className="min-w-0 text-xs font-black text-[#2F2F2F]">Fecha de la sesión<input type="date" className={input} value={values.availableFrom} onChange={(event) => setValues((current) => ({ ...current, availableFrom: event.target.value }))}/></label>
        {values.kind !== 'free_note' && <label className="min-w-0 text-xs font-black text-[#2F2F2F]">Disponible hasta (opcional)<input type="date" className={input} value={values.availableUntil} onChange={(event) => setValues((current) => ({ ...current, availableUntil: event.target.value }))}/></label>}
        <label className="min-w-0 text-xs font-black text-[#2F2F2F] md:col-span-2">{values.kind === 'free_note' ? 'Motivo o nota previa (opcional)' : 'Indicaciones para el paciente'}<textarea className="mt-2 min-h-20 w-full min-w-0 rounded-2xl border border-[#E9E7E7] p-3 text-sm" value={values.instructions} onChange={(event) => setValues((current) => ({ ...current, instructions: event.target.value }))} placeholder={values.kind === 'free_note' ? 'Ej.: trabajo físico variado, control presencial…' : undefined}/></label>
        {errors.kind && <p className="text-xs font-bold text-[#a94952] md:col-span-2">{errors.kind}</p>}
      </section>

      {values.kind === 'free_note' ? <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-6"><h2 className="font-black text-[#7A5100]">Registro flexible al momento de atender</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#8A5B00]">Esta sesión no contiene ejercicios predefinidos. Al abrirla desde el perfil podrás marcarla como realizada o cancelada y escribir el detalle clínico; el texto quedará en el historial y en el informe del ciclo.</p></section> : <section className="min-w-0">
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-black text-[#171717]">Ejercicios</h2><p className="mt-1 text-xs text-[#747474]">Se reproducen en este orden. VR Box admite transiciones con el mismo celular; una sesión Quest debe ser íntegramente Quest.</p></div><div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:w-auto"><select defaultValue="" onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); if (template) { setValues((current) => { const result = appendExerciseTemplate(current, template.config); setSelected(result.selectedIndex); return result.values }) } event.target.value = ''; clearExerciseError() }} className="min-w-0 max-w-full rounded-2xl border border-[#E9E7E7] bg-white px-3 text-xs font-black text-[#2F2F2F]"><option value="">Agregar desde biblioteca…</option>{templateGroups.map((group) => <optgroup key={group.id} label={group.label}>{group.templates.map((template) => <option key={template.id} value={template.id}>{template.config.clinicalProtocol === 'pppd' ? `Nivel ${template.config.progressionLevel} · ` : ''}{template.name.replace(/^PPPD · (Habituación visual|Optocinético|Funcional) · /, '')}</option>)}</optgroup>)}</select><button type="button" onClick={() => setValues((current) => { const exercises = [...current.exercises, { ...defaultExerciseConfig, name: `Ejercicio ${current.exercises.length + 1}` }]; setSelected(exercises.length - 1); return { ...current, exercises } })} className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-xs font-black text-[#2F2F2F]"><Plus size={16}/> Nuevo</button></div></div>
        <SessionSequenceWarning exercises={values.exercises} onReorder={(exercises) => { setValues((current) => ({ ...current, exercises })); setSelected(0) }}/>
        <div className="mb-5 flex max-w-full gap-3 overflow-x-auto pb-2">{values.exercises.map((exercise, index) => <button key={`${exercise.name}-${index}`} type="button" onClick={() => setSelected(index)} className={`min-w-48 rounded-2xl border p-4 text-left ${selected === index ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E9E7E7] bg-white'}`}><span className="text-[10px] font-black uppercase text-[#E49A02]">Ejercicio {index + 1}</span><p className="mt-2 truncate text-sm font-black text-[#2F2F2F]">{exercise.name}</p><p className="mt-1 text-xs text-[#747474]">{exercise.doseMode === 'time' ? `${exercise.durationSeconds}s` : `${exercise.targetRepetitions} rep.`} × {exercise.rounds}{exercise.displayMode === 'vr_box' ? ' · VR Box' : exercise.displayMode === 'quest_browser' ? ' · Quest' : ''}</p></button>)}</div>
        <div className="mb-4 flex gap-2"><button type="button" onClick={() => move(-1)} className="rounded-xl border border-[#E9E7E7] p-2" aria-label="Mover antes"><ArrowUp size={16}/></button><button type="button" onClick={() => move(1)} className="rounded-xl border border-[#E9E7E7] p-2" aria-label="Mover después"><ArrowDown size={16}/></button><button type="button" onClick={() => setValues((current) => ({ ...current, exercises: [...current.exercises, { ...current.exercises[selected], name: `${current.exercises[selected].name} (copia)` }] }))} className="rounded-xl border border-[#E9E7E7] p-2" aria-label="Duplicar"><Copy size={16}/></button><button type="button" disabled={values.exercises.length === 1} onClick={() => { setValues((current) => ({ ...current, exercises: current.exercises.filter((_, index) => index !== selected) })); setSelected(Math.max(0, selected - 1)) }} className="rounded-xl border border-[#eccfd2] p-2 text-[#a94952] disabled:opacity-30" aria-label="Eliminar"><Trash2 size={16}/></button></div>
        {errors.exercises && <p className="mb-4 text-sm font-bold text-[#a94952]">{errors.exercises}</p>}
        {values.exercises[selected] && <SessionExerciseEditor config={values.exercises[selected]} isFirst={selected === 0} setting={values.mode} onChange={updateExercise}/>}
      </section>}

      {errors.form && <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{errors.form}</p>}
      <div className="sticky bottom-0 z-10 -mx-4 flex border-t border-[#E9E7E7] bg-[#F7F6F4]/95 px-4 py-3 backdrop-blur sm:bottom-4 sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"><button disabled={create.isPending || update.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] px-6 py-4 text-sm font-black text-white shadow-xl sm:w-auto"><Save size={17}/>{isEditing ? update.isPending ? 'Guardando…' : 'Guardar cambios' : create.isPending ? 'Asignando…' : values.kind === 'free_note' ? 'Crear sesión libre' : 'Guardar y asignar sesión'}</button></div>
    </form>}
  </div>
}
