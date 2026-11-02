# Locky Desktop design

<!-- impeccable:design-schema 1 -->

## Direction

A focused Windows dashboard inspired by the supplied Locky reference. The protection screen uses a compact title bar and a two-column workspace. State and consequences remain visible while the user adds rules. The blocking screen stays stripped to the message and action named in the spec.

## Visual system

- Deep navy workspace (`#08141d`), blue-gray panels (`#10232f`), and brighter cyan (`#38c8ed`) for navigation and focus.
- Amber (`#ffc476`) identifies actions and states needing attention; the normal status surface uses cyan. Status also has text.
- Segoe UI and system sans-serif keep the desktop controls familiar.
- Compact sidebar navigation, structured rows for browser and rule status, restrained borders, and modest rounded corners.
- The two-column dashboard collapses to one column on narrower windows, then the sidebar becomes horizontal navigation.
- Focus indicators remain visible for keyboard use.

## Content rules

- Interface copy is Spanish and follows `GLOSSARY.md` terminology.
- Example rules are explicitly marked illustrative.
- The preapproved initial domain set is applied automatically and is never listed or paired with an approval control in the interface.
- The blocking screen shows no domain or countdown.

## Prototype boundary

`design/` is a static UI prototype. Actual protection, browser integrations, persistent storage, Windows behavior, and verified timing belong to the future Electron implementation.
