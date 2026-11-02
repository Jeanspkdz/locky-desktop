# 06: Protección en Edge

**What to build:** Edge aplica las reglas de dominio y ruta de Locky y activa el bloqueo del escritorio ante una página prohibida. La navegación InPrivate queda deshabilitada.

**Blocked by:** 01: Primer bloqueo en Chrome; 02: Reglas de dominio y ruta.

**Status:** resolved

- [x] Una página prohibida no carga en Edge y activa la página de bloqueo.
- [x] Una página permitida carga; las reglas de ruta no bloquean el resto del sitio.
- [x] InPrivate no puede abrirse durante el uso protegido de Edge.
- [x] Las reglas consolidadas se aplican de nuevo tras cerrar y abrir Edge.

## Comments

- Installed-browser smoke on 2026-10-27: Edge loaded the Locky MV3 service worker in an isolated profile and Locky's native state reports Edge `healthy`. The per-user policy sets `InPrivateModeAvailability=1`. Blocked/allowed navigation and restart persistence still need an active rule scenario; ticket remains open.

## Answer

- In isolated installed Edge, `/blocked/child` returned `ERR_BLOCKED_BY_CLIENT`; `/allowed` loaded. The current four path filters were present in DNR.
- Closed and relaunched the isolated Edge profile with the local extension. Locky re-synced the rules and the same blocked/allowed checks passed; Edge reported `healthy` to the disposable desktop app.
- Verified `InPrivateModeAvailability=1` in the per-user Edge policy.
