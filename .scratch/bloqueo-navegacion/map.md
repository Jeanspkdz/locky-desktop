# Bloqueo de navegación — implementation map

## Notes

- The implementation source of truth is the integration branch in the repository.
- Browser support is only claimed for a family after its extension and private-browsing policy have been checked in that installed browser.
- The browser smoke tests run under Node; they do not replace installed-browser validation on Windows.

## Decisions-so-far

- Ticket 02: domain and route boundaries are enforced in the shared rule model and both browser rule builders. Non-default ports are included in path filters. See [issue 02](issues/02-reglas-de-dominio-y-ruta.md).
- Ticket 03: the desktop lock remains active independently of overlay visibility; each display gets its own overlay while a covered browser is running. The production overlay controller is covered with two simulated displays, and the visible overlay was also smoke-checked on this machine's single physical display. See [issue 03](issues/03-bloqueo-del-escritorio.md).
- Ticket 04: pending and lock expiry values are persisted as verified UTC values, and resolution waits until trusted time is available after restart. See [issue 04](issues/04-recuperacion-de-tiempos.md).
- Ticket 05: the provider's 129 initial domains are preapproved and consolidated at startup. The UI has no list or approval action, and the renderer receives no candidate names. Saved candidates from older versions migrate to rules. See [issue 05](issues/05-lista-inicial-revisable.md).
- Ticket 01: the installed Chrome 156 profile blocked a prohibited domain and route, allowed an unrelated host and route, and activated the isolated desktop lock. A separate isolated Edge session displayed the visible lock overlay. See [issue 01](issues/01-primer-bloqueo-en-chrome.md).
- Tickets 06–07: isolated installed Edge and Brave profiles blocked the configured route, allowed `/allowed`, re-synced after browser restarts, and reported healthy. Their per-user private-mode policies are set to disabled. See [issue 06](issues/06-proteccion-en-edge.md) and [issue 07](issues/07-proteccion-en-brave.md).
- Ticket 08: the Firefox rule builder avoids classic-script redeclaration, and installed Firefox now blocks path rules using URL filters. A prohibited navigation emitted both navigation events, matched the current rule, reached the desktop native host, and started the isolated lock. The temporary add-on must be reloaded after Firefox restarts. See [issue 08](issues/08-proteccion-en-firefox.md).
- Installation/repair: the package contains an admin `Install-Locky.ps1`, and `-ValidateOnly` passes. Development setup and the current-profile Chrome extension/native-host route are verified. The elevated installer has not run end to end, and current-profile Edge, Brave, and Firefox extensions remain unloaded; issue 10 is still claimed. See [issue 10](issues/10-instalacion-y-reparacion.md).
- Ticket 09: no Opera installation was found on this Windows machine; it remains pending until an Opera variant is installed and can be tested. See [issue 09](issues/09-proteccion-en-opera.md).

## Fog

- Tickets 01–08 are resolved based on implementation and tests in disposable profiles. Chrome, Brave, Edge, and Firefox passed installed-browser route checks; Chrome also passed a current-profile route check after the user loaded the unpacked extension. A visible overlay appeared in a separate Edge session, and two-display behavior is covered by the production-controller test. Ticket 09 remains pending because no Opera variant is installed. Ticket 10 is claimed until the elevated installer and remaining current-profile browser integrations are verified. The current automated suite passes 58/58, including startup migration and the renderer check that no approval action is present. A hidden Electron startup migrated one saved candidate together with the 129 bundled rules into 130 approved rules and zero proposals. The current-profile Chrome run blocked `/blocked`, allowed `/allowed`, and recorded the desktop-lock interval in isolated state. The normal native-host registration was restored, and its smoke returned zero rules with `clockReady=True`; the latest portable package passed the installer `-ValidateOnly` check.
- The current normal app state has 129 preapproved preset rules, no pending rules and no active lock. Chrome is healthy; Edge, Brave and Firefox report missing integrations in this profile. The isolated test state and temporary launcher were removed. The installer package was validated but not executed against the normal Program Files installation.
