# 06: Recuperación ante fallos

**What to build:** Si Locky deja de responder durante un bloqueo, las extensiones restringen la navegación web y la aplicación intenta reiniciarse; al reconectar, los navegadores recuperan el estado y tiempo restante correctos.

**Blocked by:** 01: Locky permanece en segundo plano; 02: Primer bloqueo sobre Chrome.

**Status:** resolved

- [ ] Una caída inesperada provoca un intento automático de reiniciar Locky.
- [ ] Mientras no hay respuesta de Locky, Chrome, Brave y Edge no cargan nuevas páginas web sin confirmar el estado.
- [ ] Al volver Locky, cada extensión recupera las reglas consolidadas y el vencimiento del bloqueo compartido.
- [ ] Si el período ya venció durante la caída, se libera la navegación permitida; las páginas prohibidas continúan bloqueadas.
- [ ] La prueba distingue una caída recuperable de una intervención deliberada de una cuenta administradora de Windows.

## Answer

El host nativo consulta el pipe y exige una respuesta `getState`; si Locky no responde, cierra el host para que Chromium active `onDisconnect`. La extensión coloca una regla DNR de sesión que bloquea navegación web, reintenta y la elimina solo después de recibir y aplicar el estado. El host reinicia Locky con `--background`. La prueba del worker verifica el bloqueo al desconectar; los dos helpers C# compilaron. La caída y recuperación de proceso real aún no se inyectó en una sesión de navegador.
