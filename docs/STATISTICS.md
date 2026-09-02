# Estadísticas descriptivas

## Objetivo

El tablero profesional resume lo que efectivamente está registrado en ONUr. Sirve para revisar actividad y completitud de la información, no para inferir diagnóstico, pronóstico o eficacia terapéutica.

## Filtros

- paciente individual o toda la cartera;
- últimos 30 días, últimos 90 días o todo el historial;
- se excluyen asignaciones revocadas y fechas futuras.

## Definiciones operativas

- **Sesión realizada:** estado `completed` o `partial`.
- **Porcentaje de realización:** sesiones realizadas dividido sesiones no revocadas del período.
- **Tiempo activo:** suma de `active_seconds` en ejecuciones completas o parciales.
- **Progreso de tiempo activo:** tiempo activo dividido duración planificada, limitado al 100 %. No mide calidad de ejecución.
- **Comparación DHI:** resta aritmética final menos inicial del puntaje total y de las subescalas física, emocional y funcional. Solo se genera cuando ambos DHI están completos y pertenecen al mismo ciclo, instrumento y versión.

## Límites

- no se aplican puntos de corte ni población normativa;
- no se atribuyen cambios al entrenamiento;
- no se mezclan cuestionarios incompletos o versiones incompatibles;
- no se transforma actividad en una recomendación médica;
- las comparaciones no se publican automáticamente al portal del paciente.

## Privacidad

El cálculo ocurre sobre registros que ya están autorizados para el profesional por RLS. El tablero no crea una tabla analítica paralela ni exporta datos. Los filtros y cálculos se ejecutan en la sesión del navegador.
