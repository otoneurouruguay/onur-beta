import type { ExerciseTemplateRecord } from './repository'

export interface ExerciseTemplateGroup {
  id: string
  label: string
  templates: ExerciseTemplateRecord[]
}

export function groupExerciseTemplates(templates: ExerciseTemplateRecord[]): ExerciseTemplateGroup[] {
  const definitions = [
    { id: 'pppd-habituation', label: 'PPPD · Habituación visual', matches: (item: ExerciseTemplateRecord) => item.config.clinicalProtocol === 'pppd' && item.config.purpose === 'visual_habituation' },
    { id: 'pppd-optokinetic', label: 'PPPD · Optocinético', matches: (item: ExerciseTemplateRecord) => item.config.clinicalProtocol === 'pppd' && item.config.purpose === 'optokinetic' },
    { id: 'pppd-functional', label: 'PPPD · Funcional', matches: (item: ExerciseTemplateRecord) => item.config.clinicalProtocol === 'pppd' && item.config.purpose === 'guided_functional' },
    { id: 'stroboscopic-experimental', label: 'Estroboscópicos · experimental', matches: (item: ExerciseTemplateRecord) => item.config.clinicalProtocol === 'stroboscopic_experimental' },
    { id: 'rapid-images', label: 'Imágenes rápidas · cognitivo-visual', matches: (item: ExerciseTemplateRecord) => item.id.startsWith('template-rapid-images-') },
    { id: 'immersive-context', label: 'Exposición contextual 360° · clínica', matches: (item: ExerciseTemplateRecord) => item.config.purpose === 'immersive_context' },
    { id: 'personal', label: 'Mis plantillas', matches: (item: ExerciseTemplateRecord) => !item.id.startsWith('template-') },
    { id: 'general', label: 'Plantillas generales', matches: (item: ExerciseTemplateRecord) => item.id.startsWith('template-') && !item.id.startsWith('template-rapid-images-') && !item.config.clinicalProtocol && item.config.purpose !== 'immersive_context' },
  ]

  return definitions
    .map(({ id, label, matches }) => ({ id, label, templates: templates.filter(matches) }))
    .filter((group) => group.templates.length > 0)
}
