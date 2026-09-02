# Extracción clínica privada y revisable

ONUr Beta utiliza OCR local para preparar un borrador de parámetros de posturografías BAP, estudios vestibulares, vHIT e informes escaneados. El archivo original queda inalterado en el bucket privado `clinical-documents`; ningún dato pasa al informe confirmado sin intervención de un profesional propietario del paciente.

## Flujo simplificado

1. Abrir **Cargar estudio**, seleccionar el paciente, tipo, fecha y uno o varios archivos PDF/JPG/JPEG/PNG/WEBP.
2. Si hay varios archivos, el navegador los reúne en un único PDF privado y conserva los nombres originales en la descripción. Luego procesa todas las páginas localmente. Para BAP se amplía la imagen, se prueba contraste y orientación, y se leen tanto rótulos como valores por posición en los gráficos.
3. Revisar los **datos estructurados** y su evidencia: recorte, OCR crudo, valor normalizado, estado y motivo concreto de revisión.
4. Revisar y editar el borrador automático de **conclusión** y **sugerencia de rehabilitación** según la valoración clínica.
5. Confirmar y generar el informe, o guardar el borrador para continuar luego.

Las opciones técnicas y el descarte permanecen disponibles dentro de **Opciones avanzadas**. La interfaz no muestra pasos de normalización, confirmación individual ni clasificaciones que no sean necesarios para la revisión clínica.

## BAP y reanálisis

La versión `onur-local-ocr-2.0` detecta primero la plantilla BAP mediante señales visuales/textuales y relación de aspecto. Si no reúne evidencia suficiente conserva el extractor genérico. Para una BAP reconocida usa siempre los píxeles originales (no el tamaño CSS), aplica la orientación del navegador y ejecuta lecturas independientes por regiones normalizadas con margen, escalas 2x/3x/4x, color, grises y umbrales para texto oscuro o claro. Los recortes prioritarios recuperan edad, fecha/hora, patrón afisiológico, PPPD y sway sin bloquear la interfaz: Tesseract trabaja en su Web Worker local.

El candidato final no se decide por la confianza cruda de Tesseract. Se combinan coincidencia entre pasadas, alias, posición, rango, suma de contribuciones, fórmulas sensoriales y concordancia entre el área seleccionada y la condición. Una discordancia válida se conserva como `conflicting`; infinito se conserva como `invalid / No calculable`; y las condiciones 7/8 deshabilitadas como `not_performed`, nunca como cero.

Cada campo conserva `raw`, `value`, unidad, estado, confianza combinada, página/región/método, advertencias, validaciones y candidatos. Los estados disponibles son `detected`, `confirmed`, `needs_review`, `unreadable`, `not_reported`, `not_performed`, `invalid` y `conflicting`. Los borradores históricos `read/review/unrecognized` se normalizan al mostrarlos. Las correcciones profesionales conservan valor anterior, fecha y fuente `professional_edit`; un reanálisis no las reemplaza silenciosamente.

## Informes vestibulares y vHIT 2.3

La versión `onur-local-ocr-2.3` distingue un informe vestibular narrativo de una hoja o captura vHIT rotulada. Corrige orientación y vuelve a leer por separado encabezado, cuerpo clínico, resumen/conducta, métricas vHIT y controles de calidad con pasadas en color, grises y umbral de texto oscuro. Para cada bloque narrativo selecciona una sola pasada coherente en vez de concatenarlas. Al recomponer `En suma` y `Conducta`, elimina etiquetas, fragmentos incompletos de campos adyacentes y frases idénticas provenientes de recortes OCR superpuestos, y mantiene ambas secciones separadas. Los borradores vestibulares de revisión creados con lectores anteriores también se limpian al abrirse cuando contienen una etiqueta `Conducta:` incrustada, sin reemplazar la rehabilitación ya editada. Los renglones con etiquetas consecutivas —por ejemplo, `Test vibracional` seguido de `Cancelación del VOR`— se dividen antes de completar cada campo, sin modificar ni interpretar su contenido clínico. Un documento que no reúne señales suficientes permanece como genérico y requiere clasificación profesional.

El contrato vestibular conserva identidad y fecha impresas, institución/profesional, antecedentes, examen, HIMP/SHIMP, plano y canales, ganancias globales y por canal cuando están rotuladas, método de ganancia, simetría, sacadas explícitas, impulsos, velocidad cefálica, equipo, calibración/artefactos, conclusión y conducta. Las ganancias se validan en el intervalo 0–2 y la simetría en 0–100 %. Dos lecturas válidas discordantes quedan como `conflicting`; un valor fuera de rango queda como `invalid`.

Los requisitos se adaptan al tipo de página. Un informe narrativo no queda bloqueado por no incluir ganancias vHIT. Una página vHIT sí solicita fecha, HIMP, canales, ganancias laterales, simetría y sacadas. ONUr nunca deduce sacadas, déficit ni normalidad desde la forma de las curvas: si no existe texto explícito, el campo permanece no informado y exige revisión. `En suma` y `Conducta` pueden copiarse literalmente al borrador profesional, pero no se genera una interpretación ni una recomendación nueva.

Al abrir un borrador creado con una versión anterior, ONUr vuelve a analizar el original privado en el navegador y conserva las correcciones profesionales que difieran de la lectura anterior. El reprocesamiento queda auditado sin almacenar el contenido clínico en el registro de auditoría.

## Borrador automático de conclusión y rehabilitación

Para posturografías BAP, ONUr compara los valores mostrados con referencias por edad transcriptas exclusivamente del paquete local seguro `PAQUETE_SEGURO_PARA_WORK`:

- `09_TABLA_VALORES_NORMALES_BAP.xlsx`: condiciones, Composite y cocientes sensoriales;
- `08_VALORES_REFERENCIA_BAP.xlsx`: límites superiores de indicadores de patrón;
- `04_INTERPRETACION_BAP.md`: lenguaje funcional y posibles componentes de rehabilitación.

La aplicación completa los dos textos cuando están vacíos. Si el profesional ya los editó, no los sobrescribe: el botón **Regenerar desde parámetros** solicita confirmación antes de reemplazarlos. La sección **Cómo se generó este borrador** muestra cada comparación, las advertencias por datos faltantes y las fuentes utilizadas.

El motor usa únicamente el objeto estructurado visible en la pantalla de revisión. El informe confirmado se proyecta desde esa misma estructura; ni la imagen ni el OCR se vuelven a leer al redactarlo. Los valores por debajo de la referencia inferior se describen como reducidos; los indicadores de patrón solo se señalan cuando superan el límite superior consignado. Sin edad válida no clasifica contra la norma. Un indicador afisiológico elevado prioriza el control de calidad y la repetición de condiciones antes de proponer objetivos.

La posturografía se realiza fuera de ONUr. Cada documento se identifica como **inicial**, **final**, **control/seguimiento** o **sin especificar** dentro del ciclo. La inicial puede alimentar el borrador funcional; la final se usa para comparación longitudinal y no genera por sí sola una nueva prescripción.

## Datos mínimos para una lectura interpretable

Estos campos son un control de integridad del informe, no criterios diagnósticos aislados.

### Posturografía

- Identidad temporal: fecha y edad al momento del estudio.
- Protocolo sensorial: C1-C6 con el puntaje de cada condición.
- Resultado global: puntaje compuesto.
- Organización sensorial: índices somatosensorial, visual, vestibular y preferencia visual.
- Calidad: caídas o condiciones no completadas, patrón afisiológico/inconsistencia y observaciones técnicas.
- Contexto recomendado: límites de estabilidad (direcciones y score), sway, superficie/calzado, ayudas y síntomas durante la prueba.

### vHIT

- Identidad temporal: fecha y tipo de documento.
- Protocolo: HIMP/SHIMP, plano y canales realmente evaluados.
- Resultado principal: ganancia por lado y canal, indicando método o ventana de cálculo cuando el equipo lo informa.
- Respuesta correctiva: presencia/ausencia, overt/covert y repetibilidad de las sacadas.
- Comparación: simetría o asimetría informada.
- Calidad técnica: equipo/software, calibración, artefactos, cantidad y velocidad de impulsos e interpretabilidad.
- Cierre: conclusión profesional correlacionada con síntomas, examen neurológico/vestibular y otros estudios.

El OCR 1.5 reconoce además el formato narrativo `G. Regresión OD / OI`, la simetría, el número de impulsos y la velocidad cefálica cuando aparecen como texto. Las curvas aisladas siguen requiriendo revisión humana.

## Corpus y medición de precisión

El corpus reproducible `bap_ocr_corpus_synthetic.json` incluye capturas limpias, pequeñas, comprimidas, borrosas, de bajo contraste y con números señuelo. Cada archivo declara once resultados esperados: seis condiciones, compuesto y cuatro índices de organización sensorial. Ninguna muestra contiene datos personales ni procede de una historia clínica.

Ejecutar `npm run ocr:benchmark` para medir el corpus BAP sintético y `npm run ocr:vestibular` para comprobar orientación/ganancias vHIT y el informe narrativo escaneado. La prueba BAP falla si la precisión campo por campo baja de 95 %. Estos umbrales son técnicos y no certifican interpretabilidad clínica.

La captura clínica de referencia no se copia al repositorio ni se registra en consola. En un entorno local autorizado se verifica con:

```powershell
$env:ONUR_BAP_REFERENCE_IMAGE='C:\ruta\privada\captura.jpg'
npx vitest run scripts/evaluate_bap_reference.test.ts --environment node --maxWorkers=1
```

Sin esa variable la prueba queda omitida. El contrato comprueba identidad impresa, edad 73, fecha/hora, áreas, C1-C6, compuesto, organización y contribución sensorial, LOS, sway, índices mixtos, PPPD y condiciones 7/8.

## Límites y seguridad

- El OCR es una ayuda de transcripción; puede requerir corrección en fotos con perspectiva, baja resolución, tablas complejas o texto manuscrito.
- ONUr no interpreta curvas, no diagnostica ni infiere causalidad. El borrador de rehabilitación es orientación funcional basada en reglas, no una prescripción cerrada.
- La conclusión y la sugerencia de rehabilitación son editables y solo pasan al informe después de la confirmación del profesional responsable.
- Las referencias locales son heterogéneas y todavía requieren validación clínica formal antes del uso asistencial con datos reales.
- El paciente no participa de la carga ni recibe acceso al original durante la revisión.
- Los documentos y valores clínicos no se imprimen en consola ni se usan como fixtures, logs o datos de staging. La prueba clínica recibe solo una ruta local autorizada y no copia el archivo.
- No existe proveedor multimodal ni clave en el navegador. Todos los assets OCR se sirven desde `BASE_URL/ocr`; no se envían imágenes o recortes a servicios externos.

## Compatibilidad con informes escaneados 1.5

La compatibilidad 1.5 conserva la lectura de bloque y permite analizar un documento compuesto por varios archivos. Esto permite recomponer `En suma` y `Conducta` cuando ocupan varios renglones y descartar fragmentos duplicados de la lectura de página completa. Si el tipo de documento no está escrito literalmente, se propone desde la clasificación de página y queda marcado para revisión profesional.

La regresion usa `vestibular_report_scanned_synthetic.jpg`, una imagen completamente ficticia con perspectiva, resumen multilinea y conducta. Ningun documento real se incorpora al corpus.

## Pruebas

Los archivos en `tests/fixtures/synthetic-clinical` son exclusivamente sintéticos, se regeneran con `scripts/generate_synthetic_clinical_fixtures.py` y llevan una advertencia visible. No se incluyen documentos clínicos reales en el repositorio, la compilación, CI ni staging.

Los benchmarks cubren varias degradaciones BAP, un vHIT sintético girado y un informe vestibular narrativo con perspectiva. Una plantilla nueva, un recorte severo, una fotografía con reflejos o un diseño específico de otro fabricante todavía puede requerir corrección manual y un nuevo caso sintético equivalente.
