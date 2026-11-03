# 04: Restore Timers After Restart

**What to build:** Verification periods and desktop locks retain their duration across Windows sleep and restart and are not shortened by changing the displayed clock. If internet is unavailable after restart to verify the time, Locky keeps the state pending until it can be checked.

**Blocked by:** 02: Domain and Path Rules; 03: Desktop Lock Across All Monitors.

**Status:** resolved

- [x] Changing the displayed Windows clock does not shorten the seven- or ten-minute periods.
- [x] After sleep or restart, pending rules and the desktop lock retain the appropriate remaining time.
- [x] After an offline restart, Locky does not clear a pending state based only on the local clock.
- [x] When connectivity returns and time is verified, Locky resolves the remaining time and shows the lock screen only if a covered browser is open.

## Answer

- `src/domain/session-clock.js` measures elapsed session time from an injected monotonic source anchored to trusted UTC from `src/main/trusted-time.cjs`. The verified UTC expiry times for pending rules and desktop locks are persisted by `src/main/state-store.cjs`.
- Timer resolution is skipped while trusted time is unavailable, so an offline restart leaves pending state intact. After verification, the supervisor resolves expiry and derives overlay visibility from the remaining lock and currently running browser families.
- `tests/domain/session-clock.test.js`, `tests/domain/state-store.test.js`, and `tests/domain/locky-state.test.js` cover clock independence from civil time, persisted timers, and lock expiry behavior.

Implementation evidence: [map.md](../map.md#decisions-so-far).
