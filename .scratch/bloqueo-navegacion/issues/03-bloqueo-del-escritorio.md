# 03: Bloqueo del escritorio en todos los monitores

**What to build:** Un intento de abrir una página prohibida inicia siete minutos de bloqueo del escritorio en todos los monitores. La persona puede cerrar los navegadores desde la pantalla; esta desaparece mientras no haya navegadores abiertos y reaparece por el tiempo restante si vuelve a abrir uno.

**Blocked by:** 01: Primer bloqueo en Chrome.

**Status:** resolved

- [x] La página de bloqueo cubre todos los monitores y dice únicamente que se activó el bloqueo, además de ofrecer «Cerrar navegadores».
- [x] «Cerrar navegadores» cierra los navegadores cubiertos sin cancelar ni reiniciar los siete minutos.
- [x] Al cerrar el último navegador, la página de bloqueo desaparece y el tiempo continúa.
- [x] Al abrir un navegador cubierto antes de vencer el período, la página reaparece por el tiempo restante.
- [x] Tras vencer el período, un intento nuevo inicia otros siete minutos.

## Answer

- `src/main.cjs` creates one fullscreen overlay per display, derives visibility from the active lock and running browser families, and rechecks display and process state once per second. The close action terminates the covered browser processes while leaving the saved lock expiry intact.
- `src/domain/locky-state.js` preserves an unexpired lock and starts a new seven-minute lock after expiry. The lock page contains the agreed message and the «Cerrar navegadores» action without passing it a URL or countdown.
- Existing tests cover lock duration, repeat attempts during the lock, and a new attempt after expiry in `tests/domain/locky-state.test.js`.
- A separate visible-overlay smoke displayed the lock window over a disposable Edge profile. The current Windows session has one display, so multi-monitor behavior is supported by the per-display loop in `src/main.cjs` but was not exercised across multiple physical displays.
- `tests/domain/overlay-controller.test.js` exercises the production overlay controller with two simulated displays and verifies one fullscreen window per display, hiding/reappearing with browser and lock state, and closing the overlay for a disconnected display.

Implementation evidence: [map.md](../map.md#decisions-so-far).
