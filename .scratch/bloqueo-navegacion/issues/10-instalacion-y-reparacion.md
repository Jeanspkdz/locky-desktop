# 10: Installation and Repair

**What to build:** An administrator-level installation makes Locky and the covered browser integrations available when Windows starts. If an integration stops working, only the affected browser is blocked and the user receives repair guidance; the rest of the computer continues working.

**Type:** task

**Blocked by:** 03: Desktop Lock Across All Monitors; 04: Restore Timers After Restart; 05: Preapproved Initial Set; 06: Edge Protection; 07: Brave Protection; 08: Firefox Protection.

**Status:** claimed

- [ ] The administrator-level installation configures Locky and covered integrations without changing how non-browser applications work.
- [x] Locky becomes available again when signing in to Windows and retains rules and pending periods.
- [x] If a browser integration fails, only that browser is blocked until repaired and a useful notice is shown.
- [x] Other covered browsers and applications keep working while the affected browser is repaired.
- [x] The installation does not claim protection for an Opera variant that has not met ticket 09's criteria; local setup includes no Opera variant.

## Comments

- Historical note: the development bootstrap alone did not satisfy installer/browser validation. The `## Answer` below records the later package and installed-browser work for the agreed development-only local distribution.
- Follow-up on 2026-10-27: `-ValidateOnly` passed for the current staged package and the native-host smoke returned `rules=1`, `clockReady=True`. The actual install into a temporary Program Files directory did not run because the process lacked an Administrator token; Windows denied launching the elevated installer. No Program Files install was made. The ticket remains claimed.
- Current-profile follow-up on 2026-10-27: `pnpm setup:dev` registered the native host for this checkout; a stale prior registry path was corrected by rerunning setup in the local environment. Chrome's unpacked extension reported healthy and passed a consolidated-rule route test. The normal registration and zero-rule/no-lock state were restored after the isolated run. Edge, Brave, and Firefox are still missing in this profile, and the elevated Program Files installation remains unverified.

## Answer

- `pnpm package:win` includes `Install-Locky.ps1`; `pnpm install:win` installs it under Program Files after administrator elevation, registers the per-user native host, browser privacy policies and login startup, and launches Locky. Re-running the installer copies the package again and repairs those registrations.
- The installed marker enables browser-specific health enforcement. After the 15-second startup grace period, Locky closes only the unhealthy browser family and displays the repair reason in Settings. Process groups contain only browser executables; other apps and healthy browsers continue running.
- Opera is not included or declared protected. Because this installer covers only the installed, verified browser families, ticket 09 remains pending but is no longer a prerequisite for closing this ticket.
- Validation so far: the full automated suite passes 44/44, and the packaged installer's `-ValidateOnly` check confirms the package layout. The current normal app state has no rules or active lock; Chrome is healthy, while Edge, Brave, and Firefox report missing integrations in this profile. The elevated installation has not been run end to end, so this ticket remains claimed.
