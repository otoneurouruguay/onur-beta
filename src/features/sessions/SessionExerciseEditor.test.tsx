import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARDBOARD_VIEWER_PROFILE_STORAGE_KEY } from '../exercise/cardboardViewerProfiles'
import { defaultExerciseConfig, type ExerciseConfig } from '../exercise/types'
import { SessionExerciseEditor } from './SessionExerciseEditor'

vi.mock('../exercise/ExerciseCanvas', () => ({ ExerciseCanvas: () => <div>Vista visual</div> }))
vi.mock('../exercise/StereoscopicExerciseCanvas', () => ({ StereoscopicExerciseCanvas: () => <div>Vista binocular VR</div> }))
vi.mock('../exercise/ExercisePlayer', () => ({ ExercisePlayer: () => <div>Reproductor</div> }))
vi.mock('../immersive/ImmersivePanorama', () => ({ ImmersivePanorama: () => <div>Vista panorámica</div> }))

beforeEach(() => localStorage.clear())
afterEach(cleanup)

function EditorHarness({ setting = 'unspecified' }: { setting?: 'home' | 'in_person' | 'unspecified' }) {
  const [config, setConfig] = useState<ExerciseConfig>(defaultExerciseConfig)
  return <SessionExerciseEditor config={config} isFirst setting={setting} onChange={setConfig}/>
}

describe('creación de ejercicios', () => {
  it('VR Box fuerza tiempo y avance automático sin controles externos', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'optokinetic' } })
    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: 'vr_box' } })

    expect(screen.getByRole('button', { name: 'Por repeticiones' })).toBeDisabled()
    expect(screen.getByLabelText('Avance')).toBeDisabled()
    expect(screen.getByLabelText('Avance')).toHaveValue('automatic')
    expect(screen.getByText(/No usa botones, mirada ni controles externos/)).toBeInTheDocument()
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()
    expect(screen.getByText('Vista binocular VR')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Metrónomo' })).toBeDisabled()
    const cardboard = screen.getByRole('checkbox', { name: 'Habilitar perfil Cardboard' })
    expect(cardboard).not.toBeChecked()
    fireEvent.click(cardboard)
    expect(cardboard).toBeChecked()
    expect(document.body).toHaveTextContent('corrección radial')
  })

  it('Quest clínico fuerza dosis por tiempo y avance automático', () => {
    render(<EditorHarness setting="in_person"/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'saccades' } })
    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: 'quest_browser' } })

    expect(screen.getByRole('button', { name: 'Por repeticiones' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Por tiempo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Avance')).toBeDisabled()
    expect(screen.getByLabelText('Avance')).toHaveValue('automatic')
    expect(screen.getByText(/todavía no inicia WebXR/i)).toBeInTheDocument()
  })

  it('permite preparar una plantilla 360° para Quest sin asociarla todavía a un domicilio', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'immersive_context' } })

    expect(screen.getByRole('option', { name: 'Meta Quest · WebXR inmersivo' })).not.toBeDisabled()
    expect(screen.getByRole('option', { name: 'VR Box · esfera 360° con Cardboard 3DoF' })).not.toBeDisabled()
    expect(screen.getByLabelText('Modo')).toHaveValue('quest_browser')
    expect(screen.getByText('Vista panorámica')).toBeInTheDocument()
  })

  it('al elegir ejercicio físico muestra postura, superficie y supervisión', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'guided_physical' } })

    expect(screen.getByLabelText('Postura')).toBeInTheDocument()
    expect(screen.getByLabelText('Superficie')).toBeInTheDocument()
    expect(screen.getByLabelText('Supervisión')).toBeInTheDocument()
    expect(screen.queryByText('Fondo visual')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Modo')).toHaveValue('standard')
  })

  it('ofrece RVO x1 solo mediante Cardboard y mantiene tareas físicas fuera de visores', () => {
    render(<EditorHarness/>)
    expect(screen.getByRole('option', { name: /VR Box/ })).not.toBeDisabled()
    expect(screen.getByRole('option', { name: /Meta Quest/ })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: 'vr_box' } })
    expect(screen.getByText('Configuración bloqueada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Habilitar perfil Cardboard' }))
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'guided_physical' } })
    expect(screen.getByRole('option', { name: /VR Box/ })).toBeDisabled()
    expect(screen.getByRole('option', { name: /Meta Quest/ })).toBeDisabled()
  })

  it('guarda perfiles ópticos diferentes por combinación teléfono y visor', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: 'vr_box' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Habilitar perfil Cardboard' }))

    fireEvent.change(screen.getByLabelText('Nombre del perfil óptico'), { target: { value: 'Celular A · VR Box 1' } })
    fireEvent.change(screen.getByLabelText('Separación binocular'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Centro vertical'), { target: { value: '-3' } })
    fireEvent.change(screen.getByLabelText('Campo visual horizontal'), { target: { value: '96' } })
    fireEvent.change(screen.getByLabelText('Corrección de lente'), { target: { value: '24' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo perfil' }))

    expect(screen.getByLabelText('Perfil óptico Cardboard')).toHaveDisplayValue('Perfil 2')
    const stored = localStorage.getItem(CARDBOARD_VIEWER_PROFILE_STORAGE_KEY) ?? ''
    expect(stored).toContain('Celular A · VR Box 1')
    expect(stored).toContain('"imageSeparationPercent":6')
    expect(stored).toContain('"verticalOffsetPercent":-3')
    expect(stored).toContain('"horizontalFovDegrees":96')
    expect(stored).toContain('"lensDistortionPercent":24')
  })

  it.each(['gaze_stabilization_x2', 'gaze_substitution_remembered'])('mantiene %s fuera de visores sin referencia espacial', (purpose) => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: purpose } })
    expect(screen.getByRole('option', { name: /VR Box/ })).toBeDisabled()
    expect(screen.getByRole('option', { name: /Meta Quest/ })).toBeDisabled()
  })

  it('ofrece modo Libre con advertencia y conserva combinaciones arbitrarias', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'custom_free' } })
    fireEvent.change(screen.getByLabelText('Fondo'), { target: { value: 'spiral' } })
    fireEvent.change(screen.getByLabelText('Comportamiento'), { target: { value: 'saccades' } })
    expect(screen.getByText('Configuración Libre · sin validación clínica')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /VR Box/ })).not.toBeDisabled()
    expect(screen.getByLabelText('Fondo')).toHaveValue('spiral')
    expect(screen.getByLabelText('Comportamiento')).toHaveValue('saccades')
  })

  it('ofrece diagonales para pelota y barras, pero no para la espiral', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'custom_free' } })
    fireEvent.change(screen.getByLabelText('Fondo'), { target: { value: 'bars' } })
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'up_right' } })
    fireEvent.change(screen.getByLabelText('Comportamiento'), { target: { value: 'tracking' } })
    const directions = screen.getAllByLabelText('Dirección')
    fireEvent.change(directions[1], { target: { value: 'diagonal_up' } })
    expect(directions[0]).toHaveValue('up_right')
    expect(directions[1]).toHaveValue('diagonal_up')

    fireEvent.change(screen.getByLabelText('Fondo'), { target: { value: 'spiral' } })
    expect(screen.getAllByLabelText('Dirección')[0]).toHaveValue('clockwise')
    expect(screen.queryByRole('option', { name: 'Diagonal ↗' })).not.toBeInTheDocument()
  })

  it.each(['solid', 'bars', 'spiral', 'checkerboard', 'dots'])('permite seleccionar el fondo %s', (backgroundType) => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Fondo'), { target: { value: backgroundType } })
    expect(screen.getByLabelText('Fondo')).toHaveValue(backgroundType)
  })

  it.each([
    ['rare_target', /Contá mentalmente cuántas veces/],
    ['go_no_go', /Decí “sí” solamente/],
    ['short_memory', /Decí “igual” solamente/],
  ])('configura %s con consigna previa, tiempo y confirmación manual', (mode, instruction) => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Tipo de tarea cognitiva'), { target: { value: mode } })
    expect(screen.getAllByText(instruction).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Por repeticiones' })).toBeDisabled()
    expect(screen.getByLabelText('Avance')).toBeDisabled()
    expect(screen.getByLabelText('Avance')).toHaveValue('manual')
    expect(screen.getByRole('option', { name: /VR Box/ })).toBeDisabled()
  })

  it('habilita respuesta táctil en tarea cognitiva aislada pero no durante RVO', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Tipo de tarea cognitiva'), { target: { value: 'go_no_go' } })
    expect(screen.getByRole('option', { name: 'Tocar botón en pantalla' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'cognitive_visual' } })
    expect(screen.getByRole('option', { name: 'Tocar botón en pantalla' })).not.toBeDisabled()
  })
})
