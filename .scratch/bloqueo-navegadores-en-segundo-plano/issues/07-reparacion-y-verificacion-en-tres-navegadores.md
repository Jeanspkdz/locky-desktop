# 07: Reparación y verificación en los tres navegadores

**What to build:** Locky impide usar solo el navegador cuya integración falta o falla, explica cómo repararlo y demuestra el flujo completo de bloqueo en Chrome, Brave y Edge instalados.

**Blocked by:** 03: Bloqueo compartido en Brave y Edge; 04: La ventana de bloqueo sigue al navegador; 05: El tiempo sobrevive a suspensión y reinicio; 06: Recuperación ante fallos.

**Status:** claimed

- [ ] Si falta o falla una extensión con reglas consolidadas, se cierra solo el navegador afectado y Locky muestra una indicación de reparación.
- [ ] Los otros navegadores con integración sana y las demás aplicaciones siguen disponibles cuando falla uno.
- [x] En Chrome, Brave y Edge instalados, una página prohibida no carga y aparece una ventana de bloqueo con cuenta regresiva.
- [ ] En los tres navegadores se comprueban cierre y reapertura, minimización y restauración, ventanas adicionales y vencimiento a los siete minutos.
- [x] La validación deja evidencia de lo comprobado en navegadores reales y distingue cualquier caso no verificado de las pruebas automatizadas.

## Answer

Follow-up on 2026-11-02: Process-control tests now verify Chrome, Brave, and Edge each request closure of only their own executable. Overlay-controller tests exercise minimize/restore, close/reopen, remaining time, and expiry for each family; these are controller tests, not installed-browser E2E. The full suite passes 58/58. The live Locky window reports protection active and healthy integrations for Chrome, Brave, and Edge. The installed-profile lifecycle and missing-extension repair flow remain open; the normal Chrome profile and its tabs were left untouched.

El 29 de octubre de 2026 se comprobó en los perfiles reales de Brave, Chrome y Edge la navegación a `https://pornhub.com:65534/.well-known/locky-e2e-probe`. En los tres, la extensión impidió cargar la página (`ERR_BLOCKED_BY_CLIENT`) y se observó la ventana de Locky sobre el navegador con cuenta regresiva (Brave: 02:23; Chrome y Edge: 06:48). El estado persistido registró las tres integraciones como `healthy` y conservó las 50 reglas del usuario. En Brave se observó que la ventana desapareció al vencer los siete minutos; una nueva visita en Edge inició otro bloqueo. La entrada `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\LockyDesktop` apunta al ejecutable empaquetado corregido y este proceso seguía en ejecución. La regresión automatizada del controlador verifica que el overlay se adjunta tras `did-finish-load` aunque `ready-to-show` nunca ocurra; `pnpm test` pasó 50/50. Quedan por comprobar de forma manual en los tres navegadores el cierre y reapertura, minimización/restauración, ventanas adicionales y la ruta de reparación cuando falte una extensión; por eso el ticket sigue abierto.
