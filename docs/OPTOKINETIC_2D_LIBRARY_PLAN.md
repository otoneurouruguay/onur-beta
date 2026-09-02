# Biblioteca ambiental 2D · plan clínico y técnico

## Alcance

La biblioteca ambiental 2D será una exposición visual graduada en pantalla inmóvil. No se rotulará como experiencia 360°, realidad virtual, marcha virtual ni ejercicio de RVO. Su finalidad será complementar habituación a movimiento visual, fijación ante fondo móvil o exposición contextual cuando el profesional haya definido el objetivo y el techo de síntomas.

No se incrustarán videos de YouTube como material clínico predeterminado. Antes de incorporar un archivo se verificará licencia, autor, permiso de descarga y uso, estabilidad de cámara, cortes, horizonte, audio, resolución, cuadros por segundo, códec, duración y checksum.

## Primer catálogo propuesto

1. Supermercado con cámara fija y tránsito visual leve.
2. Pasillo de supermercado con avance lento y horizonte estable.
3. Calle tranquila desde un punto fijo.
4. Cruce peatonal con incremento gradual de tránsito.
5. Centro comercial con cámara fija.
6. Farmacia con búsqueda visual lenta.
7. Parada de ómnibus con movimiento lateral moderado.
8. Terminal con flujo multidireccional progresivo.
9. Viaje urbano como acompañante, sin giros bruscos.
10. Manejo urbano con horizonte estable, sin cortes rápidos.

## Metadatos obligatorios

- Identificador, título clínico y fuente original.
- Autor, licencia y alcance permitido.
- Archivo original y versión optimizada con checksum SHA-256.
- Resolución, FPS, códec, bitrate, duración y relación de aspecto.
- Cámara fija o móvil; dirección y velocidad aproximada del movimiento.
- Estabilidad del horizonte, cantidad de cortes y presencia de flashes.
- Densidad visual, audio ambiente y volumen de inicio.
- Nivel técnico de intensidad, contraindicaciones y reglas de pausa.
- Dispositivos autorizados y fecha de revisión profesional.

## Reglas de implementación

- Pantalla 2D: modalidad inicial principal.
- Quest: podrá mostrar el video en una pantalla virtual clínica, aclarando que no es inmersión espacial.
- VR Box/Cardboard: no se habilitará automáticamente. Cada archivo necesitará una revisión específica de confort binocular, escala, latencia y capacidad de salida inmediata.
- El audio estará apagado por defecto y se agregará como una variable separada.
- Un blanco superpuesto sólo se permitirá cuando la tarea sea explícitamente fijación ante movimiento visual. No se agregará por decoración.
- Se progresará una sola variable por vez: duración, velocidad, cobertura, contraste, complejidad de escena o audio.
- No se mezclará una exposición ambiental con repeticiones que obliguen a retirar y recolocar el visor dentro de la misma fase.

## Etapas de incorporación

1. Adquirir o producir archivos con licencia verificable.
2. Revisar cada video completo y descartar cortes, flashes, inestabilidad o movimiento incoherente.
3. Generar versiones optimizadas y registrar checksum.
4. Probar reproducción, pausa, salida y recuperación en PC, Samsung Galaxy S21+ y Quest.
5. Incorporar primero dos niveles de cámara fija y luego dos de cámara móvil lenta.
6. Habilitar más niveles sólo después de revisar tolerancia y carga técnica en consulta.
