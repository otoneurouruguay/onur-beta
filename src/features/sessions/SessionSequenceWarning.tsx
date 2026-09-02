import { Glasses, MonitorUp, WandSparkles } from 'lucide-react'
import type { ExerciseConfig } from '../exercise/types'
import { analyzeSessionSequence, orderExercisesForQuest, orderExercisesForVrBox, VR_BOX_TRANSITION_SECONDS } from './sequence'

export function SessionSequenceWarning({ exercises, onReorder }: { exercises: ExerciseConfig[]; onReorder: (exercises: ExerciseConfig[]) => void }) {
  const analysis = analyzeSessionSequence(exercises)
  if (!analysis.mixesVrBoxAndNonVrBox && !analysis.mixesVrBoxProfiles && !analysis.mixesQuestAndNonQuest) return null

  return <div className="mb-5 space-y-3">
  {(analysis.mixesVrBoxAndNonVrBox || analysis.mixesVrBoxProfiles) && <aside className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-5 text-[#8A5B00]">
    <div className="flex gap-3">
      <Glasses className="mt-0.5 shrink-0" size={20}/>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{analysis.mixesVrBoxProfiles ? 'Elegí VR Box o Cardboard para toda la sesión' : 'Esta sesión mezcla ejercicios con y sin VR Box'}</p>
        {analysis.mixesVrBoxProfiles ? <p className="mt-2 text-xs leading-5">Alternar perfiles obligaría a retirar y volver a colocar el celular sin aportar al objetivo del ejercicio. Aplicá el mismo perfil de visor a todos los ejercicios binoculares.</p> : <>
          <p className="mt-2 text-xs leading-5">Las repeticiones y las pantallas 2D se realizan con el celular fuera del visor. La plataforma agregará {VR_BOX_TRANSITION_SECONDS} segundos para colocar o retirar el visor en cada cambio.</p>
          <p className="mt-2 text-xs font-bold">{analysis.optimizedForVrBox ? `El orden actual deja un único bloque VR al final y requiere ${analysis.visorChanges} cambios de visor.` : `El orden actual requiere ${analysis.visorChanges} cambios de visor. Se recomienda realizar primero todas las tareas sin visor y dejar un único bloque VR para el final.`}</p>
          {!analysis.optimizedForVrBox && <button type="button" onClick={() => onReorder(orderExercisesForVrBox(exercises))} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#8A5B00] px-4 py-3 text-xs font-black text-white"><WandSparkles size={15}/> Agrupar el bloque VR al final</button>}
        </>}
      </div>
    </div>
  </aside>}
  {analysis.mixesQuestAndNonQuest && <aside className="rounded-2xl border border-[#B8D8C3] bg-[#F0F8F3] p-5 text-[#28613D]">
    <div className="flex gap-3">
      <MonitorUp className="mt-0.5 shrink-0" size={20}/>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">Sesión mixta: pantalla profesional y Quest</p>
        <p className="mt-2 text-xs leading-5">La plataforma ejecutará primero las tareas sin Quest en la PC. Después mostrará una transición, enviará únicamente el bloque Quest al visor y combinará ambos resultados en el cierre.</p>
        <p className="mt-2 text-xs font-bold">{analysis.questBlockAtEnd ? 'El orden actual requiere un único cambio de dispositivo.' : 'Agrupá Quest al final: no se admite volver a la PC después de colocar el visor.'}</p>
        {!analysis.questBlockAtEnd && <button type="button" onClick={() => onReorder(orderExercisesForQuest(exercises))} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#28613D] px-4 py-3 text-xs font-black text-white"><WandSparkles size={15}/> Agrupar Quest al final</button>}
      </div>
    </div>
  </aside>}
  </div>
}
