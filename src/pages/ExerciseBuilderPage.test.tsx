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
})
