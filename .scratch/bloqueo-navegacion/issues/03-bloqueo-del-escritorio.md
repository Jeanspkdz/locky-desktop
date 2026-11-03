# 03: Desktop Lock Across All Monitors

**What to build:** An attempt to open a prohibited page starts a seven-minute desktop lock across all monitors. Users can close browsers from the screen; it disappears while no browsers are open and reappears for the remaining time if one is reopened.

**Blocked by:** 01: First Block in Chrome.

**Status:** resolved

- [x] The lock screen covers all monitors and only says that the lock was activated, with a “Close browsers” action.
- [x] “Close browsers” closes covered browsers without cancelling or restarting the seven-minute period.
- [x] When the last browser closes, the lock screen disappears while the timer continues.
- [x] Opening a covered browser before expiry makes the screen reappear for the remaining time.
- [x] After expiry, a new attempt starts another seven-minute period.

## Answer

- `src/main.cjs` creates one fullscreen overlay per display, derives visibility from the active lock and running browser families, and rechecks display and process state once per second. The close action terminates the covered browser processes while leaving the saved lock expiry intact.
- `src/domain/locky-state.js` preserves an unexpired lock and starts a new seven-minute lock after expiry. The lock page contains the agreed message and the “Close browsers” action without passing it a URL or countdown.
- Existing tests cover lock duration, repeat attempts during the lock, and a new attempt after expiry in `tests/domain/locky-state.test.js`.
- A separate visible-overlay smoke displayed the lock window over a disposable Edge profile. The current Windows session has one display, so multi-monitor behavior is supported by the per-display loop in `src/main.cjs` but was not exercised across multiple physical displays.
- `tests/domain/overlay-controller.test.js` exercises the production overlay controller with two simulated displays and verifies one fullscreen window per display, hiding/reappearing with browser and lock state, and closing the overlay for a disconnected display.

Implementation evidence: [map.md](../map.md#decisions-so-far).
