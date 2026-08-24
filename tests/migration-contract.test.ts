import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/202607160009_structured_study_import.sql'), 'utf8')
const questionnaireMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202607160010_perception_questionnaire_v2.sql'), 'utf8')
const documentRequestMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202607160011_document_access_requests.sql'), 'utf8')
const studyFinalizationMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202607160012_finalize_clinical_studies.sql'), 'utf8')
const authProfileMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202607170001_sync_auth_profile_metadata.sql'), 'utf8')
const extractionMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202607170004_private_clinical_extraction.sql'), 'utf8')
const extractionHardeningMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202607170005_harden_extraction_review.sql'), 'utf8')
const extractionReportMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202607170007_simplified_extraction_report.sql'), 'utf8')
const extractionConfirmationAlignmentMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202608230001_align_extraction_confirmation.sql'), 'utf8')
const cyclePosturographyMigration = readFileSync(join(process.cwd(), 'supabase/migrations/202608240001_unique_cycle_posturography_slots.sql'), 'utf8')

describe('contrato SQL de importación', () => {
  it('protege importaciones con RLS y propiedad del paciente', () => {
    expect(migration).toContain('alter table public.import_jobs enable row level security')
    expect(migration).toContain('public.owns_patient(study.patient_id)')
  })

  it('impide reemplazar estudios finalizados', () => {
    expect(migration).toContain("if study_record.status = 'finalized'")
  })

  it('audita confirmaciones y revisiones profesionales', () => {
    expect(migration).toContain("'study_import_confirmed'")
    expect(migration).toContain("'statistical_suggestion_reviewed'")
  })

  it('mantiene las funciones sensibles restringidas a authenticated', () => {
    expect(migration).toContain('revoke all on function public.replace_study_import')
    expect(migration).toContain('revoke all on function public.review_statistical_suggestion')
  })
})

describe('contrato SQL del cuestionario v2', () => {
  it('amplía el instrumento sin sobrescribir registros v1', () => {
    expect(questionnaireMigration).toContain("instrument_code set default 'ONUR_PERCEPCION_18'")
    expect(questionnaireMigration).toContain('instrument_version set default 2')
    expect(questionnaireMigration).toContain('total_score between 0 and 54')
    expect(questionnaireMigration).toContain('answered_count between 0 and 18')
  })

  it('diferencia respuestas aplicables y datos complementarios', () => {
    expect(questionnaireMigration).toContain('applicable_count')
    expect(questionnaireMigration).toContain('general_rating')
    expect(questionnaireMigration).toContain('falls_count')
    expect(questionnaireMigration).toContain('walking_aid_used')
  })
})

describe('contrato SQL de solicitudes de documentos', () => {
  it('expone al paciente un catálogo seguro mediante una función restringida', () => {
    expect(documentRequestMigration).toContain('create or replace function public.list_my_document_catalog()')
    expect(documentRequestMigration).toContain('security definer')
    expect(documentRequestMigration).toContain('revoke all on function public.list_my_document_catalog() from public')
    const returnContract=documentRequestMigration.slice(documentRequestMigration.indexOf('returns table ('),documentRequestMigration.indexOf(')\nlanguage sql'))
    expect(returnContract).not.toContain('storage_path')
  })

  it('valida propiedad, cuenta activa y decisión profesional', () => {
    expect(documentRequestMigration).toContain('public.is_patient_self(target_patient_id)')
    expect(documentRequestMigration).toContain('public.owns_patient(request.patient_id)')
    expect(documentRequestMigration).toContain('public.is_professional()')
  })

  it('audita solicitudes, decisiones, vistas y descargas', () => {
    expect(documentRequestMigration).toContain("'document_access_requested'")
    expect(documentRequestMigration).toContain("'document_access_approved'")
    expect(documentRequestMigration).toContain("'document_viewed'")
    expect(documentRequestMigration).toContain("'document_downloaded'")
  })
})

describe('contrato SQL de finalización de estudios', () => {
  it('calcula una huella SHA-256 y audita el cierre', () => {
    expect(studyFinalizationMigration).toContain('final_snapshot_sha256')
    expect(studyFinalizationMigration).toContain('extensions.digest')
    expect(studyFinalizationMigration).toContain("'clinical_study_finalized'")
  })

  it('bloquea cambios posteriores en estudio, métricas, incidencias e importación', () => {
    expect(studyFinalizationMigration).toContain('clinical_studies_protect_finalized')
    expect(studyFinalizationMigration).toContain('metric_values_reject_finalized_change')
    expect(studyFinalizationMigration).toContain('data_quality_issues_reject_finalized_change')
    expect(studyFinalizationMigration).toContain('import_jobs_reject_finalized_change')
    expect(studyFinalizationMigration).toContain('pg_advisory_xact_lock')
    expect(studyFinalizationMigration).toContain("auth.role() = 'service_role'")
  })

  it('restringe el cierre a un profesional propietario y a la función autorizada', () => {
    expect(studyFinalizationMigration).toContain('public.owns_patient(study.patient_id)')
    expect(studyFinalizationMigration).toContain('public.is_professional()')
    expect(studyFinalizationMigration).toContain('revoke all on function public.finalize_clinical_study(uuid) from public')
  })
})

describe('contrato SQL de perfiles de Auth', () => {
  it('sincroniza el rol cuando Supabase actualiza app_metadata después del alta', () => {
    expect(authProfileMigration).toContain('after insert or update of raw_app_meta_data, raw_user_meta_data')
    expect(authProfileMigration).toContain('on conflict (id) do update')
    expect(authProfileMigration).toContain("new.raw_app_meta_data ->> 'role' = 'professional'")
  })

  it('reconcilia perfiles existentes sin confiar en metadatos editables por el usuario', () => {
    expect(authProfileMigration).toContain('from auth.users auth_user')
    expect(authProfileMigration).not.toContain("raw_user_meta_data ->> 'role'")
  })
})

describe('contrato SQL de extracción clínica privada', () => {
  it('protege borradores, páginas, secciones y campos con RLS y propiedad profesional', () => {
    expect(extractionMigration.match(/enable row level security/g)).toHaveLength(4)
    expect(extractionMigration).toContain('public.owns_patient(patient_id)')
    expect(extractionMigration).toContain('public.is_professional()')
  })

  it('separa borrador de métricas confirmadas y bloquea revisiones prematuras', () => {
    expect(extractionMigration).toContain('document_extraction_fields')
    expect(extractionMigration).toContain('clinical_studies_require_extraction_confirmation')
    expect(extractionMigration).toContain("job.status not in ('confirmed', 'manual')")
    expect(extractionMigration).toContain('Hay campos obligatorios faltantes o sin confirmar.')
  })

  it('requiere propiedad para crear, confirmar, descartar y pasar a manual', () => {
    for (const rpc of ['create_document_extraction_draft', 'save_document_extraction_review', 'confirm_document_extraction', 'mark_document_extraction_manual', 'discard_document_extraction']) {
      expect(extractionMigration).toContain(`revoke all on function public.${rpc}`)
    }
  })

  it('audita sin incluir raw_value, normalized_value ni professional_value en metadata', () => {
    const auditStatements = extractionMigration.match(/insert into public\.audit_events[\s\S]*?;/g) ?? []
    expect(auditStatements.length).toBeGreaterThanOrEqual(5)
    for (const statement of auditStatements) {
      expect(statement).not.toContain('raw_value')
      expect(statement).not.toContain('professional_value')
    }
  })

  it('no concede lectura de extracción al rol paciente', () => {
    const grants = extractionMigration.match(/grant .*document_extraction.*;/g) ?? []
    expect(grants.every((grant) => grant.includes('authenticated'))).toBe(true)
    expect(extractionMigration).not.toContain('extraction_fields_patient')
  })

  it('solo resuelve discrepancias por confirmación profesional y sincroniza páginas corregidas', () => {
    expect(extractionHardeningMigration).toContain("new.patient_match_status not in ('mismatch', 'confirmed_by_professional')")
    expect(extractionHardeningMigration).toContain('extraction_jobs_protect_patient_match')
    expect(extractionHardeningMigration).toContain('extraction_pages_sync_sections')
  })

  it('protege el reanálisis y exige conclusión y rehabilitación profesional', () => {
    expect(extractionReportMigration).toContain('public.owns_patient(patient_id)')
    expect(extractionReportMigration).toContain('public.is_professional()')
    expect(extractionReportMigration).toContain('clinical_extraction_reprocessed')
    expect(extractionReportMigration).toContain('require_extraction_report_before_confirmation')
    expect(extractionReportMigration).toContain('Completá la conclusión profesional')
    expect(extractionReportMigration).toContain('Completá la sugerencia profesional de rehabilitación')
    expect(extractionReportMigration).toContain('revoke all on function public.replace_document_extraction_candidates')
  })

  it('no incluye el texto clínico del informe en auditoría', () => {
    const auditStatements = extractionReportMigration.match(/insert into public\.audit_events[\s\S]*?;/g) ?? []
    expect(auditStatements.length).toBeGreaterThanOrEqual(2)
    for (const statement of auditStatements) {
      expect(statement).not.toContain("'professional_conclusion',")
      expect(statement).not.toContain("'rehabilitation_suggestion',")
    }
  })

  it('no bloquea el informe por metadatos auxiliares que no producen métricas', () => {
    expect(extractionConfirmationAlignmentMigration).toContain('field.metric_code is not null')
    expect(extractionConfirmationAlignmentMigration).toContain('Todos los valores clínicos presentes deben estar confirmados.')
    expect(extractionConfirmationAlignmentMigration).toContain('revoke all on function public.confirm_document_extraction(uuid) from public')
    expect(extractionConfirmationAlignmentMigration).toContain('grant execute on function public.confirm_document_extraction(uuid) to authenticated')
  })
})

describe('contrato SQL de posturografías por ciclo', () => {
  it('impide nuevas iniciales o finales duplicadas incluso ante cargas simultáneas', () => {
    expect(cyclePosturographyMigration).toContain('clinical_studies_unique_cycle_posturography_slot')
    expect(cyclePosturographyMigration).toContain('pg_advisory_xact_lock')
    expect(cyclePosturographyMigration).toContain("new.cycle_phase not in ('initial', 'final')")
    expect(cyclePosturographyMigration).toContain('Ya existe una posturografía % para este ciclo')
  })

  it('toma la fase del documento antes de crear el estudio extraído', () => {
    expect(cyclePosturographyMigration).toContain('select source.cycle_phase into document_phase')
    expect(cyclePosturographyMigration).toContain('new.cycle_phase := document_phase')
  })
})
