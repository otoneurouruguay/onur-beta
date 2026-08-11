# Generación clínicamente gobernada de ejercicios

## Estado implementado

La plataforma incorpora la base segura para un generador de borradores, no una prescripción automática:

- catálogo versionado de 38 fuentes en `src/features/clinicalGeneration/catalog.ts`;
- taxonomía cerrada de 14 categorías;
- compuerta previa de autorización, datos clínicos y alertas;
- rechazo recursivo de valores `COMPLETAR_*`, `PENDIENTE` o `TBD`;
- validación estricta del JSON generado, de los códigos taxonómicos y de cada `source_id`;
- obligación de mantener `clinician_review_status=draft_unreviewed`;
- prohibición de incluir ejercicios en una respuesta bloqueada.

El endpoint o proveedor de IA todavía no se conecta a esta capa. Cuando se conecte, la autorización deberá derivarse en servidor de la sesión autenticada; el booleano enviado por el navegador nunca será suficiente.

## Orden de la compuerta

1. Confirmar profesional autenticado y autorizado y la aceptación explícita de revisión.
2. Confirmar los 28 campos clínicos requeridos.
3. Exigir tamizaje de alertas completado.
4. Si existe una alerta, devolver `blocked_safety_trigger` y ningún ejercicio.
5. Si faltan datos, devolver `blocked_missing_clinical_input`.
6. Solo entonces habilitar la creación de un `draft_unreviewed`.
7. Validar estructura, taxonomía y fuentes antes de guardar.
8. No publicar ni asignar hasta aprobación clínica humana.

## Reglas de dispositivo para todo borrador

- La finalidad del ejercicio debe mapearse a una configuración técnica validable; el título no alcanza.
- `GAZE_ADAPTATION_VORX1` solo puede usar una pantalla 2D inmóvil en la versión actual. VR Box fija el blanco a la cabeza y Quest navegador no ofrece un anclaje WebXR controlado y verificado por la aplicación.
- `GAZE_ADAPTATION_VORX2` usa un blanco que se desplaza mientras la cabeza se mueve en sentido opuesto; también requiere pantalla 2D inmóvil en la implementación actual.
- El objetivo recordado se mapea a `GAZE_SUBSTITUTION`. La etiqueta `RVO x3` puede mostrarse como alias docente, pero no debe codificarse como una tercera adaptación ni como ganancia triple.
- Seguimiento ocular y sacadas pueden mostrarse en visor únicamente con instrucción explícita de mantener la cabeza quieta. No pueden presentarse como reemplazo de adaptación o sustitución vestibular.
- La estimulación optocinética o la habituación visual requieren un patrón no sólido, velocidad mayor que cero, blanco oculto, postura sentada y límites sintomáticos definidos por el profesional.
- Balance, marcha, sentarse-pararse y toda tarea funcional se ejecutan en Pantalla 2D, fuera del visor y con el entorno visible.
- VR Box exige dosis temporal y avance automático. Quest admite interacción del navegador, pero una sesión Quest no se mezcla con otro dispositivo hasta implementar continuidad segura entre equipos.

Estas reglas se aplican al guardar una plantilla, validar una sesión y abrir el reproductor; una asignación heredada incompatible se bloquea antes de ejecutarse.

La excepción es una plantilla marcada `custom_free`: puede guardarse sin cumplir una finalidad cerrada porque queda identificada como configuración profesional no validada. Esto no omite los bloqueos técnicos y de seguridad cuando se incorpora a una sesión ni permite que el generador clínico la publique como prescripción automática.

## Resultado del JSON recibido

El ejemplo con `clinician_authorized=false` y campos `COMPLETAR_*` debe quedar bloqueado. No existe información suficiente ni autorización para crear un ejercicio, elegir dosis o sugerir una progresión.

## Correcciones de catálogo verificadas

- `SRC-005`: PMID `38872828`.
- `SRC-014`: año 2025 y PMID `41288240`.
- `SRC-029`: DOI `10.1016/j.arcped.2024.02.006`; no extrapolar dosis adulta y no recomendar exposición optocinética/VR a niños o adolescentes jóvenes sin regla pediátrica específica.
- `SRC-030`: enlace vigente del CDC revisado el 19 de julio de 2026.
- `SRC-031`: ensayo piloto multicéntrico 2026 que describe RVO x1/x2 horizontal, vertical y diagonal; DOI `10.3389/fneur.2025.1687181`, PMID `41561330`.
- `SRC-032`: revisión sistemática sobre doble tarea cognitivo-motora en personas con trastornos vestibulares; identifica el interés clínico y también la falta de un protocolo uniforme, PMID `31283530`.
- `SRC-033`: revisión sistemática y metaanálisis sobre doble tarea y equilibrio en adultos mayores; evidencia indirecta para el módulo cognitivo de la plataforma, PMID `38364709`.
- `SRC-037`: protocolo de ensayo sobre entrenamiento con visión estroboscópica en adultos mayores, PMID `42174703`; describe una hipótesis y un diseño, no demuestra eficacia clínica.
- `SRC-038`: criterio W3C de seguridad frente a destellos; el constructor limita la intermitencia a 2,5 Hz, por debajo de tres destellos por segundo.

## Orientación por patologías

El constructor permite elegir entre hipofunción vestibular unilateral o bilateral, VPPB, migraña vestibular, PPPD, mareo inducido visualmente, cinetosis, Ménière, presbivestibulopatía, traumatismo craneoencefálico leve y schwannoma vestibular. Cada opción muestra únicamente componentes de rehabilitación, precauciones, fuentes aplicables y plantillas existentes. La cinetosis se marca como extrapolación indirecta; el VPPB prioriza la maniobra correspondiente al canal y lado confirmados y no se trata con un estímulo visual automático.

La biblioteca debe revisarse como mínimo una vez al año y cuando aparezca una guía relevante nueva.
