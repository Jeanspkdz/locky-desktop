# 02: Reglas de dominio y ruta

**What to build:** La persona puede agregar una regla de dominio o de ruta desde Locky, revisar la página durante diez minutos y cancelar la regla antes de que se consolide. Después de consolidarla, la propia aplicación no ofrece editarla ni retirarla; Chrome aplica la regla correcta.

**Blocked by:** 01: Primer bloqueo en Chrome.

**Status:** resolved

- [x] Una regla de dominio cubre el dominio, sus subdominios y todas sus rutas, sin alcanzar dominios de nombre parecido.
- [x] Una regla de ruta cubre la ruta indicada y sus rutas inferiores, sin alcanzar otras rutas o perfiles parecidos.
- [x] La página agregada permanece accesible durante los diez minutos de verificación y la regla puede cancelarse entonces.
- [x] Al terminar la verificación sin cancelación, la regla se consolida y la aplicación no ofrece editarla ni retirarla.
- [x] Las reglas consolidadas siguen aplicándose al cerrar y volver a abrir Locky.

## Answer

- `src/domain/rules.js` normalizes and matches domain and route rules at host and path boundaries. `src/domain/locky-state.js` keeps user rules pending for ten minutes, supports cancellation during that window, and consolidates expired rules permanently in the app UI.
- Both Chromium and Firefox rule builders use main-frame blocking rules. Path filters include non-default ports so their browser-side matching agrees with Locky's normalized host/path matching.
- `tests/domain/browser-rules.test.js` covers domain and route boundaries, pending timers are covered in `tests/domain/locky-state.test.js`, and browser rules persist through `tests/domain/state-store.test.js`.

Implementation evidence: [map.md](../map.md#decisions-so-far).
