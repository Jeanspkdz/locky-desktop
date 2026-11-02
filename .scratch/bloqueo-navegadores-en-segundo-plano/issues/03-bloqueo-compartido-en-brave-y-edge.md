# 03: Bloqueo compartido en Brave y Edge

**What to build:** Un intento prohibido en Chrome, Brave o Edge activa un único bloqueo de navegadores que cubre todas las ventanas abiertas de los tres con el mismo tiempo restante.

**Blocked by:** 02: Primer bloqueo sobre Chrome.

**Status:** resolved

- [ ] Un intento prohibido en Brave o Edge impide cargar la página y activa el mismo bloqueo que en Chrome.
- [ ] Todas las ventanas abiertas de Chrome, Brave y Edge muestran la página de bloqueo, incluidas ventanas nuevas durante el período.
- [ ] El tiempo restante es compartido y un intento adicional no crea otro período ni reinicia el actual.
- [ ] La configuración interna y otras pestañas de un navegador cubierto quedan detrás de su ventana de bloqueo mientras Locky funciona.
- [ ] Las demás aplicaciones de Windows siguen disponibles.

## Answer

El mismo estado `desktopLock` y su `endsAt` se comparte entre Chrome, Brave y Edge. El controlador crea un overlay para cada ventana Chromium visible y una ventana nueva recibe el tiempo que queda. Las pruebas del worker verifican la identificación de Brave y Edge y las del controlador verifican los tres grupos de ventana; el smoke instalado queda pendiente en el ticket 07.
