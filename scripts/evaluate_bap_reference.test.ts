// @vitest-environment node

import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readBapReferenceImage } from './read_bap_reference'

const referencePath = process.env.ONUR_BAP_REFERENCE_IMAGE ?? ''
const referenceTest = referencePath && existsSync(referencePath) ? it : it.skip

describe('integración OCR BAP clínica autorizada', () => {
  referenceTest('extrae el contrato esperado sin copiar la imagen al repositorio', async () => {
    const { fields } = await readBapReferenceImage(referencePath)
    const byCode = new Map(fields.map((field) => [field.code, field]))
    const value = (code: string) => byCode.get(code)?.value
    expect(value('reported_age')).toBe(73)
    expect(value('last_name')).toBe('Gonzalez')
    expect(value('first_name')).toBe('Ernesto')
    expect(value('reported_sex')).toBe('M')
    expect(value('patient_id')).toBe('29184411')
    expect(value('afis_pattern')).toBe(26)
    expect(value('study_date')).toBe('2026-08-19')
    expect(value('study_time')).toBe('13:58')
    expect(value('los_area')).toBe(35.226)
    expect([1, 2, 3, 4, 5, 6].map((index) => value(`condition_area_${index}`))).toEqual([.719, .640, .945, 5.232, 11.269, 14.414])
    expect([1, 2, 3, 4, 5, 6].map((index) => value(`condition_${index}`))).toEqual([99, 99, 98, 94, 88, 84])
    expect(value('composite_score')).toBe(94)
    expect(['sensory_somatosensory', 'sensory_visual', 'sensory_vestibular', 'visual_preference'].map(value)).toEqual([100, 95, 88, 98])
    expect(['sensory_contribution_somatosensory', 'sensory_contribution_visual', 'sensory_contribution_vestibular'].map(value)).toEqual([35, 33, 31])
    expect(value('selected_condition')).toBe(6)
    expect(value('scale')).toBe('X10')
    expect(['los_forward', 'los_backward', 'los_left', 'los_right', 'selected_area'].map(value)).toEqual([-1.05, 3.32, -3.48, .71, 14.41])
    expect(['sway_per_second_x', 'sway_per_second_y', 'sway_per_minute_x', 'sway_per_minute_y'].map(value)).toEqual([4, 5, 294, 348])
    expect(value('los_score')).toBe(100)
    expect(value('mix_ve_som')).toBe(49.2)
    expect(value('mix_ve_vi')).toBe(47.9)
    expect(byCode.get('pppd_index')).toMatchObject({ rawValue: '∞ %', value: null, status: 'invalid', professionalValue: 'No calculable' })
    expect(byCode.get('condition_area_7')).toMatchObject({ rawValue: '0,000', value: null, status: 'not_performed', professionalValue: 'No realizada' })
    expect(byCode.get('condition_area_8')).toMatchObject({ rawValue: '0,000', value: null, status: 'not_performed', professionalValue: 'No realizada' })
  }, 180_000)
})
