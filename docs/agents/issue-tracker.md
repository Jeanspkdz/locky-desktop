# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- The spec is `.scratch/<feature-slug>/spec.md`.
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Triage state is recorded as a `Status:` line near the top of each issue file. See `triage-labels.md`.
- Comments and conversation history append under a `## Comments` heading.

## When a skill says "publish to the issue tracker"

Create the file under `.scratch/<feature-slug>/`, creating the directory if needed.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or issue number directly.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far, and Fog.
- Child ticket: `.scratch/<effort>/issues/NN-<slug>.md`, with a `Type:` line (`research`, `prototype`, `grilling`, or `task`) and `Status:` line (`claimed` or `resolved`).
- Blocking: `Blocked by: NN, NN` near the top. A ticket is unblocked when each listed ticket is resolved.
- Frontier: open, unblocked, unclaimed tickets in number order.
- Claim: set `Status: claimed` before work.
- Resolve: append an `## Answer`, set `Status: resolved`, and add a context pointer to the map's Decisions-so-far.
