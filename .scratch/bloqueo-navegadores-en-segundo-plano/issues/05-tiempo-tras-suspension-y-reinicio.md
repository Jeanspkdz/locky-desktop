# 05: Time Survives Sleep and Restart

**What to build:** The browser lock retains its expiry across Windows sleep or restart, and releases browsers after seven minutes even if the computer restarts without internet.

**Blocked by:** 02: First Lock Over Chrome.

**Status:** resolved

- [ ] Sleep time counts toward the seven minutes.
- [ ] After restarting Windows during a lock, Locky shows the lock screen for the remaining time when a covered browser opens.
- [ ] After an offline restart, expiry is calculated from Windows time without waiting indefinitely for an external source.
- [ ] When the lock expires, allowed pages become available again and prohibited pages remain blocked.
- [ ] Document and verify that manually advancing the Windows clock can shorten the active lock.

## Answer

The lock expiry is persisted as Windows time and calculated with `Date.now()`, so sleep, restart, and an offline restart count elapsed time; changing the clock can shorten the active period. The `StateStore` test restores a lock with a future expiry and checks the remaining time as if the process had restarted offline. A physical restart cycle was not run.
