# 02: First Lock Over Chrome

**What to build:** An attempt to visit a prohibited page in Chrome prevents it from loading and shows a Locky window over Chrome with the remaining time in the seven-minute lock, without covering the entire desktop.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [ ] Chrome prevents the prohibited page from loading and reports the attempt to Locky.
- [ ] The lock screen appears in a Locky window covering Chrome, with the remaining time visible.
- [ ] Other Windows applications remain available.
- [ ] Another attempt during the lock does not reset expiry; after seven minutes the window disappears and an allowed page becomes available again.
- [ ] A new attempt after expiry starts another seven-minute lock.

## Answer

The attempt reported by the extension starts the shared seven-minute period using Windows time. The lock screen shows `mm:ss`; an attempt during the period preserves expiry, and a later attempt starts a new period. The DNR rule prevents the prohibited destination from loading. Worker and controller tests cover this flow at the automated seam; installed interaction remains to be checked in ticket 07's manual smoke test.
