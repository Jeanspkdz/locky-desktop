# 02: Domain and Path Rules

**What to build:** Users can add a domain or path rule in Locky, review the page for ten minutes, and cancel the rule before it is consolidated. After consolidation, the application does not offer editing or removal; Chrome enforces the correct rule.

**Blocked by:** 01: First Block in Chrome.

**Status:** resolved

- [x] A domain rule covers the domain, its subdomains, and all its paths without matching similarly named domains.
- [x] A path rule covers the specified path and its descendants without matching other paths or similar profiles.
- [x] An added page remains accessible during the ten-minute verification period, and the rule can be cancelled during that time.
- [x] If verification ends without cancellation, the rule is consolidated and the application offers no edit or removal action.
- [x] Consolidated rules remain enforced after Locky is closed and reopened.

## Answer

- `src/domain/rules.js` normalizes and matches domain and route rules at host and path boundaries. `src/domain/locky-state.js` keeps user rules pending for ten minutes, supports cancellation during that window, and consolidates expired rules permanently in the app UI.
- Both Chromium and Firefox rule builders use main-frame blocking rules. Path filters include non-default ports so their browser-side matching agrees with Locky's normalized host/path matching.
- `tests/domain/browser-rules.test.js` covers domain and route boundaries, pending timers are covered in `tests/domain/locky-state.test.js`, and browser rules persist through `tests/domain/state-store.test.js`.

Implementation evidence: [map.md](../map.md#decisions-so-far).
