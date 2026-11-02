# Bloqueo de navegadores en segundo plano — implementation map

## Notes

- La especificación fuente es `spec.md`; los tickets forman el grafo de implementación.
- La rama de integración activa es `integration`.
- La validación de Chrome, Brave y Edge instalados usa perfiles temporales desechables; el harness no debe tocar perfiles normales.

## Decisions-so-far

- Tickets 01–06 están implementados en la rama de integración. El overlay usa una ventana propiedad de cada ventana Chromium, y el vencimiento compartido se almacena como hora de Windows. Véanse los Answers de los tickets 01–06.
- Las extensiones mantienen navegación web bloqueada con una regla DNR de sesión si se desconectan; solo liberan esa regla después de sincronizar reglas válidas.
- Los fallos de asociación del overlay se muestran como reparación del navegador afectado; una instalación empaquetada cierra solo ese navegador.
- `src/domain/protected-browser-families.cjs` es la fuente única del mapa familia→ejecutable. Browser health, watcher, control de procesos y scope de pruebas comparten Chrome, Brave y Edge; Firefox y Opera no se detectan ni entran en reparación.
- Ticket 07 quedó `resolved` tras `pnpm smoke:browser-lifecycle` y `pnpm smoke:desktop-recovery` el 1 de noviembre. El E2E instalado comprobó rutas bloqueadas, overlays/countdown, configuración cerrada y reabierta en la misma instancia, minimizar/restaurar, ventanas nuevas, cerrar/reabrir navegadores y vencimiento real a siete minutos. La reparación con perfil temporal de Chrome sin extensión cerró solo el árbol PID de prueba; Brave/Edge temporales siguieron abiertos. Después, la ventana/PID normal de Chrome seguía presente y fuera de scope; no había una ventana Edge visible en la captura inicial. El launcher C# compilado temporalmente detectó la pipe caída, salió y relanzó automáticamente el Electron de prueba tras una solicitud reconectada; se conservaron la regla y el `endsAt`, que venció en el deadline original. `pnpm test` pasó 69/69. Véase [issue 07](issues/07-reparacion-y-verificacion-en-tres-navegadores.md).
- La suite automatizada pasó 69/69; el smoke del vigilante completó 100 snapshots (mediana 8.337 ms, p95 12.566 ms, máximo 14.179 ms, estimación de CPU de 1.782 % a 500 ms). Los dos auxiliares C# compilaron y los cuatro scripts PowerShell parsearon sin errores.
- El smoke de ticket 07 usa DevTools pipe y carga la extensión en perfiles temporales porque las versiones branded actuales de Chrome ya no cargan extensiones con `--load-extension`; la reparación E2E está restringida al PID de Chrome temporal.
- El proveedor inicial contiene 129 dominios, que se consolidan automáticamente como reglas preaprobadas. No se muestra la lista ni existe botón de aprobación. El estado previo conserva sus reglas y las propuestas guardadas por versiones anteriores se migran a reglas consolidadas. Véase [ticket 05](../bloqueo-navegacion/issues/05-lista-inicial-revisable.md).

## Fog

- El snapshot Win32 inicial no encontró una ventana visible de Edge preexistente; la comprobación de ventana normal preservada se limita a la ventana visible de Chrome que sí capturó el harness. Los procesos y ventanas temporales E2E quedaron dentro del alcance PID explícito.
- La recuperación automática se probó con una copia temporal del launcher C# y rutas app/pipe/datos aisladas; no se invocó el registro del launcher ni el binario instalado. La caída del worker nativo del navegador y un reinicio físico de Windows no se simularon.
