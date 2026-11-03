# 03: Shared Lock in Brave and Edge

**What to build:** A prohibited attempt in Chrome, Brave, or Edge starts one shared browser lock that covers all open windows in all three browsers with the same remaining time.

**Blocked by:** 02: First Lock Over Chrome.

**Status:** resolved

- [ ] A prohibited attempt in Brave or Edge prevents the page from loading and starts the same lock as in Chrome.
- [ ] All open Chrome, Brave, and Edge windows show the lock screen, including new windows opened during the period.
- [ ] Remaining time is shared, and another attempt neither creates a new period nor resets the current one.
- [ ] Internal settings and other tabs in a covered browser remain behind its lock window while Locky runs.
- [ ] Other Windows applications remain available.

## Answer

The same `desktopLock` state and its `endsAt` are shared across Chrome, Brave, and Edge. The controller creates an overlay for each visible Chromium window, and a new window receives the remaining time. Worker tests verify Brave and Edge identification, and controller tests cover all three window groups; installed smoke testing is tracked in ticket 07.
