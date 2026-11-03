# Locky Desktop: Product Description and Tools

## What Is Locky Desktop?

Locky Desktop is a local Windows application that helps limit access to adult, gambling, and other websites the user chooses to block. The user manages rules in a desktop app; browser extensions enforce them before pages load.

Locky does not require an account or sync rules with a cloud service. It is intended to protect a personal Windows computer.

## How It Works

- **Domain rule:** blocks a domain, its subdomains, and all its paths.
- **Path rule:** blocks a specific path and its child paths within a domain.
- **New rules:** remain pending for ten minutes. They can be cancelled during that interval; afterward they are consolidated and Locky does not offer a way to edit or remove them.
- **Access attempt:** when an extension detects a page matching a rule, it notifies Locky's local process. A seven-minute browser lock begins. On monitored browser windows, Locky displays an overlay; other applications remain available.
- **Bundled set:** the project includes adult and gambling domains that are automatically added as consolidated rules.

## Browsers

Installation configures integrations for Chrome, Brave, Edge, and Firefox. One Chromium extension runs in Chrome, Brave, and Edge; Firefox has its own extension. Opera is not installed, configured, or declared a protected browser.

The window monitor and browser overlay support Chrome, Brave, and Edge. Firefox has an extension and native communication configured, but its complete coverage together with the lock screen must be verified before it can be considered equivalent. The status interface also shows Chrome, Brave, and Edge.

## Tools and Technologies

| Tool | Use in the project |
|---|---|
| **Electron** | Windows desktop windows and access to application capabilities. |
| **Node.js and JavaScript** | Rule logic, state, timers, communication, and the interface. The code combines CommonJS and ES modules. |
| **HTML and CSS** | Structure and styling for the dashboard and lock screen. |
| **WebExtensions** | One extension shared by Chromium browsers and another for Firefox. They use `declarativeNetRequest` to block URLs and `webNavigation` to detect navigation attempts. |
| **Native Messaging and a local Windows pipe** | Connect each extension to the native host and Locky process without sending browsing history to a server. |
| **Koffi and Win32 API** | Let Node.js inspect Windows processes and windows to monitor browsers. |
| **C#** | Implements the native messaging host and utility that places Locky's screen over supported browser windows. |
| **PowerShell and Windows Registry** | Configure Windows startup, browser connections, and private browsing policies; also package and install the application. |
| **pnpm** | Installs dependencies and runs project commands. |

Locky state is stored locally in a JSON file. To start or confirm verification periods, the application checks the time through HTTPS requests to Microsoft, Cloudflare, or Google. Those requests do not send rules or browsing history.

## Project Commands

Run these from the repository root:

- `pnpm start`: start Locky.
- `pnpm setup:dev`: configure a local development installation.
- `pnpm package:win`: prepare the portable Windows package.
- `pnpm install:win`: install or repair the Windows package; run PowerShell as administrator.
- `pnpm test`: run the automated Node.js tests.

The simulated blocked attempt in the dashboard is a development tool and is not included in the packaged version.

## Important Limits

“Permanent” means Locky does not let users remove or modify a consolidated rule through its interface. It does not mean the application can stop a Windows administrator from changing system settings or uninstalling the program. Opera coverage is not implemented; Firefox coverage requires validation of the full blocking and overlay flow.

## Repository References

- [Product](../PRODUCT.md)
- [Architecture](arquitectura.md)
- [Glossary](../GLOSSARY.md)
