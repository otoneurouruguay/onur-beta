import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExercisePlayer } from './ExercisePlayer'
import { applyExercisePurpose } from './compatibility'
import { defaultExerciseConfig } from './types'

vi.mock('./ExerciseCanvas', () => ({ ExerciseCanvas: () => <div>Vista visual</div> }))
vi.mock('./StereoscopicExerciseCanvas', () => ({ StereoscopicExerciseCanvas: () => <div>Vista VR</div> }))

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('avance del reproductor', () => {
  it('finaliza automáticamente un ejercicio VR Box por tiempo', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<ExercisePlayer config={{ ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'), displayMode: 'vr_box', doseMode: 'time', advanceMode: 'automatic', durationSeconds: 1, preparationSeconds: 0 }} onExit={vi.fn()} onComplete={onComplete}/>)

    expect(screen.getByText('Vista VR')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pantalla completa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salir' })).not.toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(1_000) })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete.mock.calls[0][1]).toMatchObject({ doseMode: 'time', completion: 'target_completed' })
  })

  it('Cardboard muestra los controles al tocar la pantalla y vuelve a ocultarlos', async () => {
    vi.useFakeTimers()
    const onSkip = vi.fn()
    const onExit = vi.fn()
    render(<ExercisePlayer config={{ ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'), displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic', durationSeconds: 30, preparationSeconds: 0 }} onExit={onExit} onSkip={onSkip}/>)

    expect(screen.queryByRole('button', { name: 'Pausar · lado izquierdo' })).not.toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('application'))
    expect(screen.getByRole('button', { name: 'Pausar · lado izquierdo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Omitir ejercicio · lado izquierdo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salir de la sesión · lado derecho' })).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(3_000) })
    expect(screen.queryByRole('button', { name: 'Pausar · lado izquierdo' })).not.toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole('application'))
    fireEvent.click(screen.getByRole('button', { name: 'Pausar · lado izquierdo' }))
    expect(screen.getByRole('button', { name: 'Continuar · lado derecho' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Omitir ejercicio · lado derecho' }))

    expect(onSkip).toHaveBeenCalledWith(0, expect.objectContaining({ doseMode: 'time', completion: 'skipped' }))
    expect(onExit).not.toHaveBeenCalled()
  })

  it('Cardboard permite salir de la sesión desde cualquiera de los dos lados', () => {
    const onExit = vi.fn()
    render(<ExercisePlayer config={{ ...applyExercisePurpose(defaultExerciseConfig, 'saccades'), displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic', preparationSeconds: 0 }} onExit={onExit}/>)

    fireEvent.pointerDown(screen.getByRole('application'))
    fireEvent.click(screen.getByRole('button', { name: 'Salir de la sesión · lado izquierdo' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('pide confirmación al finalizar un ejercicio 2D por tiempo con avance manual', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<ExercisePlayer config={{ ...defaultExerciseConfig, doseMode: 'time', advanceMode: 'manual', durationSeconds: 1, preparationSeconds: 0 }} onExit={vi.fn()} onComplete={onComplete}/>)

    await act(async () => { vi.advanceTimersByTime(1_000) })
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('en repeticiones acepta una cantidad parcial', () => {
    const onComplete = vi.fn()
    render(<ExercisePlayer config={{ ...defaultExerciseConfig, doseMode: 'repetitions', targetRepetitions: 8, preparationSeconds: 0 }} onExit={vi.fn()} onComplete={onComplete}/>)

    fireEvent.click(screen.getByRole('button', { name: 'Informar finalización' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hice menos' }))
    fireEvent.change(screen.getByLabelText('Repeticiones realizadas aproximadamente'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y continuar' }))

    expect(onComplete).toHaveBeenCalledWith(0, expect.objectContaining({ doseMode: 'repetitions', completion: 'partial', targetRepetitions: 8, reportedRepetitions: 5 }))
  })

  it('impide ejecutar un RVO x1 heredado dentro de VR Box', () => {
    const onExit = vi.fn()
    render(<ExercisePlayer config={{ ...defaultExerciseConfig, displayMode: 'vr_box', advanceMode: 'automatic' }} onExit={onExit}/>)
    expect(screen.getByRole('alert')).toHaveTextContent('el blanco está unido al celular y acompaña la cabeza')
    fireEvent.click(screen.getByRole('button', { name: 'Salir y avisar al profesional' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('muestra la consigna antes de iniciar y registra el conteo de objetivo raro', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const config = { ...applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual'), durationSeconds: 1, preparationSeconds: 0 as const, cognitiveStimulusSeconds: 1 }
    render(<ExercisePlayer config={config} onExit={vi.fn()} onComplete={onComplete}/>)
    expect(screen.getByText('Consigna antes de comenzar')).toBeInTheDocument()
    expect(screen.getByText(/Contá mentalmente cuántas veces/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Entendí la consigna/ }))
    await act(async () => { vi.advanceTimersByTime(1_000) })
    fireEvent.change(screen.getByLabelText('Total que contaste'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar respuesta y continuar' }))
    expect(onComplete.mock.calls[0][1]).toMatchObject({ cognitive: { mode: 'rare_target', responseMode: 'count_at_end', reportedCount: 2 } })
  })

  it('registra aciertos y respuestas fuera del objetivo en Go/No-Go táctil', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const config = { ...applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual'), cognitiveTaskMode: 'go_no_go' as const, cognitiveResponseMode: 'screen_tap' as const, durationSeconds: 3, preparationSeconds: 0 as const, cognitiveStimulusSeconds: 1 }
    render(<ExercisePlayer config={config} onExit={vi.fn()} onComplete={onComplete}/>)
    fireEvent.click(screen.getByRole('button', { name: /Entendí la consigna/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
    await act(async () => { vi.advanceTimersByTime(2_000) })
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
    await act(async () => { vi.advanceTimersByTime(1_000) })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onComplete.mock.calls[0][1]).toMatchObject({ cognitive: { mode: 'go_no_go', responseMode: 'screen_tap', responseCount: 2, correctResponses: 1, falseAlarms: 1 } })
  })

  it('presenta una consigna verbal implementable para memoria breve', () => {
    const config = { ...applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual'), cognitiveTaskMode: 'short_memory' as const, cognitiveResponseMode: 'verbal' as const, cognitiveMemorySpan: 1 as const, preparationSeconds: 0 as const }
    render(<ExercisePlayer config={config} onExit={vi.fn()}/>)
    expect(screen.getByText(/Decí “igual” solamente cuando la figura actual/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
  })
})
