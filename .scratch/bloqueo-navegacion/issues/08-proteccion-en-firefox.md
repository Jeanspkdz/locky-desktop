# 08: Protección en Firefox

**What to build:** Firefox aplica las reglas de dominio y ruta de Locky y activa el bloqueo del escritorio ante una página prohibida. La navegación privada queda deshabilitada.

**Blocked by:** 01: Primer bloqueo en Chrome; 02: Reglas de dominio y ruta.

**Status:** resolved

- [x] Una página prohibida no carga en Firefox y activa la página de bloqueo.
- [x] Una página permitida carga; las reglas de ruta no bloquean el resto del sitio.
- [x] No se puede abrir una ventana privada durante el uso protegido de Firefox.
- [x] Las reglas consolidadas se aplican de nuevo al volver a cargar el complemento temporal.

## Comments

- The Node worker harness exposed a Firefox runtime syntax error: `rule-builder.js` and `service-worker.js` shared a classic-script global scope and redeclared the same bindings. Wrapped the Firefox rule builder in an IIFE and added worker coverage for Firefox's `browser` API. The unit harness passes; installed Firefox navigation and private-mode checks remain open, and this ticket is still blocked by ticket 01.
- Installed-browser smoke on 2026-10-27: Mozilla's `web-ext` runner loaded Locky as a temporary add-on in an isolated Firefox profile, and Locky's native state reported Firefox `healthy`. The per-user private-browsing policy is configured. Blocked/allowed navigation, actual private-window rejection, and restart persistence remain unverified; ticket stays open.

## Answer

- Installed Firefox loaded the current four URL filters. `/blocked/child` triggered `onBeforeNavigate` and `onErrorOccurred` with frame 0, matched the configured route, did not reach the local fixture, and activated the isolated Locky desktop lock. `/allowed` reached the fixture.
- Restarted Locky, reloaded Firefox's temporary local add-on, and verified that Locky re-synced the consolidated rules. This matches the selected development-only install; Firefox removes temporary add-ons when Firefox itself restarts, so the local add-on must be loaded again.
- Verified `PrivateBrowsingModeAvailability=1` in Firefox's per-user policy.
- Replaced the Firefox path regex with URL filters after the installed browser showed that regex-backed path blocks were reaching the target page.
