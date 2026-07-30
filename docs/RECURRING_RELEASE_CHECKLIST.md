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
- coincidencia entre la versión de la app y el caché PWA;
- ausencia de activación o recarga automática del service worker;
- respuesta pública correcta de la URL de ONUr.

## Regresiones de prioridad alta

- [ ] **Login estable:** escribir correo/usuario y contraseña/PIN, esperar al menos 90 segundos y comprobar que los campos, el foco y la pantalla no se reinician.
- [ ] **Actualización segura:** una versión nueva puede descargarse, pero solo se activa después de cerrar todas las pestañas de ONUr y volver a abrir.
- [ ] **Acceso público:** abrir `https://onur-beta-clinica.fedeshin.chatgpt.site/` en una ventana privada, sin iniciar sesión en ChatGPT. Debe aparecer el login propio de ONUr.
- [ ] **Identidad instalada:** el ícono de la aplicación debe mostrar el logo vertical oficial; no un punto o círculo amarillo aislado.
- [ ] **Recortes del sistema:** comprobar el ícono normal y el maskable en 192 y 512 px, sin texto o isotipo cortados.
- [ ] **Favicon:** la pestaña debe mostrar el isotipo completo de Otoneuro, con el punto gris visible.
- [ ] **Acceso profesional:** iniciar sesión y abrir Inicio, Pacientes, Sesiones, Estudios, Evaluaciones e Informes.
- [ ] **Acceso domiciliario:** habilitar un paciente de prueba, ingresar con la credencial temporal y comprobar que el cambio de PIN es obligatorio.
- [ ] **Aislamiento del PIN temporal:** intentar abrir `/paciente/hoy` antes de cambiar el PIN; debe volver a la creación de PIN.
- [ ] **Datos reales:** Inicio y perfil no deben mostrar pacientes, horarios, adherencia, documentos o actividad demostrativa.
- [ ] **Borrado trazable:** eliminar el paciente de prueba y confirmar que desaparece de la lista y que su acceso deja de funcionar.

## Regresiones clínicas y de trazabilidad

- [ ] Al salir de una sesión en curso aparece una advertencia.
- [ ] Si se confirma la salida, el avance parcial y el tiempo activo quedan registrados.
- [ ] Las evaluaciones visibles para el paciente aparecen en el portal domiciliario.
- [ ] Crear o editar un paciente conserva CI, acceso domiciliario y demás datos clínicos.
- [ ] Los cambios hechos en parámetros de VR se reflejan en la reproducción.
- [ ] Los controles de video VR se ocultan durante la reproducción y reaparecen al tocar la pantalla.

## Antes y después del despliegue

- [ ] Revisar que Git incluya solo archivos intencionales y ningún secreto.
- [ ] Confirmar que migraciones y funciones de Supabase necesarias estén publicadas.
- [ ] Publicar una versión guardada que corresponda exactamente al commit validado.
- [ ] Confirmar que el sitio siga en modo público.
- [ ] Abrir la URL de producción y repetir login estable y acceso domiciliario.
- [ ] Eliminar todos los pacientes y sesiones creados exclusivamente para QA.
