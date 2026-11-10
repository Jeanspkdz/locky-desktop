# Monitor Browsers from Locky Desktop

## Contexto

Locky detects Chrome, Brave, and Edge through Koffi calls to Windows process and window APIs. Detection supports browser-family health, the 15-second extension connection grace period, heartbeat timeout checks, and family-specific safety closure when consolidated rules exist. Window geometry and visibility polling keeps the lock overlay attached to every browser window during the seven-minute desktop lock.

The C# `browser-window-monitor.exe` is launched as a short-lived process when a new overlay needs to be attached. It is not launched for each Koffi snapshot or polling tick.

## Decision

Browser detection and integration-health evaluation run immediately at startup and then every 3 seconds, regardless of whether a browser is open. The 3-second cycle maintains family detection, the 15-second startup grace, heartbeat staleness checks, watcher recovery, and consolidated-rule safety closure.

Window snapshots used to place overlays run immediately when a desktop lock starts and then every 500 ms only while the lock is active. The fast cycle stops on lock expiry; the next detection cycle clears the expired lock state and also stops tracking. Shutdown clears both timers. The watcher and overlay attachment implementation remain unchanged.

The 30-second extension heartbeat cadence, 45-second stale threshold, ten-minute rule verification, and seven-minute lock duration are unchanged. Health and safety actions may now be observed up to 3 seconds after a detection-cycle boundary instead of being accelerated by the 500 ms window-tracking cycle.

## Consecuencias

- In idle, Koffi snapshots run every 3 seconds whether or not a supported browser is open.
- During a lock, window bounds and visibility are refreshed every 500 ms, including for newly opened windows.
- The fast polling cycle no longer accelerates integration-health and safety checks.
- Repeated inspection does not start external processes; the C# helper is only invoked to attach a newly created overlay.
- Koffi and its native Windows module must be included in the portable package.
