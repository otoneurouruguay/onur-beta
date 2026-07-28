import { BookOpen, CheckCircle2, ExternalLink, Glasses, HardDrive, MonitorPlay, Search, ShieldCheck, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { ImmersivePanorama } from '../features/immersive/ImmersivePanorama'
import { captureRequiredScenarios, immersiveMediaUrl, immersiveScenarios, type ImmersiveIntensity, type ImmersiveMotion } from '../features/immersive/catalog'

const environmentLabels = {
  street: 'Calle', crosswalk: 'Cruce', retail: 'Comercio', mall: 'Centro comercial', station: 'Estación', transit: 'Transporte', urban_ride: 'Recorrido urbano', park: 'Parque', cafe: 'Café', airport: 'Aeropuerto',
} as const
const orderedScenarios = [...immersiveScenarios].sort((a, b) => a.intensity - b.intensity)

export function ImmersiveLibraryPage() {
  const [query, setQuery] = useState('')
  const [intensity, setIntensity] = useState<0 | ImmersiveIntensity>(0)
  const [motion, setMotion] = useState<'all' | ImmersiveMotion>('all')
  const [selectedId, setSelectedId] = useState(orderedScenarios[0].id)
  const filtered = useMemo(() => orderedScenarios.filter((scenario) => {
    const text = `${scenario.title} ${scenario.shortTitle} ${scenario.clinicalUse} ${environmentLabels[scenario.environment]}`.toLocaleLowerCase()
    return text.includes(query.trim().toLocaleLowerCase()) && (!intensity || scenario.intensity === intensity) && (motion === 'all' || scenario.motion === motion)
  }), [intensity, motion, query])
  const selected = filtered.find((scenario) => scenario.id === selectedId)
    ?? filtered[0]
    ?? orderedScenarios.find((scenario) => scenario.id === selectedId)
    ?? orderedScenarios[0]

  return <div className="space-y-8">
    <PageHeader eyebrow="Exposición contextual · clínica" title="Biblioteca 360°" description="Escenarios abiertos, técnicamente verificados y clínicamente curados. Se prescriben como complemento contextual: no son ejercicios de RVO, pruebas diagnósticas ni simulaciones de marcha." actions={<Link to="/app/pacientes" className="inline-flex items-center gap-2 rounded-2xl bg-[#E49A02] px-4 py-3 text-sm font-black text-white"><MonitorPlay size={17}/> Asignar desde un paciente</Link>}/>

    <section className="grid gap-4 lg:grid-cols-3">
      {[
        ['1', 'Elegir el contexto', 'Revisá movimiento de cámara, intensidad, límites y advertencias.'],
        ['2', 'Configurar el dispositivo', 'Quest usa WebXR. VR Box exige Cardboard 3DoF; no existe modo 360° sin seguimiento.'],
        ['3', 'Asignar escenas compatibles', 'En el perfil del paciente creá una sesión presencial y elegí uno o varios escenarios 360° para el mismo dispositivo.'],
      ].map(([step, title, text]) => <article key={step} className="rounded-2xl border border-[#E9E7E7] bg-white p-5"><span className="grid size-8 place-items-center rounded-full bg-[#FFF7E8] text-xs font-black text-[#A36B00]">{step}</span><h2 className="mt-4 text-sm font-black text-[#171717]">{title}</h2><p className="mt-2 text-xs leading-5 text-[#747474]">{text}</p></article>)}
    </section>

    <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px]"><label className="relative"><Search className="absolute left-4 top-3.5 text-[#A1A1A1]" size={16}/><input aria-label="Buscar escenario" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar calle, comercio, estación…" className="h-11 w-full rounded-2xl border border-[#E9E7E7] bg-white pl-11 pr-4 text-sm"/></label><select aria-label="Filtrar intensidad" value={intensity} onChange={(event) => setIntensity(Number(event.target.value) as 0 | ImmersiveIntensity)} className="h-11 rounded-2xl border border-[#E9E7E7] bg-white px-3 text-sm"><option value={0}>Toda intensidad</option><option value={1}>Nivel 1 · bajo</option><option value={2}>Nivel 2 · medio</option><option value={3}>Nivel 3 · alto</option></select><select aria-label="Filtrar movimiento" value={motion} onChange={(event) => setMotion(event.target.value as 'all' | ImmersiveMotion)} className="h-11 rounded-2xl border border-[#E9E7E7] bg-white px-3 text-sm"><option value="all">Cámara fija y móvil</option><option value="static">Cámara fija</option><option value="vehicle_slow">Vehículo lento</option></select></div>
    </section>

    <div className="grid gap-7 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
      <section className="grid gap-4 sm:grid-cols-2">
        {filtered.map((scenario) => <button key={scenario.id} type="button" onClick={() => setSelectedId(scenario.id)} aria-pressed={selected.id === scenario.id} className={`overflow-hidden rounded-2xl border bg-white text-left transition ${selected.id === scenario.id ? 'border-[#E49A02] shadow-[0_10px_35px_rgba(228,154,2,.12)]' : 'border-[#E9E7E7] hover:border-[#E8CE99]'}`}>
          <div className="relative aspect-[2/1] overflow-hidden bg-[#171717]"><img src={immersiveMediaUrl(scenario, 'thumbnail') || undefined} alt="" loading="lazy" decoding="async" className="size-full object-cover"/><span className="absolute left-3 top-3 rounded-full bg-black/72 px-3 py-1.5 text-[9px] font-black text-white">Nivel {scenario.intensity}/3</span><span className="absolute right-3 top-3 rounded-full bg-black/72 px-3 py-1.5 text-[9px] font-black text-white">{scenario.mediaKind === 'video' ? 'VIDEO 360°' : 'FOTO 360°'}</span></div>
          <div className="p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#A36B00]">{environmentLabels[scenario.environment]} · {scenario.motion === 'static' ? 'cámara fija' : 'vehículo lento'}</p><h2 className="mt-2 text-sm font-black leading-5 text-[#171717]">{scenario.title}</h2><p className="mt-2 line-clamp-3 text-xs leading-5 text-[#747474]">{scenario.clinicalUse}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#F0F8F3] px-2.5 py-1 text-[9px] font-black text-[#28613D]">Quest</span><span className="rounded-full bg-[#FFF7E8] px-2.5 py-1 text-[9px] font-black text-[#8A5B00]">VR Box + Cardboard</span>{scenario.ambientAudio && <span className="rounded-full bg-[#EEF3FA] px-2.5 py-1 text-[9px] font-black text-[#35567B]">audio opcional · Quest</span>}{scenario.spatialTargetAllowed && <span className="rounded-full bg-[#F4EEFA] px-2.5 py-1 text-[9px] font-black text-[#684586]">referencia opcional</span>}<span className="rounded-full bg-[#F7F6F4] px-2.5 py-1 text-[9px] font-black text-[#747474]">máx. {scenario.maximumSeconds}s</span></div></div>
        </button>)}
        {filtered.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-[#D8D5D2] p-10 text-center text-sm font-bold text-[#747474]">No hay escenarios que coincidan con esos filtros.</div>}
      </section>

      {filtered.length > 0 && <aside className="self-start overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white xl:sticky xl:top-24">
        <div className="relative aspect-video bg-[#081113]"><ImmersivePanorama key={selected.id} scenario={selected}/></div>
        <div className="p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#171717] px-3 py-1 text-[9px] font-black text-white">APROBADO</span><span className="rounded-full bg-[#FFF7E8] px-3 py-1 text-[9px] font-black text-[#8A5B00]">Intensidad {selected.intensity}/3</span></div><h2 className="mt-4 text-xl font-black text-[#171717]">{selected.title}</h2><p className="mt-3 text-xs leading-5 text-[#747474]">{selected.clinicalUse}</p>
          <div className="mt-5 rounded-2xl bg-[#171717] p-4 text-white"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#EFB33A]">Consigna inicial</p><p className="mt-2 text-sm font-black leading-6">{selected.patientInstruction}</p></div>
          <ul className="mt-4 space-y-2 rounded-2xl bg-[#FFF7E8] p-4 text-[11px] font-bold leading-5 text-[#8A5B00]">{selected.cautions.map((caution) => <li key={caution}>• {caution}</li>)}</ul>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><Link to={`/app/ejercicios?scenario=${selected.id}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#E49A02] px-4 text-xs font-black text-white"><Glasses size={16}/> Configurar ejercicio</Link><Link to="/app/pacientes" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E9E7E7] px-4 text-xs font-black text-[#2F2F2F]"><MonitorPlay size={16}/> Elegir paciente</Link></div>
          <details className="mt-5 rounded-2xl border border-[#E9E7E7] p-4"><summary className="cursor-pointer text-xs font-black text-[#2F2F2F]">Licencia, autor y control técnico</summary><dl className="mt-4 grid gap-3 text-[11px] leading-5 text-[#747474]"><div><dt className="font-black text-[#2F2F2F]">Autor y licencia</dt><dd>{selected.source.author} · {selected.source.provider} · {selected.source.license}</dd></div><div><dt className="font-black text-[#2F2F2F]">Derivados</dt><dd>Quest {selected.derivatives.quest.width}×{selected.derivatives.quest.height} · VR Box {selected.derivatives.vr_box.width}×{selected.derivatives.vr_box.height}{selected.mediaKind === 'video' ? ` · ${selected.derivatives.quest.fps} FPS · ${selected.derivatives.quest.codec}` : ''}</dd></div>{selected.ambientAudio && <div><dt className="font-black text-[#2F2F2F]">Audio opcional</dt><dd>{selected.ambientAudio.source.author} · {selected.ambientAudio.source.license} · {selected.ambientAudio.source.changes}</dd></div>}<div><dt className="font-black text-[#2F2F2F]">SHA-256 Quest</dt><dd className="break-all font-mono text-[9px]">{selected.derivatives.quest.sha256}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2"><a href={selected.source.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-[#F7F6F4] px-3 py-2 text-[10px] font-black text-[#2F2F2F]"><ExternalLink size={13}/> Fuente visual</a><a href={selected.source.licenseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-[#F7F6F4] px-3 py-2 text-[10px] font-black text-[#2F2F2F]"><ShieldCheck size={13}/> Licencia visual</a>{selected.ambientAudio && <a href={selected.ambientAudio.source.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-[#F7F6F4] px-3 py-2 text-[10px] font-black text-[#2F2F2F]"><ExternalLink size={13}/> Fuente de audio</a>}</div></details>
        </div>
      </aside>}
    </div>

    <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5 sm:p-6"><div className="flex items-center gap-3"><HardDrive className="text-[#E49A02]" size={21}/><div><h2 className="font-black text-[#171717]">Escenarios que requieren captura propia</h2><p className="mt-1 text-xs text-[#747474]">No se sustituyen por material parecido ni por videos de YouTube sin permiso de redistribución.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{captureRequiredScenarios.map((item) => <article key={item.id} className="rounded-2xl bg-[#F7F6F4] p-4"><p className="text-sm font-black text-[#2F2F2F]">{item.title}</p><p className="mt-2 text-[11px] leading-5 text-[#747474]">{item.reason}</p></article>)}</div></section>

    <section className="rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] p-5 text-[#28613D]"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0" size={20}/><div><h2 className="text-sm font-black">Gobernanza clínica conservada</h2><p className="mt-2 text-xs leading-5">Los archivos abiertos se almacenan separados de los datos de pacientes. La plataforma registra escenario, dispositivo, tiempo activo, salida u omisión; el profesional sigue definiendo indicación, techo de síntomas y reglas de detención.</p><div className="mt-3 flex flex-wrap gap-2"><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8920012/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-[10px] font-black"><BookOpen size={13}/> CPG vestibular</a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9760985/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-[10px] font-black"><Video size={13}/> RCT adultos mayores</a></div></div></div></section>
  </div>
}
