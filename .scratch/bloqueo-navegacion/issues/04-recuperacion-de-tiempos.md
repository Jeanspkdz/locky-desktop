# 04: Recuperación de tiempos tras reinicio

**What to build:** Los períodos de verificación y de bloqueo del escritorio conservan su duración al suspender o reiniciar Windows y no se acortan cambiando la hora visible. Si tras reiniciar no hay internet para verificar la hora, Locky mantiene el estado pendiente hasta poder comprobarla.

**Blocked by:** 02: Reglas de dominio y ruta; 03: Bloqueo del escritorio en todos los monitores.

**Status:** resolved

- [x] Cambiar la hora visible de Windows no acorta los períodos de siete o diez minutos.
- [x] Tras suspender o reiniciar, las reglas pendientes y el bloqueo del escritorio conservan el tiempo que corresponda.
- [x] Tras reiniciar sin conexión, Locky no libera un estado pendiente basándose solo en la hora local.
- [x] Cuando vuelve la conexión y se verifica la hora, Locky resuelve el tiempo restante y muestra la página de bloqueo solo si hay un navegador cubierto abierto.

## Answer

- `src/domain/session-clock.js` measures elapsed session time from an injected monotonic source anchored to trusted UTC from `src/main/trusted-time.cjs`. The verified UTC expiry times for pending rules and desktop locks are persisted by `src/main/state-store.cjs`.
- Timer resolution is skipped while trusted time is unavailable, so an offline restart leaves pending state intact. After verification, the supervisor resolves expiry and derives overlay visibility from the remaining lock and currently running browser families.
- `tests/domain/session-clock.test.js`, `tests/domain/state-store.test.js`, and `tests/domain/locky-state.test.js` cover clock independence from civil time, persisted timers, and lock expiry behavior.

Implementation evidence: [map.md](../map.md#decisions-so-far).
