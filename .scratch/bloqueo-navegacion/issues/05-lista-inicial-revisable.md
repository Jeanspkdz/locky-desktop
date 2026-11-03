# 05: Preapproved Initial Set

**What to build:** The provider's initial domains are preapproved and consolidated when Locky starts. The interface does not show the set or offer an approval action. Manually added rules retain their ten-minute verification period.

**Blocked by:** 02: Domain and Path Rules.

**Status:** resolved

- [x] Each provider domain is consolidated as a permanent rule at startup.
- [x] The interface does not show the initial set or an approval button.
- [x] Pending data saved by an earlier version is migrated to consolidated rules.
- [x] Repeated synchronization preserves rules without creating duplicates.
- [x] Manually added rules continue to use the ten-minute verification period.

## Answer

- `applyApprovedDomains` converts the provider's initial set and any saved candidate records directly into permanent preset rules, clears the old candidate field, and preserves existing rules without duplicates.
- The main process no longer registers `candidates:approve`, the preload no longer exposes it, and the renderer has no approval panel or button. The renderer state contains the rule count, not domain names.
- The current provider contains 129 unique domains. TDD covers automatic consolidation, migration of saved proposals, deduplication, and a rendered dashboard with no approval action; `pnpm test` passes 58/58.
- The local saved state already has 129 preset rules. Startup preserves those rules and no longer migrates them back to proposals.
- A hidden Electron startup with disposable user data converted the 129 provider rules plus one legacy saved proposal into 130 preset rules, with zero remaining proposals. The current portable package passed `Install-Locky.ps1 -ValidateOnly`; it was not installed over the existing app.

Implementation evidence: `src/main/approved-domains.cjs`, `src/main.cjs`, `src/preload.cjs`, `src/renderer/index.html`, and `tests/domain/blocklist-provider.test.js`.

Implementation evidence: [map.md](../map.md#decisions-so-far).
