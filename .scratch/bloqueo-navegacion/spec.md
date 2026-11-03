# Permanent Navigation Blocking with a Desktop Lock Screen

Status: ready-for-agent

## Problem Statement

I want to block access to adult and gambling websites on my Windows computer and add specific domains or paths that I choose to block. After I confirm a rule, the application should not let me remove it. If I try to open a prohibited page, loading should stop and a screen should interrupt normal desktop use for seven minutes.

## Solution

Locky Desktop will be a local Windows application built with Electron and JavaScript or TypeScript, with dependencies and scripts managed by `pnpm`. It will cover Chrome, Brave, Edge, Firefox, and any Opera variants included in the installation. Each browser will have an integration that prevents prohibited pages from loading and notifies the desktop application. The preapproved initial set of adult and gambling domains is consolidated when Locky starts and is not displayed or subject to manual approval. Rules added later have a ten-minute verification period during which they can be cancelled; afterward they become consolidated rules.

When someone attempts to access a prohibited page, a full-screen lock page appears on every monitor for seven minutes. It only says that the lock was activated and offers “Close browsers”. When the last browser closes, the screen disappears while the timer continues. If any covered browser is opened before expiry, the screen reappears for the remaining time.

## User Stories

1. As a Windows user, I want to install Locky Desktop with administrator permissions so it can configure the required integrations on my computer.
2. As a Locky Desktop user, I want to use Chrome with the rules active so I can browse allowed pages.
3. As a Locky Desktop user, I want to use Brave with the rules active so I can browse allowed pages.
4. As a Locky Desktop user, I want to use Edge with the rules active so I can browse allowed pages.
5. As a Locky Desktop user, I want to use Firefox with the rules active so I can browse allowed pages.
6. As a Locky Desktop user, I want to use installed Opera variants with the rules active so I can browse allowed pages.
7. As a Locky Desktop user, I want private browsing disabled in each covered browser so it cannot be used to evade the rules.
8. As a Locky Desktop user, I want the preapproved initial set active at startup so I do not have to repeat an approval that has already been decided.
9. As a Locky Desktop user, I want the interface to show neither the initial domains nor an approval button.
10. As a Locky Desktop user, I want rules I add to retain a ten-minute verification period even though the initial set is preapproved.
11. As a Locky Desktop user, I want to add a domain rule to prohibit a site, its subdomains, and all its paths.
12. As a Locky Desktop user, I want to add a path rule to prohibit a specific profile or section without blocking the rest of the site.
13. As a Locky Desktop user, I want a path rule to cover its child paths so it also blocks posts on a prohibited profile.
14. As a Locky Desktop user, I want an added page to remain accessible during verification so I can check that I chose the right rule.
15. As a Locky Desktop user, I want to cancel a new rule during its ten-minute verification period so I can correct a mistake before consolidation.
16. As a Locky Desktop user, I want a new rule to consolidate automatically after ten minutes if I do not cancel it, making my commitment effective.
17. As a Locky Desktop user, I want the application to offer no way to edit or remove a consolidated rule so the block is permanent within the product.
18. As a Locky Desktop user, I want a domain similar to a prohibited one to remain accessible so partial name matches do not cause false blocks.
19. As a Locky Desktop user, I want a path similar to a prohibited path to remain accessible so ambiguous prefixes do not block different profiles.
20. As a Locky Desktop user, I want a prohibited page blocked before its content appears so I cannot see it during the attempt.
21. As a Locky Desktop user, I want an attempt to access a prohibited page to activate a seven-minute desktop lock and interrupt my browsing.
22. As a Locky Desktop user, I want the lock page to cover all my monitors so I cannot continue normal desktop use on another screen.
23. As a Locky Desktop user, I want the lock page to say only that the lock was activated, without showing the domain or a countdown.
24. As a Locky Desktop user, I want to select “Close browsers” to hide the lock page by closing browsers without cancelling the seven-minute period.
25. As a Locky Desktop user, I want the lock page to disappear when the last browser closes so I can use other applications while the timer continues.
26. As a Locky Desktop user, I want the lock page to reappear if I open a browser before the seven minutes end so I cannot evade the period by closing and reopening it.
27. As a Locky Desktop user, I want the remaining time to survive a Windows restart so I cannot evade it by restarting the computer.
28. As a Locky Desktop user, I want changing the displayed Windows time not to shorten the periods so the seven- and ten-minute timers retain their real duration.
29. As a Locky Desktop user, I want pending state to remain after an offline restart until time is verified so an uncertain local clock does not release a rule or lock.
30. As a Locky Desktop user, I want only the browser with a failed integration to be blocked and show repair guidance so I can keep using the others.
31. As a Locky Desktop user, I want non-browser applications to keep working normally so the lock remains limited to the intended browsing activity.
32. As a Locky Desktop user, I want a new attempt after the seven minutes expire to start another period so protection remains active.

## Implementation Decisions

- The desktop application uses Electron and JavaScript or TypeScript. All JavaScript dependencies and scripts use `pnpm` and `pnpm-lock.yaml`.
- The product is local to Windows, with no accounts or cross-device sync.
- Browser integrations apply domain and path rules before pages load; the desktop application stores rules, state, and timers. They communicate locally without sending browsing history to an external service.
- The main flow distinguishes pending, cancelled, and consolidated rules. The preapproved initial set is consolidated without manual action; an individually added rule is consolidated after ten minutes unless cancelled.
- An attempt to access a prohibited page activates the lock screen across all monitors. It shows no domain or countdown and includes a “Close browsers” action.
- The seven-minute period continues while no browsers are open. The screen is shown only while a covered browser is open; after a restart, it reappears when a browser is reopened if time remains.
- Use monotonic time during the Windows session and an internet time source to reconstruct timers after restart. If there is no connection after restart, retain pending state until time can be verified.
- Configure private browsing as disabled in every covered browser. An Opera variant is considered covered only after URL blocking, local communication, and private mode have been verified.
- If a covered browser integration fails, only that browser is blocked until repaired. Other applications and healthy browsers continue working.
- The preapproved initial set is not shown in the interface and does not require approval. Rules added individually retain the verification period.
- The application offers no way to remove or modify consolidated rules. This permanence does not claim to resist an administrator who changes Windows outside Locky.
- Scope is limited to Chrome, Brave, Edge, Firefox, and included Opera variants. Other browsers are outside this specification.

## Testing Decisions

- The primary test, once the application exists, crosses the highest boundary: start navigation in a covered browser, observe that the prohibited page does not load, and confirm that the desktop lock appears and hides or reappears as browsers close and open. Run it for each included browser and Opera variant.
- A good test verifies visible behavior and duration, not function names, internal storage, or Electron details.
- Test the rule engine with domains, subdomains, child paths, similar names, encoding, and redirects. Check pending rules before and after ten minutes.
- Test the supervisor and screen with multiple monitors, closing the last browser, reopening, restart, sleep, a changed local clock, and no connectivity after restart.
- Verify installation by checking that private mode is unavailable and that a missing integration blocks only the affected browser.
- The repository contains no previous application or tests; there are no existing testing patterns to reuse.
- This section defines tests for future implementation. It does not require running them while drafting the specification.

## Out of Scope

- Browsers other than Chrome, Brave, Edge, Firefox, and included Opera variants.
- Blocking applications that are not browsers.
- Automatically analyzing every post or image on allowed sites to classify adult or gambling content.
- User accounts, sync, remote control, or a mobile application.
- Guaranteeing that a Windows administrator cannot close, uninstall, or change protection outside the application.
- Turning the Electron screen into a replacement for Windows session locking.

## Further Notes

- Before declaring an Opera variant complete, verify pre-load blocking and private mode disablement in that variant. Compatibility is not assumed just because it shares Chromium technology.
- The project ADRs record in-app irreversible consolidation, coordination between the app and extensions, and the choice of Electron with `pnpm`.
- `ready-for-agent` means the specification is ready for implementation; it does not mean the product has been built or tested.
