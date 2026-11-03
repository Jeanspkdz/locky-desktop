# Background Browser Lock

Status: ready-for-human

## Problem Statement

I want Locky to protect my computer without keeping its settings window open. When I try to visit a prohibited page in Chrome, Brave, or Edge, all three browsers should be unusable for seven minutes while I can continue using other Windows applications. The previous design locked the entire desktop and does not match this behavior.

## Solution

Locky starts with my Windows session and remains active in the background when I close the settings window. The Chrome, Brave, and Edge extensions prevent prohibited pages from loading and notify Locky of the attempt. Locky starts one shared seven-minute browser lock, displays its own window over each open browser, and shows the time remaining. The windows follow their browsers, hide when a browser is minimized, and reappear when it is restored or reopened. The lock survives sleep and restart. When it expires, the windows disappear and allowed browsing becomes available again; prohibited pages remain blocked.

## User Stories

1. As a Locky user, I want it to start when I sign in to Windows so that protection is active without opening it manually.
2. As a Locky user, I want its process to remain active after I close the settings window so that background protection continues.
3. As a Locky user, I want to reopen settings without creating a second protection instance so I can check rules and status.
4. As a Chrome user, I want prohibited pages to be prevented from loading so I cannot see their content.
5. As a Brave user, I want prohibited pages to be prevented from loading so I cannot see their content.
6. As an Edge user, I want prohibited pages to be prevented from loading so I cannot see their content.
7. As a user of any of these browsers, I want a prohibited attempt to start one shared seven-minute lock so switching browsers cannot evade it.
8. As a Locky user, I want to see the lock screen in a window over each affected browser so I know why I cannot use it.
9. As a Locky user, I want to see the remaining time so I know when I can browse again.
10. As someone using multiple browsers, I want Chrome, Brave, and Edge covered so none can be used to evade the lock.
11. As someone using multiple windows in a browser, I want them all covered so I cannot switch to an unlocked window.
12. As someone using multiple tabs, I want no regular tab or internal browser page to be interactive during the lock.
13. As someone moving or resizing a browser, I want its lock window to keep covering it so the lock remains aligned.
14. As someone minimizing a browser, I want its lock window to hide so I can use other applications.
15. As someone restoring a minimized browser, I want the lock screen to reappear for the remaining time.
16. As someone closing a browser, I want the timer to keep running so closing it does not cancel the lock.
17. As someone reopening a browser during the lock, I want it covered again for the remaining time.
18. As someone using other Windows applications, I want them to remain available during the browser lock.
19. As someone putting Windows to sleep, I want the sleep time to count toward the seven minutes.
20. As someone restarting Windows, I want the lock to continue for the remaining time after signing in again.
21. As someone restarting without internet, I want Locky to calculate expiry using Windows time so I am not locked indefinitely.
22. As someone waiting for expiry, I want the lock windows to disappear and allowed tabs to become available again.
23. As someone attempting a prohibited page after expiry, I want another seven-minute lock to begin.
24. As someone attempting another prohibited page during an active lock, I want the original expiry to remain without restarting the timer.
25. As a Locky user, I want the application to recover automatically after a failure so protection resumes without manual intervention.
26. As someone using a browser while Locky is unresponsive, I want the extension to block web navigation until it reconnects and confirms state so a failure does not accidentally allow pages.
27. As a Locky user, I want a browser with a missing extension or failed integration to close and show repair instructions so I know which browser is unprotected.
28. As someone using multiple browsers, I want an integration failure to affect only the corresponding browser so the others are not closed.

## Implementation Decisions

- This specification replaces the full-desktop screen behavior in the previous specification and its lock ticket; it retains domain and path rules and the ten-minute verification period.
- The browsers covered by this flow are Chrome, Brave, and Edge. Firefox and Opera are outside this change.
- The native application stores shared state and expiry and coordinates the browsers. Extensions prevent prohibited pages from loading and report attempts through the existing local communication.
- The lock uses Locky windows over browser windows, not extension tabs or a screen covering the entire desktop. Each window must follow its browser's position, size, visibility, and minimized state.
- Extensions cannot replace internal browser pages. The native window covers the browser interface while Locky runs; if the native process fails, extensions restrict web navigation until the connection recovers. This does not promise to prevent all interaction with internal browser pages during a native process failure.
- The seven-minute period is shared by all three browsers. An attempt during an active lock does not change its expiry. An attempt after expiry starts a new period.
- The lock state survives restarts. Sleep counts toward the period. After restarting without internet, Windows time is used for expiry; manually advancing the clock may shorten the active lock. The consolidated rule remains in effect.
- Locky starts in the background with the Windows session, stays active after settings close, and avoids duplicate processes. Launching it again opens settings for the active instance.
- The provider's initial domains are preapproved and consolidated at startup. The interface does not show that set or offer an approval button. Manually added rules keep the ten-minute verification period.
- A recovery mechanism restarts Locky after an unexpected failure. Protection does not claim to resist a Windows administrator deliberately closing or changing its components.
- A missing or failed integration closes the affected browser and shows a repair notice in Locky without closing the other browsers.

## Testing Decisions

- The primary test exercises the observable flow in Chrome, Brave, and Edge: navigate to a prohibited page, verify it is blocked, see a lock window with a countdown, confirm coverage across all three browsers, and confirm release after seven minutes. The user explicitly requested this test in all three browsers.
- The same end-to-end test covers closing and reopening a browser, minimizing and restoring it, keeping other applications available, and opening a new window during the lock. It observes windows and navigation, not function names or Electron internals.
- At the highest level stable automation allows, test sleep or equivalent time advancement, restart during an active lock, restart without connectivity, process failure and recovery, and integration loss. Manual Windows testing supplements cases that cannot be simulated faithfully.
- Existing tests for the seven-minute state, extension workers, and window controller provide a baseline. Adapt them to the new visible behavior; do not retain expectations for a full-screen overlay on each monitor.
- The startup test verifies that provider domains are consolidated without approval and that the interface shows neither a list nor an approval button.
- A good test fails if a prohibited page loads, a browser is uncovered, the timer restarts incorrectly, the lock remains after expiry, or protection stops when settings close.

## Out of Scope

- Locking the entire desktop or blocking applications other than Chrome, Brave, and Edge.
- Adding or validating Firefox, Opera, or other browsers in this flow.
- Changing domain or path rule semantics or the ten-minute verification period.
- Guaranteeing resistance to deliberate changes by a Windows administrator.
- Claiming that the extension alone covers internal browser pages when Locky is not running.

## Further Notes

- Product vocabulary and the decision to use native windows over browsers are documented in the glossary and ADR 0004.
- The previous navigation blocking specification contains historical decisions that conflict on full-screen behavior, Firefox, Opera, and verified time without connectivity. This specification takes precedence for this flow.
- `ready-for-agent` means this behavior is ready to implement; it does not mean it is installed or working in the user's browsers.
