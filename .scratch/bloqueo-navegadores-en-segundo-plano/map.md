# Background Browser Lock — Implementation Map

## Notes

- The source specification is `spec.md`; tickets form the implementation graph.
- The active integration branch is `integration`.
- Validation of installed Chrome, Brave, and Edge uses disposable temporary profiles; the harness must not touch normal profiles.

## Decisions-so-far

- Tickets 01–06 are implemented on the integration branch. The overlay uses a window owned by each Chromium window, and the shared expiry is stored as Windows time. See the answers for tickets 01–06.
- Extensions keep web navigation blocked with a session DNR rule when disconnected; they remove that rule only after syncing valid rules.
- Overlay attachment failures are shown as a repair notice for the affected browser; a packaged installation closes only that browser.
- `src/domain/protected-browser-families.cjs` is the single source for the family-to-executable map. Browser health, watcher, process control, and test scope use Chrome, Brave, and Edge; Firefox and Opera are not detected or included in repair handling.
- Ticket 07 was marked `resolved` after `pnpm smoke:browser-lifecycle` and `pnpm smoke:desktop-recovery` on November 1. The installed E2E test checked blocked paths, overlays and countdown, settings closed and reopened in the same instance, minimize and restore, new windows, browser close and reopen, and actual seven-minute expiry. Repair with a temporary Chrome profile without the extension closed only the test PID tree; temporary Brave and Edge remained open. The normal Chrome window/PID remained present and out of scope; no Edge window was visible in the initial capture. The temporarily compiled C# launcher detected the missing pipe, exited, and automatically relaunched the test Electron process after a reconnect request; the rule and `endsAt` were preserved and expired at the original deadline. `pnpm test` passed 69/69. See [issue 07](issues/07-reparacion-y-verificacion-en-tres-navegadores.md).
- The automated suite passed 69/69; the watcher smoke completed 100 snapshots (median 8.337 ms, p95 12.566 ms, maximum 14.179 ms, estimated CPU 1.782% at 500 ms). Both C# helpers compiled and all four PowerShell scripts parsed without errors.
- Ticket 07's smoke uses a DevTools pipe and loads the extension in temporary profiles because current branded Chrome versions no longer load extensions with `--load-extension`; E2E repair is restricted to the temporary Chrome PID.
- The initial provider contains 129 domains, automatically consolidated as preapproved rules. The list and approval button are not shown. Existing state preserves its rules, and proposals saved by older versions migrate to consolidated rules. See [ticket 05](../bloqueo-navegacion/issues/05-lista-inicial-revisable.md).

## Fog

- The initial Win32 snapshot found no preexisting visible Edge window; preservation checks are limited to the visible Chrome window captured by the harness. Temporary E2E processes and windows remained within the explicit PID scope.
- Automatic recovery was tested with a temporary copy of the C# launcher and isolated app, pipe, and data paths; neither the registered launcher nor the installed binary was invoked. A browser native worker failure and a physical Windows restart were not simulated.
