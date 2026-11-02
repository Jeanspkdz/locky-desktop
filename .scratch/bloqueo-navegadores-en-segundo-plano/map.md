# Bloqueo de navegadores en segundo plano — implementation map

## Notes

- La especificación fuente es `spec.md`; los tickets forman el grafo de implementación.
- La rama de integración activa es `integration`.
- La validación de Chrome, Brave y Edge en perfiles instalados es obligatoria antes de cerrar el ticket 07.

## Decisions-so-far

- Tickets 01–06 están implementados en la rama de integración. El overlay usa una ventana propiedad de cada ventana Chromium, y el vencimiento compartido se almacena como hora de Windows. Véanse los Answers de los tickets 01–06.
- Las extensiones mantienen navegación web bloqueada con una regla DNR de sesión si se desconectan; solo liberan esa regla después de sincronizar reglas válidas.
- Los fallos de asociación del overlay se muestran como reparación del navegador afectado; una instalación empaquetada cierra solo ese navegador.
- Ticket 07 está `claimed`: el smoke instalado del 29 de octubre comprobó navegación prohibida y overlay en Chrome, Brave y Edge; solo observó el vencimiento completo en Brave. La prueba TDD añadida verifica que una reparación de Edge solo solicita cerrar `msedge.exe`. Véase [issue 07](issues/07-reparacion-y-verificacion-en-tres-navegadores.md).
- La suite automatizada pasó 58/58; el smoke del vigilante completó 100 snapshots (mediana 8.337 ms, p95 12.566 ms, máximo 14.179 ms, estimación de CPU de 1.782 % a 500 ms). Los dos auxiliares C# compilaron y los cuatro scripts PowerShell parsearon sin errores.
- Las pruebas de control de procesos y overlays cubren en Chrome, Brave y Edge el cierre selectivo, minimizar/restaurar, cerrar/reabrir y vencimiento al nivel del controlador. No sustituyen el E2E instalado que pide el ticket 07.
- El proveedor inicial contiene 129 dominios, que se consolidan automáticamente como reglas preaprobadas. No se muestra la lista ni existe botón de aprobación. El estado previo conserva sus reglas y las propuestas guardadas por versiones anteriores se migran a reglas consolidadas. Véase [ticket 05](../bloqueo-navegacion/issues/05-lista-inicial-revisable.md).

## Fog

- En los tres navegadores instalados se verificaron la navegación prohibida y la ventana de bloqueo; falta comprobar en cada uno cierre/reapertura, minimizar/restaurar, ventanas adicionales y vencimiento. La ruta real de reparación por extensión faltante tampoco se ensayó.
- Tampoco se simuló una caída real del proceso nativo ni un reinicio físico de Windows. Las pruebas automatizadas cubren el seam del worker, el controlador y la persistencia del vencimiento.
