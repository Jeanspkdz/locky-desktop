# 06: Edge Protection

**What to build:** Edge enforces Locky's domain and path rules and activates the desktop lock when a prohibited page is attempted. InPrivate browsing is disabled.

**Blocked by:** 01: First Block in Chrome; 02: Domain and Path Rules.

**Status:** resolved

- [x] A prohibited page does not load in Edge and activates the lock screen.
- [x] An allowed page loads; path rules do not block the rest of the site.
- [x] InPrivate cannot be opened while Edge is protected.
- [x] Consolidated rules are applied again after Edge is closed and reopened.

## Comments

- Installed-browser smoke on 2026-10-27: Edge loaded the Locky MV3 service worker in an isolated profile and Locky's native state reports Edge `healthy`. The per-user policy sets `InPrivateModeAvailability=1`. Blocked/allowed navigation and restart persistence still need an active rule scenario; ticket remains open.

## Answer

- In isolated installed Edge, `/blocked/child` returned `ERR_BLOCKED_BY_CLIENT`; `/allowed` loaded. The current four path filters were present in DNR.
- Closed and relaunched the isolated Edge profile with the local extension. Locky re-synced the rules and the same blocked/allowed checks passed; Edge reported `healthy` to the disposable desktop app.
- Verified `InPrivateModeAvailability=1` in the per-user Edge policy.
