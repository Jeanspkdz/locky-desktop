# 07: Repair and Verification in All Three Browsers

**What to build:** Locky blocks only the browser whose integration is missing or failing, explains how to repair it, and demonstrates the complete lock flow in installed Chrome, Brave, and Edge.

**Blocked by:** 03: Shared Lock in Brave and Edge; 04: The Lock Window Follows the Browser; 05: Time Survives Sleep and Restart; 06: Failure Recovery.

**Status:** resolved

- [x] If an extension with consolidated rules is missing or failing, only the affected browser is closed and Locky shows a repair notice.
- [x] Other browsers with healthy integrations and other applications remain available when one integration fails.
- [x] In installed Chrome, Brave, and Edge, prohibited pages do not load and a lock window with a countdown appears.
- [x] In all three browsers, test close and reopen, minimize and restore, additional windows, and expiry after seven minutes.
- [x] Validation records evidence from real browsers and distinguishes any unverified case from automated tests.

## Answer

On November 1, 2026, `pnpm smoke:browser-lifecycle` ran installed Chrome, Brave, and Edge with disposable temporary profiles, isolated Locky state, and a unique pipe. In each browser, the extension blocked navigation to a local test path (the request did not reach the fixture server), and Locky showed a visible overlay whose timer advanced. Each browser was also tested for minimize and restore, covering an additional window, close and reopen, and retaining the same shared expiry time. After the full seven minutes, all three overlays disappeared and each browser loaded an allowed page.

Repair was tested by starting Chrome with another temporary profile without the extension: Locky showed the repair notice and closed only the test Chrome process tree within the PID scope; temporary Brave and Edge processes remained open. The harness limits its watcher, overlays, and closing to test PIDs; it does not close by image name. The initial Win32 snapshot recorded a preexisting visible Chrome window. After repair, the harness confirmed that this window remained present, its PID had never entered the scope file, and no test overlay had been attached to it. No Edge window was visible in the initial snapshot, so this run does not claim to have verified preservation of a preexisting Edge window. Normal profiles were not used and the registry was not modified.

During the lock, the smoke test closed the settings window and confirmed that the Locky process, shared expiry, and three overlays remained active. A second launch reopened settings in the same instance without creating a second owner process.

`pnpm smoke:desktop-recovery` compiled a temporary copy of the C# launcher and used its `LOCKY_TEST_MODE`-only overrides; it did not read or write the registry. After the temporary Locky process tree was terminated, the first temporary host detected the missing pipe and exited. A new Native Messaging request caused another temporary host to relaunch the worktree's tagged Electron process. The recovered process served the persisted rule, accepted the health message, and retained the same `endsAt`; the lock expired at that deadline and the permanent rule remained. The automated DNR test also confirms that Chromium continues blocking navigation while Locky is disconnected. This test uses the real launcher code with a temporary application path; it does not invoke the registered host or installed binary.

Automated verification: `pnpm test` passed 69/69; `pnpm smoke:browser-lifecycle` and `pnpm smoke:desktop-recovery` finished with `PASS`. A physical Windows restart was not simulated, and the installed host's registry association was not exercised.
