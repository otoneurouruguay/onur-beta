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
  return <><SessionExerciseEditor config={config} isFirst setting={setting} onChange={setConfig}/><output data-testid="cardboard-profile-snapshot">{JSON.stringify(config.cardboardViewerProfile ?? null)}</output></>
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
    expect(screen.getByRole('checkbox', { name: 'Metrónomo con sonido' })).toBeDisabled()
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

  it('habilita WebXR procedural con parámetros angulares solo para una finalidad compatible', () => {
    render(<EditorHarness setting="in_person"/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'optokinetic' } })
    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: 'quest_browser' } })

    const immersive = screen.getByRole('button', { name: 'Inmersivo WebXR' })
    expect(immersive).not.toBeDisabled()
    fireEvent.click(immersive)
    expect(immersive).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByText('Parámetros WebXR avanzados'))
    expect(screen.getByLabelText('Velocidad angular Quest')).toBeInTheDocument()
    expect(screen.getByLabelText('Tamaño angular del patrón Quest')).toBeInTheDocument()
    expect(screen.getByText(/una sola inmersión durante toda la batería/i)).toBeInTheDocument()
  })

  it('permite preparar una plantilla 360° para Quest sin asociarla todavía a un domicilio', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'immersive_context' } })

    expect(screen.getByRole('option', { name: 'Meta Quest · WebXR inmersivo' })).not.toBeDisabled()
    expect(screen.getByRole('option', { name: 'VR Box · esfera 360° con Cardboard 3DoF' })).not.toBeDisabled()
    expect(screen.getByLabelText('Modo')).toHaveValue('quest_browser')
    expect(screen.getByText('Vista panorámica')).toBeInTheDocument()
  })

  it('configura audio Quest y una referencia espacial sin habilitarlos por defecto', () => {
    render(<EditorHarness setting="in_person"/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'immersive_context' } })
    fireEvent.change(screen.getByLabelText('Escenario clínico 360°'), { target: { value: 'cafe_comfy' } })
    const target = screen.getByRole('checkbox', { name: 'Referencia espacial fija' })
    const audio = screen.getByRole('checkbox', { name: 'Sonido ambiente' })
    expect(target).not.toBeChecked()
    expect(audio).not.toBeChecked()
    expect(audio).not.toBeDisabled()
    fireEvent.click(target)
    fireEvent.click(audio)
    expect(screen.getByLabelText('Color de referencia espacial')).toBeInTheDocument()
    expect(screen.getByText('Volumen: 20%')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: 'vr_box' } })
    expect(screen.getByRole('checkbox', { name: 'Sonido ambiente' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sonido ambiente' })).toBeDisabled()
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()
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
    expect(screen.getByTestId('cardboard-profile-snapshot')).toHaveTextContent('"imageSeparationPercent":6')
    expect(screen.getByTestId('cardboard-profile-snapshot')).toHaveTextContent('"verticalOffsetPercent":-3')
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

  it('ofrece seguimiento ocular muy lento, lento, medio y rápido', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'smooth_pursuit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Muy lento' }))
    expect(screen.getByLabelText('Velocidad de seguimiento ocular')).toHaveValue('0.1')
    fireEvent.click(screen.getByRole('button', { name: 'Rápido' }))
    expect(screen.getByLabelText('Velocidad de seguimiento ocular')).toHaveValue('1')
  })

  it('configura fijación con fondo móvil como una tarea distinta de RVO x1', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'visual_motion_fixation' } })
    expect(screen.getByLabelText('Fondo')).toHaveValue('bars')
    expect(screen.getByLabelText('Comportamiento')).toHaveValue('fixed')
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()
    expect(document.body).toHaveTextContent('No es RVO x1')
  })

  it('configura movimiento oscilante, rampa, cobertura y contraste sin confundirlos con velocidad continua', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'visual_motion_fixation' } })
    expect(screen.getByLabelText('Movimiento del fondo')).toHaveValue('continuous')
    expect(screen.getByLabelText('Velocidad de fondo')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Movimiento del fondo'), { target: { value: 'oscillating' } })
    expect(screen.queryByLabelText('Velocidad de fondo')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Frecuencia de oscilación del fondo'), { target: { value: '0.4' } })
    fireEvent.change(screen.getByLabelText('Amplitud de oscilación del fondo'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Entrada gradual del fondo'), { target: { value: '2.5' } })
    fireEvent.change(screen.getByLabelText('Cobertura central del fondo'), { target: { value: '70' } })
    fireEvent.change(screen.getByLabelText('Contraste relativo del patrón'), { target: { value: '55' } })

    expect(screen.getByLabelText('Frecuencia de oscilación del fondo')).toHaveValue('0.4')
    expect(screen.getByLabelText('Amplitud de oscilación del fondo')).toHaveValue('30')
    expect(screen.getByLabelText('Entrada gradual del fondo')).toHaveValue('2.5')
    expect(screen.getByLabelText('Cobertura central del fondo')).toHaveValue('70')
    expect(screen.getByLabelText('Contraste relativo del patrón')).toHaveValue('55')
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()
  })

  it('configura seguimiento con fondo móvil como conflicto visual combinado', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'pursuit_visual_conflict' } })
    expect(screen.getByLabelText('Fondo')).toHaveValue('bars')
    expect(screen.getByLabelText('Comportamiento')).toHaveValue('tracking')
    expect(screen.getByLabelText('Velocidad de seguimiento ocular')).toBeInTheDocument()
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()
    expect(document.body).toHaveTextContent('tarea combinada de conflicto visual')
  })

  it('sincroniza eje y frecuencia al elegir contrafase real', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'pursuit_visual_conflict' } })
    fireEvent.change(screen.getByLabelText('Relación blanco y fondo'), { target: { value: 'counter_phase' } })
    expect(screen.getByLabelText('Movimiento del fondo')).toHaveValue('oscillating')
    expect(screen.getByLabelText('Movimiento del fondo')).toBeDisabled()
    expect(screen.getByLabelText('Frecuencia de oscilación del fondo')).toHaveValue('0.5')
    fireEvent.change(screen.getByLabelText('Velocidad de seguimiento ocular'), { target: { value: '0.3' } })
    expect(screen.getByLabelText('Frecuencia de oscilación del fondo')).toHaveValue('0.3')
    const directions = screen.getAllByLabelText('Dirección')
    fireEvent.change(directions[1], { target: { value: 'vertical' } })
    expect(directions[0]).toHaveValue('down')
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()
    expect(document.body).toHaveTextContent('en contrafase')
  })

  it('configura flujo óptico radial como una finalidad propia', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'optic_flow' } })
    expect(screen.getByLabelText('Fondo')).toHaveValue('radial_flow')
    expect(screen.getByLabelText('Dirección')).toHaveValue('toward')
    expect(screen.getByRole('checkbox', { name: 'Mostrar blanco' })).not.toBeChecked()
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()
    expect(document.body).toHaveTextContent('No representa marcha')
  })

  it('configura metrónomo desde ritmos muy bajos a muy altos y tonos graves o agudos', () => {
    render(<EditorHarness/>)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Metrónomo con sonido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Muy bajo' }))
    expect(screen.getByLabelText('Ritmo del metrónomo')).toHaveValue('0.25')
    fireEvent.change(screen.getByLabelText('Tono del metrónomo'), { target: { value: '1320' } })
    expect(screen.getByLabelText('Tono del metrónomo')).toHaveValue('1320')
  })

  it('habilita intermitencia estroboscópica con límites visibles y visor bloqueado', () => {
    render(<EditorHarness setting="in_person"/>)
    fireEvent.click(screen.getByRole('checkbox', { name: /Intermitencia visual estroboscópica/ }))
    expect(screen.getByLabelText('Frecuencia estroboscópica')).toHaveValue('1')
    expect(screen.getByText('Intermitencia pausada en la vista previa')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /VR Box/ })).toBeDisabled()
    expect(screen.getByText('Configuración coherente')).toBeInTheDocument()
  })

  it('permite secuencias de imágenes rápidas hasta 0,75 segundos', () => {
    render(<EditorHarness/>)
    fireEvent.change(screen.getByLabelText('Objetivo del ejercicio'), { target: { value: 'cognitive_visual' } })
    fireEvent.click(screen.getByRole('button', { name: 'Imágenes rápida' }))
    expect(screen.getByLabelText('Velocidad de imágenes')).toHaveValue('0.75')
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
