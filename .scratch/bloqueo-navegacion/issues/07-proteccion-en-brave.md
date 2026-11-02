# 07: Protección en Brave

**What to build:** Brave aplica las reglas de dominio y ruta de Locky y activa el bloqueo del escritorio ante una página prohibida. Su navegación privada queda deshabilitada.

**Blocked by:** 01: Primer bloqueo en Chrome; 02: Reglas de dominio y ruta.

**Status:** resolved

- [x] Una página prohibida no carga en Brave y activa la página de bloqueo.
- [x] Una página permitida carga; las reglas de ruta no bloquean el resto del sitio.
- [x] No se puede abrir una ventana privada durante el uso protegido de Brave.
- [x] Las reglas consolidadas se aplican de nuevo tras cerrar y abrir Brave.

## Comments

- Installed-browser smoke on 2026-10-27: Brave loaded the Locky MV3 service worker in an isolated profile and Locky's native state reports Brave `healthy`. `chrome://policy` reports `IncognitoModeAvailability=1`. Blocked/allowed navigation and restart persistence still need an active rule scenario; ticket remains open.

## Answer

- In isolated installed Brave, `/blocked/child` returned `ERR_BLOCKED_BY_CLIENT` and `/allowed` loaded. The extension synced the four current path filters and reported `healthy`.
- Closed and relaunched the isolated Brave profile with the local extension; Locky re-synced its rules and the blocked/allowed checks passed again.
- Verified `IncognitoModeAvailability=1` in Brave's policy.
