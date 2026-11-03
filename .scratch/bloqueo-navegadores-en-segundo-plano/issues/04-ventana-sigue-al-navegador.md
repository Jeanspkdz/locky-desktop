# 04: The Lock Window Follows the Browser

**What to build:** During a lock, the Locky window stays over each affected browser as it is moved, resized, minimized, restored, closed, or reopened.

**Blocked by:** 02: First Lock Over Chrome.

**Status:** resolved

- [ ] Moving or resizing a browser keeps the lock screen aligned with its window.
- [ ] Minimizing a browser hides its lock screen and allows other applications to be used.
- [ ] Restoring or reopening it before expiry shows the lock again for the remaining time.
- [ ] Closing all browsers does not cancel or pause the timer.
- [ ] A lock window is not left over other applications when its browser is minimized or closed.

## Answer

The Win32 monitor updates position and dimensions every half second, marks minimized windows, and makes each overlay an owned window of its browser without global topmost z-order. The controller tests individual bounds, minimize and restore, close and reopen, and expiry. If Windows rejects the attachment, Locky hides that overlay, shows a repair notice for that browser, and in packaged installations closes only that browser family.
