import { describe, expect, it } from 'vitest'
import { isReportRelevantField, isReportRequiredField } from './reportFields'

describe('campos relevantes para informe y rehabilitación', () => {
  it('limita posturografía a resultados funcionales y de calidad útiles', () => {
    expect(isReportRelevantField({ studyType: 'posturography', code: 'condition_6' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'sensory_vestibular' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'mix_ve_som' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'software_version' })).toBe(false)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'los_forward' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'pppd_index' })).toBe(true)
    expect(isReportRequiredField({ studyType: 'posturography', code: 'mix_ve_som' })).toBe(false)
  })

  it('incluye el contrato vestibular completo y respeta requisitos dinámicos', () => {
    expect(isReportRelevantField({ studyType: 'vhit', code: 'himp' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'gain_right' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'calibration_quality' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'skew' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'gait' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'test_device' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'vhit_results' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'deep_sensation' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'reflexes' })).toBe(true)
    expect(isReportRequiredField({ studyType: 'vhit', code: 'gain_right', required: true })).toBe(true)
    expect(isReportRequiredField({ studyType: 'vhit', code: 'calibration_quality', required: false })).toBe(false)
  })
})
