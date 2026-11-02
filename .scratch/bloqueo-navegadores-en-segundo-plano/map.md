# Bloqueo de navegadores en segundo plano — implementation map

## Notes

- La especificación fuente es `spec.md`; los tickets forman el grafo de implementación.
- La rama de integración activa es `integration`.
- La validación de Chrome, Brave y Edge instalados usa perfiles temporales desechables; el harness no debe tocar perfiles normales.

## Decisions-so-far

- Tickets 01–06 están implementados en la rama de integración. El overlay usa una ventana propiedad de cada ventana Chromium, y el vencimiento compartido se almacena como hora de Windows. Véanse los Answers de los tickets 01–06.
- Las extensiones mantienen navegación web bloqueada con una regla DNR de sesión si se desconectan; solo liberan esa regla después de sincronizar reglas válidas.
- Los fallos de asociación del overlay se muestran como reparación del navegador afectado; una instalación empaquetada cierra solo ese navegador.
- Ticket 07 quedó `resolved` tras `pnpm smoke:browser-lifecycle` el 1 de noviembre: Chrome, Brave y Edge instalados bloquearon la ruta fixture y mostraron overlays; el smoke comprobó cuenta regresiva, minimizar/restaurar, ventanas adicionales, cierre/reapertura y vencimiento real compartido a siete minutos. Un perfil temporal de Chrome sin extensión activó reparación y solo se cerró el árbol incluido en su alcance PID; los perfiles temporales de Brave y Edge siguieron abiertos. La comprobación posterior confirmó que la ventana visible previa de Chrome seguía presente y su PID no estuvo en alcance; no se encontró una ventana visible de Edge al iniciar. `pnpm test` pasó 64/64. Véase [issue 07](issues/07-reparacion-y-verificacion-en-tres-navegadores.md).
- La suite automatizada pasó 64/64; el smoke del vigilante completó 100 snapshots (mediana 8.337 ms, p95 12.566 ms, máximo 14.179 ms, estimación de CPU de 1.782 % a 500 ms). Los dos auxiliares C# compilaron y los cuatro scripts PowerShell parsearon sin errores.
- El smoke de ticket 07 usa DevTools pipe y carga la extensión en perfiles temporales porque las versiones branded actuales de Chrome ya no cargan extensiones con `--load-extension`; la reparación E2E está restringida al PID de Chrome temporal.
- El proveedor inicial contiene 129 dominios, que se consolidan automáticamente como reglas preaprobadas. No se muestra la lista ni existe botón de aprobación. El estado previo conserva sus reglas y las propuestas guardadas por versiones anteriores se migran a reglas consolidadas. Véase [ticket 05](../bloqueo-navegacion/issues/05-lista-inicial-revisable.md).

## Fog

- El snapshot Win32 inicial no encontró una ventana visible de Edge preexistente; la comprobación de ventana normal preservada se limita a la ventana visible de Chrome que sí capturó el harness. Los procesos y ventanas temporales E2E quedaron dentro del alcance PID explícito.
- No se simuló una caída real del proceso nativo ni un reinicio físico de Windows. Las pruebas automatizadas cubren el seam del worker, el controlador y la persistencia del vencimiento.
