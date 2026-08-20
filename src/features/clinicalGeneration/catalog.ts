export type EvidencePriority = 'foundational' | 'condition_specific' | 'diagnostic_governance' | 'diagnostic_and_treatment_governance' | 'treatment_modality' | 'delivery_model' | 'pediatric_governance' | 'safety' | 'teaching_secondary'

export interface ClinicalSource {
  id: `SRC-${string}`
  priority: EvidencePriority
  year: number
  title: string
  doi?: string
  pmid?: string
  url: string
  evidenceRole?: 'primary_or_consensus' | 'secondary_teaching'
  limitations?: string
}

// Catálogo de trazabilidad. No contiene dosis prescriptivas: estas permanecen en la
// orden clínica y en la versión gobernada del paquete de evidencia.
export const clinicalSources: readonly ClinicalSource[] = [
  { id: 'SRC-001', priority: 'foundational', year: 2022, title: 'Vestibular Rehabilitation for Peripheral Vestibular Hypofunction: An Updated Clinical Practice Guideline', doi: '10.1097/NPT.0000000000000382', pmid: '34864777', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8920012/' },
  { id: 'SRC-002', priority: 'foundational', year: 2015, title: 'Vestibular rehabilitation for unilateral peripheral vestibular dysfunction', doi: '10.1002/14651858.CD005397.pub4', pmid: '25581507', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11259236/' },
  { id: 'SRC-003', priority: 'foundational', year: 2026, title: 'Vestibular rehabilitation strategies of the Japan Society for Equilibrium Research', doi: '10.1016/j.anl.2026.03.005', pmid: '41850198', url: 'https://pubmed.ncbi.nlm.nih.gov/41850198/' },
  { id: 'SRC-004', priority: 'condition_specific', year: 2024, title: 'Efficacy of Vestibular Rehabilitation in Vestibular Neuritis', doi: '10.1097/PHM.0000000000002301', pmid: '37339059', url: 'https://pubmed.ncbi.nlm.nih.gov/37339059/' },
  { id: 'SRC-005', priority: 'condition_specific', year: 2024, title: 'Early vestibular rehabilitation training of peripheral acute vestibular syndrome', doi: '10.3389/fneur.2024.1396891', pmid: '38872828', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11169822/' },
  { id: 'SRC-006', priority: 'diagnostic_governance', year: 2022, title: 'Acute unilateral vestibulopathy/vestibular neuritis: Diagnostic criteria', doi: '10.3233/VES-220201', pmid: '35723133', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9661346/' },
  { id: 'SRC-007', priority: 'condition_specific', year: 2012, title: 'The effect of vestibular rehabilitation on adults with bilateral vestibular hypofunction', doi: '10.3233/VES-120464', pmid: '23302709', url: 'https://journals.sagepub.com/doi/10.3233/VES-120464' },
  { id: 'SRC-008', priority: 'diagnostic_governance', year: 2017, title: 'Bilateral vestibulopathy: Diagnostic criteria', doi: '10.3233/VES-170619', pmid: '29081426', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9249284/' },
  { id: 'SRC-009', priority: 'diagnostic_governance', year: 2019, title: 'Presbyvestibulopathy: Diagnostic criteria', doi: '10.3233/VES-190672', pmid: '31306146', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9249286/' },
  { id: 'SRC-010', priority: 'condition_specific', year: 2020, title: 'Physical therapy interventions for older people with vertigo, dizziness and balance disorders', doi: '10.1186/s12877-020-01899-9', pmid: '33228601', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7684969/' },
  { id: 'SRC-011', priority: 'condition_specific', year: 2024, title: 'Association between dizziness and future falls and fall-related injuries in older adults', doi: '10.1093/ageing/afae177', pmid: '39293812', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11410394/' },
  { id: 'SRC-012', priority: 'diagnostic_and_treatment_governance', year: 2017, title: 'Clinical Practice Guideline: Benign Paroxysmal Positional Vertigo (Update)', doi: '10.1177/0194599816689667', pmid: '28248609', url: 'https://pubmed.ncbi.nlm.nih.gov/28248609/' },
  { id: 'SRC-013', priority: 'diagnostic_governance', year: 2017, title: 'Benign paroxysmal positional vertigo: Diagnostic criteria', doi: '10.1016/j.otorri.2017.02.007', pmid: '29056234', url: 'https://pubmed.ncbi.nlm.nih.gov/29056234/' },
  { id: 'SRC-014', priority: 'condition_specific', year: 2025, title: 'The effect of vestibular rehabilitation in the management of vestibular migraine in adults', doi: '10.1111/head.70002', pmid: '41288240', url: 'https://pubmed.ncbi.nlm.nih.gov/41288240/' },
  { id: 'SRC-015', priority: 'condition_specific', year: 2026, title: 'The Effectiveness of Vestibular Rehabilitation in Vestibular Migraine', doi: '10.1007/s10162-026-01042-2', pmid: '41840297', url: 'https://pubmed.ncbi.nlm.nih.gov/41840297/' },
  { id: 'SRC-016', priority: 'diagnostic_governance', year: 2022, title: 'Vestibular migraine: Diagnostic criteria (Update)', doi: '10.3233/VES-201644', pmid: '34719447', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9249276/' },
  { id: 'SRC-017', priority: 'condition_specific', year: 2025, title: 'The Role of Vestibular Physical Therapy in Managing Persistent Postural-Perceptual Dizziness', doi: '10.3390/jcm14155524', pmid: '40807145', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12347945/' },
  { id: 'SRC-018', priority: 'condition_specific', year: 2025, title: 'Effect of vestibular rehabilitation therapy in patients with persistent postural perceptual dizziness', doi: '10.3389/fneur.2025.1599201', pmid: '41069431', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12504085/' },
  { id: 'SRC-019', priority: 'diagnostic_governance', year: 2017, title: 'Diagnostic criteria for persistent postural-perceptual dizziness', doi: '10.3233/VES-170622', pmid: '29036855', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9249299/' },
  { id: 'SRC-020', priority: 'condition_specific', year: 2023, title: "The effect of vestibular rehabilitation in Meniere's disease", doi: '10.1007/s00405-023-08066-x', pmid: '37341761', url: 'https://pubmed.ncbi.nlm.nih.gov/37341761/' },
  { id: 'SRC-021', priority: 'condition_specific', year: 2026, title: "Guidelines of the French Society of ENT on vestibular rehabilitation in Menière's disease", doi: '10.1016/j.anorl.2025.12.001', pmid: '41478836', url: 'https://pubmed.ncbi.nlm.nih.gov/41478836/' },
  { id: 'SRC-022', priority: 'treatment_modality', year: 2024, title: 'Optokinetic stimulation in the rehabilitation of visually induced dizziness', doi: '10.1177/02692155241244932', pmid: '38584422', url: 'https://pubmed.ncbi.nlm.nih.gov/38584422/' },
  { id: 'SRC-023', priority: 'treatment_modality', year: 2021, title: 'Virtual and augmented reality in vestibular rehabilitation of peripheral vestibular disorders', doi: '10.1038/s41598-021-97370-9', pmid: '34497323', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8426502/' },
  { id: 'SRC-024', priority: 'delivery_model', year: 2024, title: 'Effectiveness of Telerehabilitation in Dizziness', doi: '10.3390/s24103028', pmid: '38793883', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11125243/' },
  { id: 'SRC-025', priority: 'condition_specific', year: 2024, title: 'The Efficacy of Vestibular Rehabilitation Therapy for Mild Traumatic Brain Injury', doi: '10.1097/HTR.0000000000000882', pmid: '37335202', url: 'https://pubmed.ncbi.nlm.nih.gov/37335202/' },
  { id: 'SRC-026', priority: 'condition_specific', year: 2023, title: 'Vestibular rehabilitation therapy on balance and gait in patients after stroke', doi: '10.1186/s12916-023-03029-9', pmid: '37626339', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10464347/' },
  { id: 'SRC-027', priority: 'condition_specific', year: 2020, title: 'Effectiveness of Vestibular Training in People with Multiple Sclerosis', doi: '10.3390/jcm9020590', pmid: '32098162', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7074243/' },
  { id: 'SRC-028', priority: 'condition_specific', year: 2024, title: 'Vestibular Rehabilitation in Vestibular Schwannoma', doi: '10.1093/ptj/pzae085', pmid: '38982735', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11450271/' },
  { id: 'SRC-029', priority: 'pediatric_governance', year: 2024, title: 'French Society guidelines for vestibular rehabilitation in children', doi: '10.1016/j.arcped.2024.02.006', pmid: '38697883', url: 'https://pubmed.ncbi.nlm.nih.gov/38697883/' },
  { id: 'SRC-030', priority: 'safety', year: 2026, title: 'Signs and Symptoms of Stroke', url: 'https://www.cdc.gov/stroke/signs-symptoms/index.html' },
  { id: 'SRC-031', priority: 'treatment_modality', year: 2026, title: 'Effectiveness of three vestibular rehabilitation exercises for treating acute unilateral peripheral vestibular dysfunction: a multicenter randomized study', doi: '10.3389/fneur.2025.1687181', pmid: '41561330', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12812630/' },
  { id: 'SRC-032', priority: 'treatment_modality', year: 2020, title: 'Psychometric Properties of Cognitive-Motor Dual-Task Studies With the Aim of Developing a Test Protocol for Persons With Vestibular Disorders: A Systematic Review', doi: '10.1097/AUD.0000000000000748', pmid: '31283530', url: 'https://pubmed.ncbi.nlm.nih.gov/31283530/' },
  { id: 'SRC-033', priority: 'treatment_modality', year: 2024, title: 'Effect of dual-task training on balance in older adults: A systematic review and meta-analysis', doi: '10.1016/j.archger.2024.105368', pmid: '38364709', url: 'https://pubmed.ncbi.nlm.nih.gov/38364709/' },
  { id: 'SRC-034', priority: 'treatment_modality', year: 2025, title: 'Virtual reality-based vestibular rehabilitation therapy in patients with acute unilateral vestibulopathy: a randomized controlled trial', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11810741/' },
  { id: 'SRC-035', priority: 'treatment_modality', year: 2022, title: 'Effectiveness of conventional versus virtual reality-based vestibular rehabilitation exercises in elderly patients with dizziness: a randomized controlled study with 6-month follow-up', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9760985/' },
  { id: 'SRC-036', priority: 'treatment_modality', year: 2023, title: 'Fully Immersive Virtual Reality Using 360° Videos to Manage Well-Being in Older Adults: A Scoping Review', doi: '10.1016/j.jamda.2022.12.026', pmid: '36758621', url: 'https://pubmed.ncbi.nlm.nih.gov/36758621/' },
  { id: 'SRC-037', priority: 'treatment_modality', year: 2026, title: 'Effect of balance training exercises with stroboscopic glasses on postural control, gait, and physical performance in the elderly population: study protocol for a randomized controlled trial', pmid: '42174703', url: 'https://pubmed.ncbi.nlm.nih.gov/42174703/' },
  { id: 'SRC-038', priority: 'safety', year: 2025, title: 'Understanding Success Criterion 2.3.2: Three Flashes', url: 'https://www.w3.org/WAI/WCAG21/Understanding/three-flashes' },
  { id: 'SRC-039', priority: 'teaching_secondary', year: 0, title: 'COFOBA · Síndrome de Hipofunción Vestibular Aguda Unilateral', url: '/clinical-sources/cofoba-hipofuncion-aguda-unilateral.ppt', evidenceRole: 'secondary_teaching', limitations: 'Material docente sin dosis moderna estructurada; se contrasta con APTA y consensos Bárány.' },
  { id: 'SRC-040', priority: 'teaching_secondary', year: 0, title: 'COFOBA · Síndrome de Hipofunción Vestibular Crónica Unilateral', url: '/clinical-sources/cofoba-hipofuncion-cronica-unilateral.ppt', evidenceRole: 'secondary_teaching', limitations: 'Material docente para marco clínico; no reemplaza guías de práctica ni criterios diagnósticos actuales.' },
  { id: 'SRC-041', priority: 'teaching_secondary', year: 0, title: 'COFOBA · Síndrome de Hipofunción Vestibular Crónica Bilateral', url: '/clinical-sources/cofoba-hipofuncion-cronica-bilateral.ppt', evidenceRole: 'secondary_teaching', limitations: 'Material docente para signos y etiologías; la dosis se toma de guías contemporáneas.' },
]

export const clinicalSourceIds = new Set(clinicalSources.map((source) => source.id))

export const exerciseTaxonomy = [
  'GAZE_ADAPTATION_VORX1', 'GAZE_ADAPTATION_VORX2', 'GAZE_SUBSTITUTION',
  'HABITUATION_MOVEMENT', 'HABITUATION_VISUAL_OKS', 'BALANCE_STATIC',
  'BALANCE_DYNAMIC', 'GAIT_HEAD_MOTION', 'GAIT_DUAL_TASK', 'ENDURANCE_WALKING',
  'FUNCTIONAL_EXPOSURE', 'VR_IMMERSIVE_OR_NONIMMERSIVE',
  'COGNITIVE_VISUAL_SINGLE_TASK', 'COGNITIVE_MOTOR_DUAL_TASK',
] as const

export type ExerciseTaxonomyCode = typeof exerciseTaxonomy[number]
