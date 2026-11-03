# Monitor Browsers from Locky Desktop

## Contexto

Locky needs to detect browser processes and windows to verify the integration and show the lock screen over each window. Previously, the 500 ms polling loop launched `tasklist.exe` and `browser-window-monitor.exe`; the latter also attached the lock window to the browser.

## Decisión

Locky uses Koffi to call Windows APIs from the main process. Polling runs every 500 ms while a browser is open and every 3 seconds when none is open. Lock windows update only when their bounds or remaining second changes. The helper executable remains responsible for attaching a newly created lock window to the browser.

If a Windows query fails, Locky shows a repair status, closes browsers it cannot verify while protection is enabled, and retries the query every 3 seconds.

## Consecuencias

- Repeated inspection no longer starts external processes.
- Koffi and its native Windows module must be included in the portable package.
- The helper executable is still needed to attach lock windows to browsers.
- Monitoring remains periodic; the adaptive interval reduces queries when no browsers are open.
