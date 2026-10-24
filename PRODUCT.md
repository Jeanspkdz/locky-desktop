# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

The planned application uses Electron with JavaScript or TypeScript and `pnpm` for dependencies and scripts. `design/` is a separate static HTML, CSS, and JavaScript prototype for reviewing the interface.

## Users

The primary user is the owner of this Windows computer, using Locky for personal protection from adult and gambling sites and to prohibit specific domains or paths. This is a personal-use product for one computer; other users or a wider distribution are not currently planned.

## Product Purpose

Locky Desktop prevents prohibited pages from loading in covered browsers and interrupts desktop browsing after an attempt.

## Positioning

Protection is coordinated locally between the desktop application and browser integrations. The browser prevents a prohibited page from loading; the desktop application manages the rules, timing, and interruption. No browsing history is sent to an external service.

## Operating Context

Local Windows application covering Chrome, Brave, Edge, Firefox and validated Opera variants. No account or sync. The initial domain list requires explicit joint approval. New personal rules have ten minutes to cancel before becoming consolidated. A prohibited-page attempt starts a seven-minute desktop block.

Installation requires administrator permission to configure browser integrations and disable private browsing in covered browsers. The blocking screen covers all monitors while a covered browser is open. Closing the last browser hides it while the seven minutes continue; reopening a covered browser during that period shows it again. Other applications remain usable after browsers close.

## Capabilities and Constraints

Consolidated rules have no edit or removal control within the product. The blocking screen shows only an activation message and “Cerrar navegadores”, with no domain or countdown. A failed browser integration affects only that browser. Other applications keep working.

A domain rule covers that domain, its subdomains, and all paths. A path rule covers its selected path and lower paths without including similarly named paths. During the ten-minute verification period, a newly added page remains accessible and its rule can be cancelled. Future additions to the initial list require fresh approval.

Timers survive a Windows restart. During a session they use monotonic time; after a restart they require time verification over the internet. Without a connection, pending states remain pending. “Permanent” means Locky itself provides no edit or removal action after consolidation; it does not claim to resist a Windows administrator changing the system outside the app.

Only Chrome, Brave, Edge, Firefox, and included Opera variants are in scope. Each Opera variant requires its own verification before being called covered. The specific initial domain list is not yet present in the repository.

## Brand Commitments

The product name is Locky Desktop. The repository glossary defines the Spanish terms “regla de dominio”, “regla de ruta”, “regla consolidada”, “período de verificación”, “bloqueo del escritorio”, and “página de bloqueo”. No existing logo or other brand asset was supplied before the prototype.

## Evidence on Hand

`.scratch/bloqueo-navegacion/spec.md`, its ten issue files, `GLOSSARY.md`, and `docs/arquitectura.md`. No existing UI, brand assets, or real initial domain list.

## Product Principles

- Make the permanence of each confirmation clear before it happens.
- Show exactly what is and is not protected.
- Keep the blocking moment deliberately sparse.
- State browser coverage accurately and repair a failed integration without stopping healthy browsers.
