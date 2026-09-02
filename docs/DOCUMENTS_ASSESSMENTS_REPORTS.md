# Documentos, evaluaciones e informes

## Documentos clínicos

- Bucket privado `clinical-documents`.
- Ruta: `{professional_id}/{patient_id}/{uuid}-{filename_seguro}`.
- PDF, JPG, PNG, WEBP, XLS y XLSX; máximo 25 MB.
- Se registra nombre original, MIME, tamaño, SHA-256, fecha clínica, ciclo y descripción.
- Posturografía y vHIT crean también un estudio en estado `draft`.
- El paciente solo puede leer documentos con un permiso no revocado.

Tras confirmar la importación, el estudio queda `reviewed`. El profesional puede finalizarlo: ONUr calcula una huella SHA-256 y vuelve inmutables el estudio, sus métricas, incidencias y registro de importación. Las sugerencias derivadas permanecen separadas y pueden revisarse después sin alterar los valores finalizados.

El permiso está desactivado por defecto. Cuando se concede, permanece activo hasta que el profesional lo revoque manualmente.

El portal muestra un catálogo seguro de documentos bloqueados sin incluir la ruta privada de Storage. El paciente puede solicitar acceso y el profesional decide entre:

- no autorizar;
- solo visualizar;
- visualizar y descargar.

La solicitud no habilita el archivo. Cada solicitud, decisión, visualización, descarga y revocación queda auditada. Al revocar, el documento vuelve a aparecer bloqueado y puede solicitarse nuevamente.

`Solo visualizar` significa que ONUr no ofrece un botón de descarga y genera el enlace sin disposición de descarga. Como el navegador debe recibir los bytes para mostrarlos, una aplicación web no puede impedir de manera absoluta que el usuario conserve una copia; la interfaz no promete una protección técnica imposible.

## Cuestionarios clínicos

ONUr utiliza el Dizziness Handicap Inventory de 25 ítems en su adaptación argentina validada (DHI-AR). Las respuestas son Sí, A veces y No, con 4, 2 y 0 puntos respectivamente. El servidor calcula el total de 0 a 100 y las subescalas física, emocional y funcional.

La app permite:

- asignar un DHI inicial, final o de seguimiento dentro de un ciclo;
- habilitarlo solamente en el portal domiciliario del paciente, sin correo ni WhatsApp;
- guardar avance parcial y continuar más tarde;
- iniciarlo presencialmente desde el perfil y registrar las respuestas con el paciente presente;
- cancelar una asignación pendiente sin modificar resultados ya finalizados;
- mostrar al profesional el total, las subescalas y cada respuesta;
- comparar el DHI inicial y final solamente cuando ambos están completos y corresponden al mismo ciclo y versión.

Una puntuación mayor indica mayor discapacidad percibida. ONUr no convierte el resultado en un diagnóstico automático y no muestra puntajes anteriores al paciente mientras responde una nueva evaluación. La arquitectura admite instrumentos versionados adicionales, pero el VSS-SF no se habilita hasta disponer de una versión española validada y autorizada.

## Informe por ciclo

El informe reúne una instantánea de:

- período y estado del ciclo;
- sesiones asignadas, completas y parciales;
- tiempo de ejecución registrado;
- documentos asociados;
- evaluación inicial y final;
- hallazgos estadísticos ya aceptados o editados y seleccionados manualmente;
- resumen redactado por el profesional.

Cada guardado crea una versión nueva. El navegador permite imprimir o guardar como PDF. ONUr solo organiza y resume datos; el texto final debe ser revisado y firmado por el profesional.
