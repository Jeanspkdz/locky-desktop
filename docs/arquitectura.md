# Locky Desktop Technical Architecture

## Confirmed Scope

A local Windows application protecting Chrome, Brave, and Edge. It blocks the preapproved set of adult and gambling domains, plus domains and paths added by the user. It does not restrict other applications or promise coverage for unsupported browsers.

Rules in the initial set are consolidated automatically when Locky starts; the interface does not show their domains or offer an approval button. Individually added rules can be cancelled for ten minutes; afterward the application does not allow users to remove or modify them. An attempt to open a prohibited page prevents it from loading and starts a seven-minute browser lock. Locky displays a window over each covered browser. The “Close browsers” button closes the browsers and hides the overlay; the timer continues, and the overlay reappears if a browser is opened before time expires.

## Components

1. **Windows desktop app:** Electron and JavaScript provide the settings interface, rule set, verification of new rules, and lock screen. `pnpm` manages project dependencies and scripts.
2. **Local supervisor process:** stores state and timers, monitors open browsers, closes browsers when requested, and checks each integration. It starts with Windows and remains available when the settings window closes.
3. **Browser extensions:** apply domain and path rules before pages load and notify the supervisor of attempts. Chromium browsers share an extension; Firefox uses its own integration, but complete lock screen coverage remains under validation. Opera is not currently supported.
4. **Local communication:** `native messaging` connects each extension to the supervisor. The browser blocks a request without waiting for the native process; the message only triggers the lock screen. If the supervisor is unavailable, the page remains blocked and a local repair notice is shown. [Mozilla Native Messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging).
5. **Windows installer:** registers the supervisor, integrations, and available private browsing policies. If an integration fails, only the affected browser is blocked until repaired.

## Rules and Time

- A domain rule covers the domain, its subdomains, and all its paths. A path rule covers the selected path and its descendants without blocking the rest of the domain. URLs are normalized before comparison: hostnames are lowercase, default ports are removed, and trailing slashes and encoding are handled consistently.
- The preapproved set and consolidated rules are stored locally. The interface does not offer edit or delete actions for them.
- During a Windows session, elapsed time uses a monotonic clock that does not depend on changing the displayed Windows time. Windows time includes sleep and hibernation. [Microsoft Windows Time](https://learn.microsoft.com/windows/win32/sysinfo/windows-time).
- After a restart, the supervisor verifies time using an internet source before calculating the remaining seven or ten minutes. Without a connection, it keeps the state pending until time can be verified.
- The browser lock starts once per access attempt. Closing browsers does not reset or cancel the seven minutes. A new attempt after expiry starts another period.

## Build Order

1. Verify that each supported browser blocks before page load, enforces path rules, communicates locally, detects a missing extension, and disables private browsing.
2. Build the rule engine and `pending`, `cancelled`, and `consolidated` states, with tests for subdomains, similar paths, redirects, and restarts.
3. Build the supervisor and multi-window overlays. Test browser close and reopen, sleep, restart, clock changes, and loss of connectivity.
4. Load the preapproved adult and gambling domain set as consolidated rules. Do not show its names or request approval in the interface.
5. Package the Windows installer and run end-to-end tests. Use `pnpm` for Electron and extension dependencies and scripts.

## Product Limitations

A normal full-screen window can interrupt ordinary desktop use, but it does not replace Windows session locking. An administrator can stop processes, change policies, or uninstall software. “Permanent” describes the actions Locky provides, not a guarantee against the computer administrator. Do not claim a browser family is covered until it passes blocking and private browsing checks.
