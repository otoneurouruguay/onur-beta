import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseBuilderPage } from './ExerciseBuilderPage'

vi.mock('../features/templates/hooks', async () => {
  const { defaultExerciseConfig } = await vi.importActual<typeof import('../features/exercise/types')>('../features/exercise/types')
  const templates = [
    {
      id: 'template-library-one',
      name: 'Biblioteca uno',
      config: { ...defaultExerciseConfig, name: 'Biblioteca uno' },
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    },
    {
      id: 'template-library-two',
      name: 'Biblioteca dos',
      config: { ...defaultExerciseConfig, name: 'Biblioteca dos', durationSeconds: 45 },
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    },
    {
      id: 'template-pppd',
      name: 'PPPD · habituación visual',
      config: { ...defaultExerciseConfig, name: 'PPPD · habituación visual', purpose: 'visual_habituation' as const, clinicalProtocol: 'pppd' as const, backgroundType: 'bars' as const, backgroundSpeed: 25 },
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    },
    {
      id: 'template-cardboard',
      name: 'Seguimiento Cardboard',
      config: { ...defaultExerciseConfig, name: 'Seguimiento Cardboard', purpose: 'smooth_pursuit' as const, displayMode: 'vr_box' as const, cardboardEnabled: true, objectMode: 'tracking' as const },
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    },
    {
      id: 'template-functional',
      name: 'Marcha guiada',
      config: { ...defaultExerciseConfig, name: 'Marcha guiada', kind: 'guided_physical' as const, purpose: 'guided_functional' as const, doseMode: 'repetitions' as const, objectEnabled: false },
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    },
    {
      id: 'template-quest',
      name: '360° · supermercado',
      config: { ...defaultExerciseConfig, name: '360° · supermercado', purpose: 'immersive_context' as const, displayMode: 'quest_browser' as const, objectEnabled: false },
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    },
  ]
  return {
    useExerciseTemplates: () => ({ data: templates }),
    useSaveExerciseTemplate: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useDeleteExerciseTemplate: () => ({ mutateAsync: vi.fn() }),
  }
})

vi.mock('../features/patients/hooks', () => ({ usePatients: () => ({ data: [] }) }))
vi.mock('../features/clinicalRecommendations/PathologyRecommendations', () => ({
  PathologyRecommendations: () => <div>Orientación por patología</div>,
}))
vi.mock('../features/sessions/SessionExerciseEditor', () => ({
  SessionExerciseEditor: ({ config }: { config: { name: string } }) => <div data-testid="exercise-editor">{config.name}</div>,
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderBuilder() {
  return render(
    <MemoryRouter initialEntries={['/app/ejercicios']}>
      <ExerciseBuilderPage />
    </MemoryRouter>,
  )
}

describe('ExerciseBuilderPage library selection', () => {
  it('acumula ejercicios de la biblioteca en la selección de la sesión', () => {
    renderBuilder()

    const library = screen.getByLabelText('Elegir plantilla')
    fireEvent.change(library, { target: { value: 'template-library-one' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la selección' }))

    expect(screen.getByText('1 ejercicio')).toBeInTheDocument()
    let selection = screen.getByRole('list', { name: 'Ejercicios seleccionados para la sesión' })
    expect(within(selection).getByText('Biblioteca uno')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ya está en la selección' })).toBeDisabled()

    fireEvent.change(library, { target: { value: 'template-library-two' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la selección' }))

    expect(screen.getByText('2 ejercicios')).toBeInTheDocument()
    selection = screen.getByRole('list', { name: 'Ejercicios seleccionados para la sesión' })
    expect(within(selection).getByText('Biblioteca uno')).toBeInTheDocument()
    expect(within(selection).getByText('Biblioteca dos')).toBeInTheDocument()
  })

  it('combina filtros de dispositivo, objetivo y estímulo', () => {
    renderBuilder()

    fireEvent.change(screen.getByLabelText('Filtrar por dispositivo'), { target: { value: 'cardboard' } })
    fireEvent.change(screen.getByLabelText('Filtrar por objetivo'), { target: { value: 'smooth_pursuit' } })
    fireEvent.change(screen.getByLabelText('Filtrar por tipo de estímulo'), { target: { value: 'moving_target' } })

    expect(screen.getByLabelText('Buscar y filtrar ejercicios')).toHaveTextContent('1 de 6 ejercicios')
    expect(screen.getByRole('option', { name: 'Seguimiento Cardboard' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Biblioteca uno' })).not.toBeInTheDocument()
  })

  it('mantiene la selección de sesión aunque la búsqueda oculte la biblioteca', () => {
    renderBuilder()

    const library = screen.getByLabelText('Elegir plantilla')
    fireEvent.change(library, { target: { value: 'template-library-one' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la selección' }))
    fireEvent.change(screen.getByLabelText('Buscar ejercicio'), { target: { value: 'sin coincidencias' } })

    expect(screen.getByText('No hay ejercicios que coincidan')).toBeInTheDocument()
    const selection = screen.getByRole('list', { name: 'Ejercicios seleccionados para la sesión' })
    expect(within(selection).getByText('Biblioteca uno')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros y mostrar toda la biblioteca' }))
    expect(screen.getByRole('option', { name: 'Biblioteca dos' })).toBeInTheDocument()
  })
})
