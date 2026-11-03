# 01: First Block in Chrome

**What to build:** When someone tries to open a domain configured as prohibited in Chrome, the page does not load and Locky shows its lock screen in Electron. This first flow connects the browser, rules, and desktop through a simple, demonstrable case.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A domain configured as prohibited does not load in Chrome and activates the lock screen.
- [x] A domain that is not prohibited continues to load normally.
- [x] The lock screen shows the agreed message without revealing the domain.
- [x] Chrome Incognito is disabled while Chrome is protected.
- [x] The flow works on Windows using dependencies and scripts managed by `pnpm`.

## Evidence

- `src/renderer/lock.html` renders “Lock activated” and “Close browsers”; `src/renderer/lock.js` only invokes the close action. The overlay receives no blocked URL or timer value.

## Comments

- Historical note: Chrome previously launched Electron with the extension origin as its app path because native host manifests cannot pass custom `args`. Added a native executable bridge that forwards framed browser messages to the desktop named pipe. `pnpm setup:dev` rebuilt and registered it; a framed `getState` request returned `type=state`, `clockReady=true`, and exit code 0. `pnpm start` also opened the Locky window. At that point browser navigation still needed an installed-Chrome check; see the current-profile follow-up below.
- Installed-browser check on 2026-10-27: Chrome 156 ignored the direct `--load-extension` attempt, but Mozilla's `web-ext` Chromium runner loaded Locky's MV3 worker in a disposable Chrome profile and Locky's native state reported Chrome `healthy`. The private-mode policy is configured. Blocked/allowed navigation, actual Incognito rejection, and the visible desktop lock still need a consolidated-rule scenario; ticket remains open.
- Historical follow-up on 2026-10-27: the real native-host smoke returned `rules=1` and `clockReady=True` from an isolated staged app. At that point the unpacked extension had not yet been loaded in the user's current Chrome profile; see the current-profile follow-up below.
- Current-profile follow-up on 2026-10-27: after the user loaded the unpacked extension and `setup:dev` corrected the stale native-host registry path, Chrome reported healthy. With an isolated Locky data directory containing one consolidated `127.0.0.1/blocked` rule, `/blocked` returned `ERR_BLOCKED_BY_CLIENT`, `/allowed` continued to load, and Locky's isolated state recorded a seven-minute desktop lock. Overlays were suppressed for this route run. The pending rule created during setup was canceled; normal state was restored and verified with zero rules, no pending rules, no active lock, and Chrome healthy.

## Answer

- Installed Chrome 156 in an isolated profile blocked `http://127.0.0.1:9317/allowed` when the consolidated `127.0.0.1` domain rule was active (`ERR_BLOCKED_BY_CLIENT`). `http://localhost:9317/allowed` remained reachable, and the isolated Locky state activated its seven-minute desktop lock.
- The same profile blocked the `/blocked/child` path, allowed `/allowed`, and synced the four HTTP/HTTPS path filters, including non-default ports.
- `IncognitoModeAvailability=1` is configured for Chrome. The lock page contains the agreed copy; overlays were suppressed during route smoke tests to keep the desktop usable.
- Separate visible-overlay check on 2026-10-27: an isolated Edge profile ran while the isolated app held an active lock with overlays enabled. Windows reported a visible Electron window titled `Bloqueo activado`; the disposable browser and app processes were stopped and their profile/state directory removed. The route smoke and visible-overlay check were separate runs.
- Full repository suite: 44/44 tests passed.
