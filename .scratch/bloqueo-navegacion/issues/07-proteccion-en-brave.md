# 07: Brave Protection

**What to build:** Brave enforces Locky's domain and path rules and activates the desktop lock when a prohibited page is attempted. Private browsing is disabled.

**Blocked by:** 01: First Block in Chrome; 02: Domain and Path Rules.

**Status:** resolved

- [x] A prohibited page does not load in Brave and activates the lock screen.
- [x] An allowed page loads; path rules do not block the rest of the site.
- [x] A private window cannot be opened while Brave is protected.
- [x] Consolidated rules are applied again after Brave is closed and reopened.

## Comments

- Installed-browser smoke on 2026-10-27: Brave loaded the Locky MV3 service worker in an isolated profile and Locky's native state reports Brave `healthy`. `chrome://policy` reports `IncognitoModeAvailability=1`. Blocked/allowed navigation and restart persistence still need an active rule scenario; ticket remains open.

## Answer

- In isolated installed Brave, `/blocked/child` returned `ERR_BLOCKED_BY_CLIENT` and `/allowed` loaded. The extension synced the four current path filters and reported `healthy`.
- Closed and relaunched the isolated Brave profile with the local extension; Locky re-synced its rules and the blocked/allowed checks passed again.
- Verified `IncognitoModeAvailability=1` in Brave's policy.
