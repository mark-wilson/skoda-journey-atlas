# Agent instructions — Škoda Journey Atlas

## Project purpose

Škoda Journey Atlas is a free, independent, unofficial companion to MyŠkoda. It allows users to import journey-statistics CSV files, explore journeys on a map, reconstruct estimated road routes, correct journey information and maintain a personal travel record.

Read `README.md`, `docs/user-guide.md`, `docs/release-notes.md` and `docs/roadmap.md` before making substantive changes. Treat these as the current product documentation. The roadmap is an ideas backlog, not an approved implementation plan.

## Architecture and deployment

- Keep the application lightweight, static and client-side. It must remain usable by downloading the repository ZIP, extracting it and opening `index.html` directly in a modern browser.
- Do not introduce a mandatory backend, build system, package manager, account, API key or local development server without explicit approval.
- Preserve compatibility with the existing HTML, CSS and vanilla JavaScript structure.
- The main application scripts are `js/data.js` (shared helpers, data and persistence), `js/app.js` (maps, interface, editing and routing) and `js/importer.js` (CSV import, reconciliation, backup restoration and startup).
- Mapping uses Leaflet, MapLibre/OpenFreeMap and OpenStreetMap data; estimated road routing uses OSRM. Avoid introducing paid services or new external dependencies without approval.

## Data integrity and privacy

- Treat imported MyŠkoda data as source records. Preserve original CSV fields separately from user corrections.
- Do not silently overwrite manual corrections, itinerary points, notes or review decisions during re-import.
- Preserve existing user data across application updates. Changes to storage keys, journey identity, schemas or backup formats require explicit compatibility and migration consideration.
- Support existing JSON backups when introducing new backup formats or schema versions.
- Never claim an import, save or restore succeeded unless persistence has succeeded.
- Validate untrusted CSV, backup and user-input data. Never insert untrusted text into executable HTML.
- Do not add analytics, telemetry, accounts or server-side journey storage without explicit approval.
- Never commit real journey exports, personal travel histories, registration numbers or unredacted backups. Use fictional or anonymised test data.
- Disclose external requests that transmit route coordinates or viewed map areas.

## Product behaviour

- Keep the distinction between recorded MyŠkoda values, user-entered corrections and estimated road routes clear.
- Road routes are estimates, not GPS recordings of the roads actually travelled.
- Preserve shaping points, intermediate stops, charging stops and turnarounds, including their order and types.
- Maintain the distinction between editing drafts and saved corrections. Closing an editor without saving must not unexpectedly persist changes.
- Preserve the ability to review imports, identify duplicates and explicitly approve possible source revisions.
- Preserve the existing data-management workflow: Import journeys, Create data backup, Restore data backup and Delete local data.
- Keep journey ordering, selection, route analysis and review filters consistent unless a task explicitly changes them.
- Prioritise clear, approachable interfaces, keyboard accessibility and usability on smaller screens.

## Working practices

- Read the relevant code and documentation before editing. Do not assume that earlier review findings remain unresolved.
- Make the smallest coherent change that solves the requested problem. Avoid unrelated refactoring, renaming and cosmetic changes.
- Explain significant architectural or data-model changes and their trade-offs before implementing them.
- Prefer existing application patterns and established dependencies over introducing frameworks or abstractions.
- Consider input validation, error handling, storage failures, asynchronous routing and backward compatibility when relevant.
- Add or update targeted regression tests where practical. Keep any test tooling optional so the application remains usable without a build step.
- Test the affected behaviour and relevant regressions. State clearly which checks were run and which could not be run.
- Never describe a change as tested merely because the code was inspected.
- Update user-facing documentation when functionality or behaviour changes. Do not change release numbers, release notes or roadmap commitments unless requested.
- Maintain `CHANGELOG.md`: add a concise, user-relevant entry under `Unreleased` for each bug fix, feature or behavioural change. Do not list changes as released until the repository owner approves a release; preserve existing release history and do not invent dates or versions.

## GitHub workflow

- Use a dedicated branch for each substantive change and propose a pull request for review.
- Do not push directly to the default branch unless explicitly instructed.
- Provide a concise summary of changes, their rationale, tests performed and any remaining risks.
- Do not merge pull requests, publish releases, delete user data or make unrelated repository changes without explicit approval.

## Priorities

The immediate focus is improving reliability and resolving genuine defects before the first stable v1.0 release.

The initial Codex review identified potential HTML injection, persistence failures, backup validation and migration defects, routing consistency issues and accessibility gaps. Treat these as findings to verify against the current code, not as proof that they remain unresolved.

The repository owner retains control over feature priorities, architecture, releases and acceptance of changes.

Use UK English in documentation and user-facing text. Maintain the established terminology and visual identity of Škoda Journey Atlas, and preserve its independent, unofficial status.
