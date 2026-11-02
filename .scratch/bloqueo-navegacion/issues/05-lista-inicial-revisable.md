# 05: Lista inicial preaprobada

**What to build:** Los dominios del proveedor inicial están preaprobados y se consolidan al iniciar Locky. La interfaz no muestra la lista ni ofrece una acción para aprobarla. Las reglas agregadas manualmente conservan su período de verificación de diez minutos.

**Blocked by:** 02: Reglas de dominio y ruta.

**Status:** resolved

- [x] Cada dominio del proveedor se consolida como regla permanente desde el inicio.
- [x] La interfaz no muestra la lista inicial ni ofrece botón de aprobación.
- [x] Los datos pendientes guardados por una versión anterior se migran a reglas consolidadas.
- [x] Una sincronización repetida conserva las reglas y no crea duplicados.
- [x] Las reglas agregadas manualmente siguen usando el período de verificación de diez minutos.

## Answer

- `applyApprovedDomains` converts the provider's initial set and any saved candidate records directly into permanent preset rules, clears the old candidate field, and preserves existing rules without duplicates.
- The main process no longer registers `candidates:approve`, the preload no longer exposes it, and the renderer has no approval panel or button. The renderer state contains the rule count, not domain names.
- The current provider contains 129 unique domains. TDD covers automatic consolidation, migration of saved proposals, deduplication, and a rendered dashboard with no approval action; `pnpm test` passes 58/58.
- The local saved state already has 129 preset rules. Startup preserves those rules and no longer migrates them back to proposals.
- A hidden Electron startup with disposable user data converted the 129 provider rules plus one legacy saved proposal into 130 preset rules, with zero remaining proposals. The current portable package passed `Install-Locky.ps1 -ValidateOnly`; it was not installed over the existing app.

Implementation evidence: `src/main/approved-domains.cjs`, `src/main.cjs`, `src/preload.cjs`, `src/renderer/index.html`, and `tests/domain/blocklist-provider.test.js`.

Implementation evidence: [map.md](../map.md#decisions-so-far).
