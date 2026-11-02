# 10: Instalación y reparación

**What to build:** Una instalación con permisos de administrador deja operativas Locky y las integraciones de los navegadores cubiertos al iniciar Windows. Si una integración deja de funcionar, solo el navegador afectado queda impedido y la persona recibe una indicación de reparación; el resto del equipo sigue funcionando.

**Type:** task

**Blocked by:** 03: Bloqueo del escritorio en todos los monitores; 04: Recuperación de tiempos tras reinicio; 05: Lista inicial preaprobada; 06: Protección en Edge; 07: Protección en Brave; 08: Protección en Firefox.

**Status:** claimed

- [ ] La instalación con permisos de administrador configura Locky y las integraciones cubiertas sin cambiar el funcionamiento de aplicaciones que no sean navegadores.
- [x] Locky vuelve a estar disponible al iniciar sesión en Windows y conserva reglas y períodos pendientes.
- [x] Si falla la integración de un navegador, solo ese navegador queda impedido hasta repararla y se muestra una indicación útil.
- [x] Los otros navegadores cubiertos y las demás aplicaciones siguen funcionando mientras se repara el navegador afectado.
- [x] La instalación no declara protegida una variante de Opera que no haya superado los criterios del ticket 09: el setup local no incluye ninguna variante.

## Comments

- Historical note: the development bootstrap alone did not satisfy installer/browser validation. The `## Answer` below records the later package and installed-browser work for the agreed development-only local distribution.
- Follow-up on 2026-10-27: `-ValidateOnly` passed for the current staged package and the native-host smoke returned `rules=1`, `clockReady=True`. The actual install into a temporary Program Files directory did not run because the process lacked an Administrator token; Windows denied launching the elevated installer. No Program Files install was made. The ticket remains claimed.
- Current-profile follow-up on 2026-10-27: `pnpm setup:dev` registered the native host for this checkout; a stale prior registry path was corrected by rerunning setup in the local environment. Chrome's unpacked extension reported healthy and passed a consolidated-rule route test. The normal registration and zero-rule/no-lock state were restored after the isolated run. Edge, Brave, and Firefox are still missing in this profile, and the elevated Program Files installation remains unverified.

## Answer

- `pnpm package:win` includes `Install-Locky.ps1`; `pnpm install:win` installs it under Program Files after administrator elevation, registers the per-user native host, browser privacy policies and login startup, and launches Locky. Re-running the installer copies the package again and repairs those registrations.
- The installed marker enables browser-specific health enforcement. After the 15-second startup grace period, Locky closes only the unhealthy browser family and displays the repair reason in Settings. Process groups contain only browser executables; other apps and healthy browsers continue running.
- Opera is not included or declared protected. Because this installer covers only the installed, verified browser families, ticket 09 remains pending but is no longer a prerequisite for closing this ticket.
- Validation so far: the full automated suite passes 44/44, and the packaged installer's `-ValidateOnly` check confirms the package layout. The current normal app state has no rules or active lock; Chrome is healthy, while Edge, Brave, and Firefox report missing integrations in this profile. The elevated installation has not been run end to end, so this ticket remains claimed.
