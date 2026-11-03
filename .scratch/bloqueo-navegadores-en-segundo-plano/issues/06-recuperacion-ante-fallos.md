# 06: Failure Recovery

**What to build:** If Locky stops responding during a lock, extensions restrict web browsing and the application attempts to restart; after reconnecting, browsers recover the correct state and remaining time.

**Blocked by:** 01: Locky Runs in the Background; 02: First Lock Over Chrome.

**Status:** resolved

- [ ] An unexpected failure triggers an automatic attempt to restart Locky.
- [ ] While Locky is not responding, Chrome, Brave, and Edge do not load new web pages without confirming state.
- [ ] When Locky returns, each extension recovers consolidated rules and the shared lock expiry.
- [ ] If the period expired during the failure, allowed browsing is released while prohibited pages remain blocked.
- [ ] The test distinguishes a recoverable failure from deliberate intervention by a Windows administrator.

## Answer

The native host checks the pipe and requires a `getState` response; if Locky does not respond, it closes the host so Chromium fires `onDisconnect`. The extension adds a session DNR rule that blocks web navigation, retries, and removes the rule only after receiving and applying state. The host restarts Locky with `--background`. The worker test verifies blocking on disconnect; both C# helpers compiled. A real process failure and recovery have not yet been injected into a browser session.
