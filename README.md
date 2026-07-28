# ONUr 1.0 Beta

Aplicación web para crear, asignar y ejecutar sesiones de entrenamiento vestíbulo-visual bajo supervisión profesional.

Este es un repositorio nuevo e independiente de `vision-flow-trainer`.

## Estado actual

Decimotercer incremento técnico ejecutable:

- acceso profesional y paciente;
- primer acceso con cambio a PIN;
- dashboard profesional;
- listado, búsqueda, alta, edición y perfil de pacientes;
- creación opcional de cuenta de portal con usuario editable y cédula temporal;
- persistencia local de altas y cambios en modo demo;
- repositorio de datos conmutado automáticamente entre demo y Supabase;
- protección de rutas y cierre de sesión según rol;
- ciclos de tratamiento con objetivos y trazabilidad;
- constructor de sesiones con varios ejercicios ordenables;
- asignaciones presenciales o domiciliarias con vigencia configurable;
- ejercicios visuales y físicos guiados con dosis por tiempo o repeticiones;
- avance manual entre fases nuevas y compatibilidad automática para asignaciones antiguas;
- registro de objetivo, repeticiones informadas y finalización completa, parcial u omitida;
- auto-reporte descriptivo de malestar antes/después, dificultad y comentario opcional;
- cola local de finalizaciones y sincronización al recuperar la conexión;
- confirmación de uso versionada antes de abrir el portal del paciente;
- recuperación de contraseña exclusiva para la cuenta profesional;
- comando seguro para crear o actualizar al único profesional sin guardar su contraseña;
- comandos únicos para publicar el repositorio privado y preparar staging de punta a punta;
- seguimiento profesional de sesiones y tiempo realizado;
- carga real de Posturografías, vHIT, cuestionarios e informes;
- Storage privado con hash, metadatos y archivos de hasta 25 MB;
- permisos de documentos activos hasta revocación manual;
- catálogo de documentos bloqueados visible para el paciente sin exponer rutas privadas;
- solicitudes de acceso iniciadas desde el portal del paciente;
- aprobación profesional como solo visualización o visualización y descarga;
- historial y auditoría de solicitud, decisión, visualización, descarga y revocación;
- tablero estadístico filtrable por período y paciente;
- actividad mensual, estados, modalidad, tiempo activo y resumen por paciente;
- comparación aritmética de cuestionarios completos con límites clínicos explícitos;
- finalización profesional de estudios revisados;
- huella SHA-256 y bloqueo transaccional del contenido finalizado;
- inmutabilidad en base de datos para estudio, métricas, incidencias e importación;
- índice general de estudios con búsqueda y filtros por tipo y estado;
- despliegue reproducible de Supabase staging con dry-run, migraciones, seed y Edge Functions;
- smoke test autolimpiable para Auth, RLS, Storage, permisos, PIN, auditoría e inmutabilidad;
- cuestionario físico A4 v2 con 18 respuestas cerradas y datos complementarios;
- comparación descriptiva inicial/final sin interpretación médica;
- informes por ciclo, imprimibles y versionados;
- gestión profesional para crear, revocar, desbloquear o restablecer cuentas;
- revocación efectiva incluso sobre sesiones de paciente ya abiertas;
- biblioteca reutilizable de plantillas de ejercicios;
- revisión de sugerencias estadísticas;
- importación estructurada de Posturografía y vHIT con valor original y normalizado en paralelo;
- controles versionados de unidad, formato, rango técnico, cero ambiguo y duplicados;
- confirmación profesional y bloqueo de valores no utilizables;
- sugerencias descriptivas automáticas con revisión, edición, aceptación o descarte;
- comparación longitudinal solo entre métricas y protocolos compatibles;
- auditoría de importaciones y decisiones sobre sugerencias;
- constructor de ejercicios con fondo y objeto independientes;
- motor canvas para barras, espiral, damero, puntos y fondo sólido;
- seguimiento suave y sacadas horizontales, verticales, diagonales o aleatorias;
- RVO x2 digital sobre pantalla inmóvil y objetivo recordado como sustitución (alias docente RVO x3);
- modo Libre para guardar combinaciones profesionales no validadas sin forzarlas a una finalidad clínica;
- reproductor continuo con pausa, omitir, salir, fullscreen y controles auto-ocultables;
- tiempo activo sin contar pausas ni descansos y metrónomo configurable;
- salida 2D, VR Box binocular, Cardboard 3DoF y Quest WebXR para escenarios 360° desde el mismo panel;
- VR Box 2D temporizado sin seguimiento ni controles, y Cardboard opcional con giroscopio, calibración frontal, perfil óptico transportable y controles duplicados;
- advertencia y reordenamiento recomendado cuando una sesión mezcla cualquier tarea sin visor con un bloque VR Box;
- controles de postura, superficie y supervisión, con bloqueos domiciliarios para tareas de mayor riesgo;
- catálogo de 33 fuentes y compuerta validada para futuros borradores clínicamente gobernados;
- sesión domiciliaria de demostración;
- PWA instalable;
- esquema PostgreSQL/Supabase con RLS;
- funciones seguras para CI temporal y PIN;
- almacenamiento clínico privado y permisos hasta revocación.

Todos los nombres y datos incluidos en la interfaz son ficticios. El modo local no envía información clínica.

## Stack

- React 19
- Vite 8
- TypeScript 6
- Tailwind CSS 4
- React Router
- TanStack Query
- Supabase: Auth, PostgreSQL, Storage y Edge Functions
- Vitest
- PWA mediante `vite-plugin-pwa`

## Requisitos

- Node.js 20.19+, 22.12+ o una versión posterior compatible con Vite 8.
- npm.
- Docker y Supabase CLI únicamente cuando se quiera ejecutar el backend local.

## Ejecutar la demostración

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`. Sin variables de entorno, cualquier formulario de ingreso abre el modo demo.

## Comandos de verificación

```bash
npm run typecheck
npm run test:run
npm run lint
npm run build
```

El despliegue reproducible y las pruebas contra un Supabase real están documentados en [STAGING_DEPLOYMENT.md](docs/STAGING_DEPLOYMENT.md).
El estado exacto del release y los pasos externos restantes están en [RELEASE_STATUS.md](docs/RELEASE_STATUS.md) y [PILOT_RUNBOOK.md](docs/PILOT_RUNBOOK.md).

`npm run github:publish` crea o conecta el repositorio privado y publica `main` con GitHub CLI. Una vez publicado, GitHub Actions verifica el proyecto y despliega la demostración PWA en `https://fedeshindiaz.github.io/onur-beta/`. `npm run staging:bootstrap` valida, despliega Supabase, crea el único profesional, ejecuta el smoke test y compila el frontend cuando las variables seguras ya están cargadas.

## Configurar Supabase

1. Copiar `.env.example` a `.env`.
2. Completar la URL y la clave pública del proyecto.
3. Aplicar las migraciones de `supabase/migrations`.
4. Configurar el secreto `PATIENT_AUTH_PEPPER` en las Edge Functions.
   Configurar también `ALLOWED_ORIGIN` con el dominio exacto de la aplicación.
5. Desplegar `create-patient-account`, `patient-login`, `change-patient-pin`, `manage-patient-account` y `cleanup-clinical-upload`.
6. Mantener deshabilitado el registro público de usuarios.

Nunca colocar `SUPABASE_SERVICE_ROLE_KEY` ni `PATIENT_AUTH_PEPPER` en variables `VITE_*` o en el navegador.

La cuenta profesional se prepara después de desplegar Supabase con `npm run admin:create`. El correo, contraseña y nombre se pasan únicamente mediante `PROFESSIONAL_EMAIL`, `PROFESSIONAL_PASSWORD` y `PROFESSIONAL_DISPLAY_NAME` en una terminal segura; no deben quedar escritos en archivos versionados.

## Decisiones de seguridad

- La cédula se utiliza una sola vez como secreto temporal y no se guarda.
- El PIN no se envía directamente a Supabase Auth: una Edge Function genera un secreto derivado con HMAC y un `pepper` del servidor.
- Cinco intentos fallidos bloquean temporalmente la cuenta durante 15 minutos.
- Los errores de acceso no revelan si existe un usuario.
- El paciente solo accede a sus asignaciones y a documentos autorizados expresamente.
- El paciente no puede escribir ejecuciones directamente: inicio y finalización pasan por funciones transaccionales validadas.
- El catálogo del portal no expone rutas de Storage y una solicitud no concede acceso por sí misma.
- Revocar la cuenta invalida inmediatamente el acceso clínico mediante RLS, incluso si había una sesión Auth abierta.
- Las sugerencias estadísticas no son visibles para el paciente sin revisión y publicación profesional.
- Los archivos originales y los valores normalizados permanecen separados.

Ver [arquitectura](docs/ARCHITECTURE.md), [importación estructurada](docs/STRUCTURED_STUDY_IMPORT.md), [despliegue de staging](docs/STAGING_DEPLOYMENT.md), [checklist de staging](docs/STAGING_CHECKLIST.md), [motor de ejercicios](docs/EXERCISE_ENGINE.md), [ciclos y sesiones](docs/SESSIONS.md), [generación clínicamente gobernada](docs/CLINICAL_EXERCISE_GENERATION.md), [documentos e informes](docs/DOCUMENTS_ASSESSMENTS_REPORTS.md) y [seguridad](docs/SECURITY.md).

## Alcance clínico

ONUr es una herramienta de apoyo para ejercicios guiados. No diagnostica, no prescribe y no reemplaza el criterio del profesional habilitado.
