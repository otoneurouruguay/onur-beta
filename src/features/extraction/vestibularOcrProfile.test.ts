import { describe, expect, it } from 'vitest'
import { detectVestibularTemplate } from './vestibularOcrProfile'

describe('detector de plantillas vestibulares', () => {
  it('distingue un gráfico vHIT rotulado de un informe narrativo', () => {
    expect(detectVestibularTemplate('vHIT HIMP G. Regresión OD 0,91 OI 0,87 CULL Sacadas correctivas ausentes Impulse Nr 22/21', 1400, 900)).toMatchObject({ type: 'vhit_labeled', detected: true })
    expect(detectVestibularTemplate('Informe vestibular Examen clínico Supresión visual Head Shaking Test En suma Conducta', 1400, 2000)).toMatchObject({ type: 'vestibular_report', detected: true })
  })

  it('no fuerza una plantilla con texto clínico insuficiente', () => {
    expect(detectVestibularTemplate('Paciente derivado para control', 1000, 1400)).toMatchObject({ type: 'generic', detected: false })
  })

  it('prioriza el informe narrativo vertical aunque contenga métricas vHIT', () => {
    const text = 'Informe vestibular Examen clínico Supresión visual Pruebas posicionales En suma Conducta vHIT HIMP SHIMP Ganancia Sacadas CCLL'
    expect(detectVestibularTemplate(text, 900, 1600)).toMatchObject({ type: 'vestibular_report', detected: true })
  })
})
