-- Cédula de identidad clínica. Se mantiene en el espacio privado del profesional.

alter table public.patient_private_notes
add column document_number text;

alter table public.patient_private_notes
add constraint patient_private_document_number_format
check (
  document_number is null
  or document_number ~ '^[0-9]{6,12}$'
);

comment on column public.patient_private_notes.document_number
is 'Identificador clínico privado del paciente. Solo es visible para el profesional responsable.';
