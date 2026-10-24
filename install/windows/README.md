# Windows browser setup

`pnpm package:win` creates a portable Electron folder at `dist/win-unpacked`. It copies the app, Chromium and Firefox extension sources, and the Windows registration script into the package. It does not install the package, install browser extensions, edit the Registry, or change browser policies. The output directory must not already exist; remove or rename it yourself before creating another package.

`register-browser-hosts.ps1` is a setup component, not a complete installer. It writes per-user native-messaging registrations, sets the Windows login startup entry, and disables private browsing by policy in Chrome, Brave, Edge, and Firefox. It does not change system-wide App Control rules. Do not run it manually during development.

Chrome, Brave, Edge, and Firefox still need their corresponding extension installed. Chromium's extension ID is fixed by the public key in its manifest. Firefox needs a signed extension package for ordinary Firefox installations; the repository currently contains only the source package. The installer that would package Locky and install these extensions has not been built.

Opera Stable, Opera GX, and other Opera variants are not declared protected. The script writes native-messaging registration paths for Stable and GX, but extension loading, native messaging, and private-mode policy behavior must pass a real check in each variant first. No Opera policy has been verified.

In a packaged build, if a browser has no recent successful extension heartbeat, Locky closes only that browser and leaves a repair notice in its settings window. The first 15 seconds after startup are allowed for the extension handshake. Development runs do not close browsers by default; set `LOCKY_ENFORCE_UNHEALTHY_BROWSER=1` only in a dedicated test session.
