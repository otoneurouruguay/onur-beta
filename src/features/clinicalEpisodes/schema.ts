import type { ClinicalEpisodeValues } from './types'

export function validateClinicalEpisode(values: ClinicalEpisodeValues) {
  const errors: Record<string, string> = {}
  if (!values.treatmentCycleId) errors.treatmentCycleId = 'Seleccioná el ciclo clínico.'
  if (!values.diagnosisCode) errors.diagnosisCode = 'Seleccioná el diagnóstico o condición clínica.'
  if (values.status === 'reviewed') {
    if (values.diagnosisSource.trim().length < 3) errors.diagnosisSource = 'Documentá quién confirmó el diagnóstico y con qué criterio.'
    if (!values.onsetDate) errors.onsetDate = 'Registrá la fecha de inicio o una estimación clínica.'
    if (values.phase === 'unknown') errors.phase = 'Definí la fase clínica.'
    if (values.laterality === 'unknown' && !['pppd', 'vestibular_migraine', 'presbyvestibulopathy', 'mild_tbi'].includes(values.diagnosisCode)) errors.laterality = 'Definí lateralidad o indicá que no aplica.'
    if (values.diagnosisCode === 'unilateral_hypofunction' && !['left', 'right'].includes(values.laterality)) errors.laterality = 'La hipofunción unilateral requiere lado izquierdo o derecho.'
    if (values.diagnosisCode === 'bilateral_hypofunction' && values.laterality !== 'bilateral') errors.laterality = 'La hipofunción bilateral debe registrarse como bilateral.'
    if (values.diagnosisCode === 'vestibular_schwannoma' && !['left', 'right'].includes(values.laterality)) errors.laterality = 'El schwannoma vestibular requiere lado izquierdo o derecho.'
    if (values.anamnesis.primarySymptoms.trim().length < 3) errors.primarySymptoms = 'Resumí los síntomas principales.'
    if (values.anamnesis.fallRisk === 'not_assessed') errors.fallRisk = 'Evaluá el riesgo de caída.'
    if (values.measuredImpairments.trim().length < 3) errors.measuredImpairments = 'Registrá al menos un déficit medido antes de confirmar el episodio.'
    if (values.participationGoals.trim().length < 3) errors.participationGoals = 'Definí una meta funcional o de participación.'
    if (values.anamnesis.stopRules.trim().length < 3) errors.stopRules = 'Definí criterios de pausa o interrupción.'
    const findings = values.pathologyFindings
    const present = (key: string) => String(findings[key] ?? '').trim().length > 0
    if (values.diagnosisCode === 'unilateral_hypofunction' && (!present('vhitSummary') || !present('centralSignsExcluded'))) errors.pathologyFindings = 'Documentá la prueba que sustenta el déficit y la evaluación de signos centrales.'
    if (values.diagnosisCode === 'bilateral_hypofunction' && !present('bilateralTestSummary')) errors.pathologyFindings = 'Documentá la confirmación vestibular bilateral objetiva.'
    if (values.diagnosisCode === 'bppv' && (!present('canal') || !present('positionalTest') || !['left', 'right'].includes(values.laterality))) errors.pathologyFindings = 'Para VPPB se requieren canal, lado y patrón de la prueba posicional.'
    if (values.diagnosisCode === 'pppd' && ['mostDaysThreeMonths', 'uprightExacerbation', 'motionExacerbation', 'visualExacerbation'].some((key) => findings[key] !== 'yes')) errors.pathologyFindings = 'Documentá el cumplimiento de duración y los tres agravantes de los criterios PPPD.'
    if (values.diagnosisCode === 'vestibular_migraine' && (!present('episodePattern') || !present('migraineFeatures') || !present('activeAttack'))) errors.pathologyFindings = 'Documentá episodios, rasgos migrañosos y si existe una crisis activa.'
    if (values.diagnosisCode === 'meniere' && (!present('activeAttack') || !present('auditoryFluctuation'))) errors.pathologyFindings = 'Documentá estado de crisis y síntomas auditivos fluctuantes.'
    if (values.diagnosisCode === 'presbyvestibulopathy' && findings.bilateralMildDeficit !== 'yes') errors.pathologyFindings = 'La presbivestibulopatía requiere hipofunción bilateral leve documentada.'
    if (values.diagnosisCode === 'mild_tbi' && (!present('injuryMechanism') || findings.redFlagsExcluded !== 'yes')) errors.pathologyFindings = 'Documentá mecanismo y evaluación de banderas rojas antes de confirmar.'
    if (values.diagnosisCode === 'vestibular_schwannoma' && !present('treatmentStage')) errors.pathologyFindings = 'Documentá la etapa del tratamiento del schwannoma.'
  }
  return errors
}
