import { describe, expect, it } from 'vitest'
import { isReportRelevantField, isReportRequiredField } from './reportFields'

describe('campos relevantes para informe y rehabilitación', () => {
  it('limita posturografía a resultados funcionales y de calidad útiles', () => {
    expect(isReportRelevantField({ studyType: 'posturography', code: 'condition_6' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'sensory_vestibular' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'mix_ve_som' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'software_version' })).toBe(false)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'los_forward' })).toBe(false)
    expect(isReportRelevantField({ studyType: 'posturography', code: 'pppd_index' })).toBe(false)
    expect(isReportRequiredField({ studyType: 'posturography', code: 'mix_ve_som' })).toBe(false)
  })

  it('limita vHIT al núcleo vestibular interpretable', () => {
    expect(isReportRelevantField({ studyType: 'vhit', code: 'himp' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'gain_right' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'calibration_quality' })).toBe(true)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'skew' })).toBe(false)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'gait' })).toBe(false)
    expect(isReportRelevantField({ studyType: 'vhit', code: 'test_device' })).toBe(false)
    expect(isReportRequiredField({ studyType: 'vhit', code: 'calibration_quality' })).toBe(false)
  })
})
