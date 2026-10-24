# 01: Primer bloqueo en Chrome

**What to build:** Al intentar abrir en Chrome un dominio configurado como página prohibida, la página no carga y Locky muestra la página de bloqueo en Electron. Este primer recorrido conecta navegador, reglas y escritorio con un caso simple y demostrable.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Un dominio configurado como prohibido no carga en Chrome y activa la página de bloqueo.
- [ ] Un dominio no prohibido sigue cargando normalmente.
- [x] La página de bloqueo muestra el mensaje acordado sin revelar el dominio.
- [ ] El modo incógnito de Chrome está deshabilitado mientras Chrome está protegido.
- [ ] El recorrido funciona en Windows usando dependencias y scripts gestionados por `pnpm`.

## Evidence

- `src/renderer/lock.html` renders “Se activó el bloqueo” and “Cerrar navegadores”; `src/renderer/lock.js` only invokes the close action. The overlay receives no blocked URL or timer value.
