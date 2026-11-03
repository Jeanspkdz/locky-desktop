# Consolidate Rules After a Ten-Minute Verification Period

**Status:** Superseded by ADR 0006 for the bundled initial domain set.

Pages added by the user remain accessible for ten minutes and can be cancelled during that interval. Afterward, the rule is consolidated and the application does not allow it to be removed or modified. This delay gives the user time to catch mistakes before making a lasting commitment, without offering a way to undo it after consolidation.

The original decision to show the initial set for manual approval was replaced by [ADR 0006](./0006-lista-inicial-preaprobada.md). Permanence refers to the actions available in the application; a Windows administrator can still modify the system externally.
