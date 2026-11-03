# Locky Desktop

Locky Desktop is a local Windows app for blocking selected websites. You manage rules in the desktop app, and browser extensions enforce them.

## Run locally

Prerequisites: Windows, Node.js, pnpm, and PowerShell. Run these commands from the repository root:

```powershell
pnpm install
pnpm setup:dev
pnpm start
```

`setup:dev` registers the local native messaging host, browser policies, and startup entry for the current Windows user. It does not require administrator rights. To enforce rules in a browser, load the unpacked extension:

1. In Chrome, Brave, or Edge, open the browser's extensions page (`chrome://extensions`, `brave://extensions`, or `edge://extensions`), enable **Developer mode**, select **Load unpacked**, and choose `extensions/chromium`.
2. In Firefox, open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `extensions/firefox/manifest.json`. Reload this temporary add-on after each Firefox restart.
3. Restart Locky and the browsers so the registration and policies take effect.

Run `pnpm smoke:native-host` to check the native host connection, or `pnpm test` to run automated tests. Firefox's full lock-screen coverage still needs verification; Chrome, Brave, and Edge are the supported browsers for the desktop overlay.

## Documentation

- [Product description and scope](docs/descripcion-de-locky-desktop.md)
- [Architecture](docs/arquitectura.md)
- [Windows setup and packaging](install/windows/README.md)
