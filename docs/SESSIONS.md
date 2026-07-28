# Ciclos y sesiones

## Flujo profesional

1. El profesional abre el perfil del paciente e inicia o selecciona un ciclo activo.
2. Crea una sesión presencial o domiciliaria.
3. Ordena ejercicios visuales o físicos guiados.
4. Para cada ejercicio declara su finalidad y define dosis por tiempo o repeticiones, descanso, vueltas, dispositivo, postura, superficie, supervisión y modo de avance.
5. Revisa las reglas de seguridad y asigna la sesión.

El `plan_definition` se guarda como JSON versionado dentro de `session_plans`. La asignación referencia esa versión, por lo que cambios futuros no alteran una sesión ya entregada.

## Flujo del paciente

- Solo ve una asignación disponible y vigente.
- Cada fase fuera de VR Box aplica su propia preparación; las dosis por repeticiones esperan confirmación manual antes de continuar.
- En dosis por repeticiones, informa “objetivo completo”, una cantidad parcial o “no pude completar”.
- El descanso tiene cuenta regresiva; al llegar a cero muestra “Iniciar siguiente fase”.
- Los ejercicios VR Box son siempre temporizados y avanzan automáticamente.
- Fuera de VR Box puede pausar, omitir o salir. VR Box 2D termina automáticamente sin controles; Cardboard incorpora controles duplicados para pausar, recentrar, omitir o salir.
- Antes y después registra escalas descriptivas. Estas no activan recomendaciones automáticas.
- Si termina sin conexión, el resultado queda pendiente en el dispositivo y se sincroniza al volver internet.

Las asignaciones antiguas que no poseen `advanceMode` conservan continuidad automática por compatibilidad.

## Pantalla, VR Box y Quest

- Pantalla 2D: confirmación táctil, mouse o teclado.
- VR Box 2D: presentación binocular sin anclaje espacial ni seguimiento de cabeza. No usa botones, mirada, controles externos ni metrónomo.
- Cardboard 3DoF: opción para VR Box que usa sensores de orientación, calibra una dirección frontal y aplica un perfil óptico copiado dentro de la sesión. No mide traslación corporal 6DoF.
- Quest: los ejercicios visuales comunes continúan en una ventana 2D; los escenarios contextuales 360° abren WebXR inmersivo con seguimiento del visor.

RVO x2 y el objetivo recordado solo se habilitan en una pantalla 2D inmóvil. RVO x1 también puede ejecutarse con Cardboard 3DoF, únicamente en clínica, sentado, sobre superficie firme y con supervisión directa. VR Box 2D y los ejercicios Quest no inmersivos no ofrecen una referencia espacial estable. Seguimiento, sacadas, optocinético y habituación continúan rotulados como tareas oculomotoras o visuales, no como sustitutos automáticos de la adaptación del RVO.

RVO x2 usa un blanco móvil y una consigna de movimiento cefálico en sentido opuesto. El objetivo recordado es una tarea de sustitución por repeticiones y confirmación manual; `RVO x3` se conserva solo como alias docente, no como progresión automática ni como ganancia triple.

El modo Libre puede guardarse como predeterminado aun cuando no satisfaga las reglas clínicas de una finalidad cerrada. La asignación sigue bloqueando combinaciones técnicamente inexequibles y condiciones domiciliarias sin la supervisión necesaria.

Las repeticiones y cualquier tarea 2D se realizan con el celular fuera del visor. Si la sesión mezcla ambos modos, el constructor advierte y ofrece ordenar primero todas las tareas sin visor y luego un único bloque VR. Cada entrada o salida de VR agrega 20 segundos; también se retira el visor antes del autorreporte final.

VR Box 2D queda restringido a seguimiento, sacadas, optocinético, habituación visual o Libre visual. Cardboard agrega RVO x1 y escenarios 360° en las condiciones presenciales definidas. Ambos perfiles son por tiempo, con avance automático, sentado y en superficie firme. Antes de empezar, el paciente debe percibir los dos marcadores como uno solo y nítido. Ver doble, ver borroso o no poder fusionarlos impide iniciar esa modalidad.

No se habilitan tareas físicas dentro de VR Box ni Quest: deben ejecutarse fuera del visor, con el entorno visible. Las superficies inestables requieren ayudante entrenado o supervisión directa; la marcha domiciliaria no se asigna como independiente.

Una sesión Quest no puede mezclarse con Pantalla 2D o VR Box porque la versión actual no implementa continuidad entre dispositivos. Es siempre presencial, por tiempo, con avance automático y supervisión directa. Una sesión contextual puede acumular varios escenarios 360° compatibles; cada uno abre y cierra su propia inmersión WebXR.

## Seguridad y trazabilidad

El inicio se registra mediante `start_session_assignment` y la finalización mediante `complete_session_assignment_v2`. El paciente no escribe ejecuciones directamente.

El `event_log` conserva por fase: ejercicio, vuelta, tipo, modo de dosis, dispositivo, tiempo activo, objetivo de repeticiones, cantidad informada, transiciones de colocación/retiro de VR Box y resultado completo/parcial/omitido. La finalización agrega los autorreportes y actualiza el estado en una transacción.
