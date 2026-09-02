export interface BapAgeReference {
  minAge: number
  maxAge: number
  label: string
  conditions: readonly [number, number, number, number, number, number]
  composite: number
  sensory: {
    somatosensory: number
    visual: number
    vestibular: number
    visualPreference: number
  }
  patternUpperLimits: {
    mixedVestibularSomatosensory: number
    mixedVestibularVisual: number
    aphysiological: number
  }
}

/**
 * Valores transcriptos del paquete local seguro para desarrollo. Las
 * condiciones, el compuesto y los cocientes son límites inferiores; los
 * indicadores de patrón son límites superiores.
 */
export const BAP_AGE_REFERENCES: readonly BapAgeReference[] = [
  { minAge: 3, maxAge: 4, label: '3 a 4 años', conditions: [62.9, 62.9, 42.1, 15.6, 2.8, 1.4], composite: 31.7, sensory: { somatosensory: 100, visual: 24.8, vestibular: 4.5, visualPreference: 66.2 }, patternUpperLimits: { mixedVestibularSomatosensory: 45.6, mixedVestibularVisual: 12.8, aphysiological: 43.6 } },
  { minAge: 5, maxAge: 6, label: '5 a 6 años', conditions: [69.2, 61.8, 58.2, 34.5, 8.8, 6.1], composite: 39.8, sensory: { somatosensory: 89.3, visual: 49.9, vestibular: 12.7, visualPreference: 91.1 }, patternUpperLimits: { mixedVestibularSomatosensory: 40.5, mixedVestibularVisual: 24.8, aphysiological: 39.7 } },
  { minAge: 7, maxAge: 8, label: '7 a 8 años', conditions: [80.4, 71.6, 71.6, 43.9, 8.4, 8.4], composite: 48.1, sensory: { somatosensory: 89.1, visual: 54.6, vestibular: 10.4, visualPreference: 100 }, patternUpperLimits: { mixedVestibularSomatosensory: 39.2, mixedVestibularVisual: 25.6, aphysiological: 39.4 } },
  { minAge: 9, maxAge: 10, label: '9 a 10 años', conditions: [81.6, 77.5, 76.5, 47.9, 25.4, 6.8], composite: 52.6, sensory: { somatosensory: 95, visual: 58.7, vestibular: 31.1, visualPreference: 81 }, patternUpperLimits: { mixedVestibularSomatosensory: 44.3, mixedVestibularVisual: 31.5, aphysiological: 35.1 } },
  { minAge: 11, maxAge: 13, label: '11 a 13 años', conditions: [86.6, 85.7, 82.2, 52.2, 21.8, 23.3], composite: 58.6, sensory: { somatosensory: 99, visual: 60.3, vestibular: 25.2, visualPreference: 98.1 }, patternUpperLimits: { mixedVestibularSomatosensory: 43.6, mixedVestibularVisual: 30, aphysiological: 35.2 } },
  { minAge: 14, maxAge: 15, label: '14 a 15 años', conditions: [87.2, 86.8, 83.3, 67.5, 28.7, 29.9], composite: 63.9, sensory: { somatosensory: 99.5, visual: 77.4, vestibular: 32.9, visualPreference: 98 }, patternUpperLimits: { mixedVestibularSomatosensory: 42.7, mixedVestibularVisual: 35.6, aphysiological: 32.3 } },
  { minAge: 16, maxAge: 59, label: '16 a 59 años', conditions: [90, 85, 86, 70, 52, 48], composite: 70, sensory: { somatosensory: 94.4, visual: 77.8, vestibular: 57.8, visualPreference: 97.8 }, patternUpperLimits: { mixedVestibularSomatosensory: 46.1, mixedVestibularVisual: 41.1, aphysiological: 30.3 } },
  { minAge: 60, maxAge: 69, label: '60 a 69 años', conditions: [90, 86, 80, 77, 51, 49], composite: 68, sensory: { somatosensory: 95.6, visual: 85.6, vestibular: 56.7, visualPreference: 94.2 }, patternUpperLimits: { mixedVestibularSomatosensory: 45.1, mixedVestibularVisual: 42.1, aphysiological: 29.6 } },
  { minAge: 70, maxAge: 79, label: '70 a 79 años', conditions: [90, 86, 80, 69, 45, 27], composite: 64, sensory: { somatosensory: 95.6, visual: 76.7, vestibular: 50, visualPreference: 81.7 }, patternUpperLimits: { mixedVestibularSomatosensory: 45.2, mixedVestibularVisual: 39.3, aphysiological: 31 } },
  { minAge: 80, maxAge: 84, label: '80 a 84 años', conditions: [90, 86, 77, 63, 20, 14], composite: 57, sensory: { somatosensory: 95.6, visual: 70, vestibular: 22.2, visualPreference: 85.8 }, patternUpperLimits: { mixedVestibularSomatosensory: 40.9, mixedVestibularVisual: 32, aphysiological: 34.7 } },
  { minAge: 85, maxAge: 89, label: '85 a 89 años', conditions: [90, 85, 84, 54, 1.5, 1.5], composite: 43, sensory: { somatosensory: 94.4, visual: 60, vestibular: 1.7, visualPreference: 98.8 }, patternUpperLimits: { mixedVestibularSomatosensory: 37.5, mixedVestibularVisual: 24.1, aphysiological: 39 } },
]

export function bapReferenceForAge(age: number) {
  return BAP_AGE_REFERENCES.find((reference) => age >= reference.minAge && age <= reference.maxAge) ?? null
}
