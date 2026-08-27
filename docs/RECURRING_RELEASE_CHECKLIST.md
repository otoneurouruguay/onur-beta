# Checklist recurrente antes de publicar ONUr

Este control es bloqueante. Si un punto falla, no se hace `push` ni se despliega una versión.

## Control automático

Ejecutar:

```bash
npm run release:check
```

Debe finalizar sin errores. El comando verifica:

- tipos, lint y toda la suite de pruebas;
- compilación autenticada de producción;
- arranque local autenticado, con conversión segura de las variables públicas de Supabase;
- coincidencia entre la versión de la app y el caché PWA;
- activación inmediata del caché nuevo y toma de control de pestañas abiertas;
- presencia de los controles clínicos y de recuperación de borradores;
- respuesta pública correcta tanto de la portada como de `/app/ejercicios`.

## Regresiones de prioridad alta

- [ ] **Vista previa local autenticada:** iniciar con `npm run dev`, abrir `/ingresar` y comprobar que el botón diga “Ingresar”; nunca “Acceso no disponible”. Iniciar sesión una vez en `127.0.0.1` y confirmar que `/app` no vuelve al login.
- [ ] **Login estable:** escribir correo/usuario y contraseña/PIN, esperar al menos 90 segundos y comprobar que los campos, el foco y la pantalla no se reinician.
- [ ] **Actualización segura:** una versión nueva se activa aunque haya una pestaña abierta; no queda una mezcla de HTML o archivos de versiones distintas y la pantalla no queda en blanco.
- [ ] **Borrador durante actualización:** modificar un ejercicio, esperar la actualización y recargar; el borrador debe recuperarse automáticamente.
- [ ] **Acceso público:** abrir `https://onur-beta-clinica.fedeshin.chatgpt.site/` en una ventana privada, sin iniciar sesión en ChatGPT. Debe aparecer el login propio de ONUr.
- [ ] **Identidad instalada:** el ícono de la aplicación debe mostrar el logo vertical oficial; no un punto o círculo amarillo aislado.
- [ ] **Recortes del sistema:** comprobar el ícono normal y el maskable en 192 y 512 px, sin texto o isotipo cortados.
- [ ] **Favicon:** la pestaña debe mostrar el isotipo completo de Otoneuro, con el punto gris visible.
- [ ] **Acceso profesional:** iniciar sesión y abrir Inicio, Pacientes, Sesiones, Ejercicios, Estudios, Evaluaciones e Informes; ninguna pantalla puede quedar indefinidamente en “Verificando acceso…”.
- [ ] **Constructor clínico publicado:** en Ejercicios debe verse “Orientación por patología”, el selector con 11 patologías y las familias de imágenes rápidas y estroboscópicos experimentales.
- [ ] **Biblioteca acumulativa:** elegir al menos dos ejercicios distintos de la biblioteca, usar “Agregar a la selección” en cada uno y confirmar que ambos permanecen en la lista, sin que el segundo reemplace al primero.
- [ ] **Historial de sesiones:** abrir una sesión finalizada desde el perfil, comprobar que se vean ejercicios, resultados y comentarios, y que la vista sea de solo lectura.
- [ ] **Repetición domiciliaria:** duplicar o programar una sesión ya realizada; la nueva asignación debe conservar los ejercicios pero comenzar sin progreso, resultado ni estado finalizado.
- [ ] **Acceso domiciliario:** habilitar un paciente de prueba, ingresar con la credencial temporal y comprobar que el cambio de PIN es obligatorio.
- [ ] **DHI enviado al portal:** asignar un DHI inicial a un paciente de prueba y comprobar que aparece solamente en su portal, sin correo ni WhatsApp.
- [ ] **Borrador DHI:** responder una parte desde el portal, usar “Guardar avance”, cerrar y volver a entrar; las mismas respuestas deben continuar marcadas.
- [ ] **DHI domiciliario completo:** el paciente nunca ve puntos por opción, total ni subescalas; el botón “Enviar” permanece bloqueado hasta contestar los 25 ítems. Al finalizar ya no puede editar, mientras que el profesional ve el resultado completo y cada respuesta.
- [ ] **DHI presencial:** usar “Iniciar cuestionario” desde el perfil, completar los 25 ítems y verificar el resultado; si se interrumpe, “Continuar presencial” debe recuperar la asignación abierta.
- [ ] **Comparación DHI:** completar un inicial y un final del mismo ciclo y versión; el perfil debe mostrar el cambio total y por subescala. Nunca mezclar ciclos ni formularios incompletos.
- [ ] **Cancelación DHI:** cancelar una asignación pendiente; debe desaparecer del portal, quedar auditada y permitir una nueva asignación del mismo momento. Un resultado finalizado no se puede cancelar.
- [ ] **Retiro del cuestionario anterior:** no deben aparecer el formulario propio de 18 preguntas, registros demostrativos ni su PDF descargable.
- [ ] **Aislamiento del PIN temporal:** intentar abrir `/paciente/hoy` antes de cambiar el PIN; debe volver a la creación de PIN.
- [ ] **Datos reales:** Inicio y perfil no deben mostrar pacientes, horarios, adherencia, documentos o actividad demostrativa.
- [ ] **Borrado trazable:** eliminar el paciente de prueba y confirmar que desaparece de la lista y que su acceso deja de funcionar.

## Regresiones clínicas y de trazabilidad

- [ ] Al salir de una sesión en curso aparece una advertencia.
- [ ] Si se confirma la salida, el avance parcial y el tiempo activo quedan registrados.
- [ ] Las evaluaciones visibles para el paciente aparecen en el portal domiciliario.
- [ ] Crear o editar un paciente conserva CI, acceso domiciliario y demás datos clínicos.
- [ ] Confirmar una posturografía genera el informe aunque el lector haya conservado metadatos auxiliares sin métrica, como “Estado del estudio”.
- [ ] Un vHIT narrativo fotografiado se clasifica como informe, no como página de curvas, aunque mencione HIMP, SHIMP, ganancias y simetría.
- [ ] El OCR de vHIT conserva negaciones y continuaciones clínicas: no debe truncar antecedentes, motivo, síntomas, conclusión ni conducta en expresiones como “de una”, “no” o después de “Cancelación del VOR”.
- [ ] El OCR separa campos vecinos (por ejemplo, test vibracional y cancelación del VOR) y normaliza grados como `30°` sin convertirlos en porcentaje.
- [ ] Un informe confirmado conserva su historial; las mejoras del lector reprocesan únicamente cargas nuevas o borradores pendientes de revisión.
- [ ] Si falla el guardado o la confirmación de un estudio, la interfaz muestra el motivo devuelto por el servidor y no solo un error genérico.
- [ ] Los cambios hechos en parámetros de VR se reflejan en la reproducción.
- [ ] Los controles de video VR se ocultan durante la reproducción y reaparecen al tocar la pantalla.

## Antes y después del despliegue

- [ ] Revisar que Git incluya solo archivos intencionales y ningún secreto.
- [ ] Ejecutar la migración contra el PostgreSQL remoto antes de desplegar el cliente; no asumir que una simulación de `db push` valida la disponibilidad de todas las funciones SQL.
- [ ] Confirmar que migraciones y funciones de Supabase necesarias estén publicadas.
- [ ] Publicar una versión guardada que corresponda exactamente al commit validado.
- [ ] Confirmar que el sitio siga en modo público.
- [ ] Ejecutar `npm run release:verify-published`; debe confirmar que el paquete principal, el constructor y `sw.js` coinciden exactamente con la compilación validada.
- [ ] Abrir una pestaña que tuviera la versión anterior, recargar una vez y confirmar que entra a la versión nueva sin pantalla en blanco ni pérdida del borrador.
- [ ] Abrir la URL de producción y repetir login estable, acceso profesional a `/app/ejercicios` y acceso domiciliario.
- [ ] Eliminar todos los pacientes y sesiones creados exclusivamente para QA.
