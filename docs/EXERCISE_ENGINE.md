# Motor de ejercicios

## Tipos y dosis

El mismo modelo admite dos tipos de contenido:

- `visual_stimulus`: fondo y blanco visual configurables;
- `guided_physical`: consigna física, postura, superficie y supervisión explícitas.

Además, cada ejercicio declara una finalidad obligatoria: estabilización de mirada RVO x1 o x2, sustitución por objetivo recordado, seguimiento ocular suave, sacadas, estimulación optocinética, habituación a movimiento visual, tarea cognitivo-visual, tarea física/funcional o modo Libre. La finalidad gobierna los parámetros compatibles; el nombre del ejercicio por sí solo no determina su comportamiento.

El nombre `RVO x3` aparece en algunos materiales docentes para el objetivo recordado, pero no se usa como una tercera ganancia de adaptación. La plataforma lo muestra como alias y lo registra clínicamente como sustitución: mirar el blanco, cerrar los ojos, girar la cabeza imaginando que la mirada permanece en él y reabrirlos para comprobar la precisión.

La dosis puede definirse por tiempo o por repeticiones. La plataforma no afirma detectar movimientos: en dosis por repeticiones el paciente informa si completó el objetivo, hizo menos o no pudo completar. El registro conserva objetivo y cantidad informada por cada vuelta.

Los ejercicios nuevos usan avance manual. Al terminar una fase, el descanso puede descontarse solo, pero el ejercicio siguiente no comienza hasta una confirmación. Las asignaciones antiguas sin este campo se normalizan como automáticas para no alterar tratamientos ya entregados.

## Estímulos visuales

El motor usa Canvas 2D y `requestAnimationFrame`. El tiempo de animación se acumula únicamente mientras el ejercicio está activo; al pausar, fondo, objeto y temporizador quedan congelados.

Fondos: color sólido, barras optocinéticas, espiral, damero y campo de puntos. Barras, damero y puntos admiten traslación horizontal, vertical y en cuatro direcciones diagonales. La espiral solo admite rotación horaria o antihoraria.

Objetos: blanco fijo, seguimiento suave sinusoidal y sacadas horizontales, verticales, en ambos ejes diagonales o pseudoaleatorias deterministas.

## Plan de ejecución y tareas cognitivas

Antes de guardar o asignar, el editor muestra un plan práctico: material, preparación, respuesta esperada, forma de finalización y advertencias de logística. La modalidad de la sesión se incorpora al análisis; una combinación que no pueda realizarse en domicilio se bloquea o se deriva a revisión presencial. Este análisis no reemplaza el criterio clínico.

Las tareas cognitivas son una capa opcional de los estímulos visuales:

- objetivo raro: las figuras cambian, la persona cuenta la figura acordada y escribe el total al finalizar;
- Go/No-Go: responde verbalmente o toca el botón solamente ante la figura objetivo;
- memoria breve: compara la figura actual con una, dos o tres posiciones anteriores y responde solo cuando coinciden.

La consigna completa aparece antes del ejercicio y el temporizador no comienza hasta que la persona confirma que la comprendió. Las secuencias de figuras son deterministas. En respuesta táctil se registran aciertos y respuestas fuera del objetivo; en conteo se conserva el total informado y la cantidad real de eventos presentados. Estos registros describen la ejecución de la tarea y no constituyen una evaluación diagnóstica.

La configuración inicial es pantalla 2D, sentado, superficie firme, ritmo lento, una sola tarea y memoria de una posición. Las tareas cognitivas se bloquean en VR Box y Quest en esta versión porque no existe un flujo fiable para leer la consigna y confirmar la respuesta. También se bloquea tocar la pantalla durante RVO x1, RVO x2 u objetivo recordado, porque altera la posición de ejecución. La combinación con una tarea vestibular u oculomotora se identifica como doble tarea y exige comprobar previamente la tarea aislada.

Fondo y objeto usan parámetros independientes. Los movimientos se calculan como funciones continuas del tiempo o pasos por Hz, de modo que el patrón no termina antes de la fase.

## Reproductor y dispositivos

- pausa, continuación, omisión, salida y pantalla completa;
- preparación propia antes de cada fase;
- tiempo activo sin pausas ni descansos;
- metrónomo configurable fuera de VR Box;
- confirmación táctil, mouse o teclado en pantalla 2D;
- VR Box con dos vistas sincronizadas, exclusivamente para ejercicios por tiempo, sentado en superficie firme y con finalización automática;
- Quest en navegador BETA con selección mediante controlador, manos o puntero compatible.

Antes de entrar a VR Box aparece un aviso en pantalla normal. Al confirmar, comienza una transición de 20 segundos para colocar el celular y el visor. Cada mitad muestra el mismo marcador de fusión: la persona debe percibir uno solo, nítido y cómodo; si lo ve doble o borroso, debe retirar el visor y no comenzar. VR Box 2D no superpone controles ni requiere confirmación dentro del visor. Cardboard sí muestra controles duplicados para pausar, recentrar, omitir o salir. Al terminar el bloque se reservan otros 20 segundos para retirarlo.

Cuando una sesión mezcla cualquier tarea sin visor y VR Box, el constructor recomienda realizar primero todas las fases 2D o manuales y dejar un único bloque VR al final. Esto incluye tareas 2D temporizadas, no solo repeticiones. Si se conserva otro orden, se inserta una transición por cada cambio de equipamiento.

Los ejercicios Quest no inmersivos se renderizan en una ventana 2D. Los escenarios contextuales 360° sí solicitan una sesión WebXR y usan el seguimiento del visor. Una sesión Quest debe contener únicamente ejercicios Quest porque la versión actual no transfiere una ejecución activa entre el visor y otro dispositivo.

## Compatibilidad espacial obligatoria

| Finalidad | Pantalla 2D inmóvil | VR Box | Quest navegador actual | Acción del paciente |
| --- | --- | --- | --- | --- |
| RVO x1 / estabilización de mirada | Sí | Solo Cardboard 3DoF presencial | No en el lienzo Quest 2D | Fijar el blanco y mover la cabeza |
| RVO x2 / estabilización de mirada | Sí | No | No, hasta validar anclaje WebXR | Seguir el blanco y mover la cabeza en sentido opuesto |
| Objetivo recordado / sustitución (alias RVO x3) | Sí | No | No | Mirar, cerrar ojos, girar cabeza y comprobar al reabrir |
| Seguimiento ocular suave | Sí | Sí | Sí | Mantener cabeza quieta y seguir el blanco con los ojos |
| Sacadas | Sí | Sí | Sí | Mantener cabeza quieta y cambiar la mirada |
| Optocinético | Sí | Sí | Sí | Sentado, cabeza quieta, observar el patrón móvil |
| Habituación visual | Sí | Sí | Sí | Sentado, cabeza quieta, observar el movimiento dosificado |
| Exposición contextual 360° | No | Solo Cardboard 3DoF presencial | Sí, WebXR presencial | Explorar el entorno desde postura sentada |
| Tarea cognitivo-visual | Sí | No | No | Sentado, comprender la consigna y responder según el estímulo |
| Tarea física o funcional | Sí | No | No | Ejecutar fuera del visor con el entorno visible |
| Libre | Según configuración | Según límites técnicos | Según límites técnicos | Definido y revisado por el profesional |

En VR Box 2D el lienzo acompaña la cabeza. Cardboard 3DoF contrarresta la orientación tras una calibración frontal y por eso admite RVO x1 bajo supervisión clínica, pero no RVO x2 ni objetivo recordado. Quest inicia WebXR solamente para escenarios 360°; sus ejercicios visuales comunes siguen en un panel 2D. Seguimiento y sacadas con cabeza quieta son tareas oculomotoras y no se rotulan como sustitutos de la estabilización de mirada.

## Modo Libre

`custom_free` permite conservar como plantilla cualquier combinación de fondo, objeto, trayectoria, colores, amplitud, frecuencia, dosis, postura y dispositivo, incluso si no cumple las reglas de una finalidad clínica cerrada. La biblioteca no bloquea su guardado. La interfaz lo identifica en amarillo como configuración profesional no validada y no infiere que sea RVO, sustitución, habituación u optocinético.

Guardar y asignar son operaciones distintas. Al crear una sesión se mantienen los límites técnicos de VR Box (tiempo, avance automático, sin metrónomo, postura sentada y superficie firme), las reglas de ayuda para superficie inestable o marcha domiciliaria y la exclusividad de dispositivo en Quest.

## Límites clínicos y técnicos

- Los rangos de velocidad, frecuencia, amplitud y diagonal son controles técnicos, no dosis clínicamente validadas.
- El generador visual no mide técnica, postura, velocidad cefálica ni repeticiones reales.
- El sonido puede requerir una primera interacción si el navegador bloquea audio automático; por ese motivo el metrónomo se deshabilita en VR Box.
- VR Box 2D duplica el estímulo sin seguimiento. Cardboard 3DoF agrega orientación, corrección radial manual y perfil óptico por combinación teléfono–visor, pero no posición 6DoF ni calibración oficial por código QR.
- El blanco se limita a la zona visible de cada mitad para evitar que su tamaño o amplitud lo recorten en el borde.
- Quest muestra un lienzo 2D para ejercicios visuales comunes y solicita `XRSession` con espacio de referencia local para escenarios 360°.
- Las tareas físicas se bloquean en ambos visores, incluso con supervisión, porque el entorno queda oculto y el reproductor no controla la ejecución corporal.
- Se requieren pruebas físicas en celulares, VR Box, tablets, HDMI y Meta Quest antes del piloto.

## Pruebas

Las funciones de seguimiento y sacadas se prueban separadas del Canvas, incluidos ambos ejes diagonales. Las posiciones aleatorias son deterministas y el blanco se mantiene completo dentro de cada vista. La matriz automática recorre 960 combinaciones operativas de VR Box, 80 combinaciones de patrón/dirección y 1092 secuencias de hasta seis ejercicios, además de las pruebas del flujo, preparación, confirmación y trazabilidad. El reproductor vuelve a validar una configuración heredada antes de mostrarla al paciente.
