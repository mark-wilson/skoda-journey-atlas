# Changelog

Notable changes to Škoda Journey Atlas are recorded here, newest first. Entries describe released behaviour rather than every individual commit. See [release notes](docs/release-notes.md) for more information about the first public beta.

## Unreleased

Changes accepted after the first public beta will be recorded here before the next release.

## v1.0.0-beta.1 — 9 November 2026

First public beta of Škoda Journey Atlas.

### Added

- Import MyŠkoda journey-statistics CSV files with a preview of new journeys, duplicates, incomplete records and possible revisions requiring explicit approval.
- Explore imported journeys on an interactive map with a searchable journey list and journey details.
- Reconstruct estimated road routes using shaping points, intermediate stops, charging stops and turnarounds.
- Correct journey details, add observations and mark journeys as checked or needing review.
- Compare recorded MyŠkoda mileage with estimated road distances.
- Create and restore JSON backups of locally stored journeys, corrections and import history, or delete local data after confirmation.
- Illustrated user guide, demonstration screenshots, roadmap and MIT licence.

### Notes

- This is an independent, unofficial companion to MyŠkoda, not affiliated with or endorsed by Škoda Auto.
- Journey data is kept in the browser; map tiles and routing use external services, and routing sends coordinates to its provider.
- Road routes are estimates rather than recorded GPS tracks.
- Initially tested with a 2026 Škoda Enyaq running vehicle software 6.0.1 and MyŠkoda for iOS 8.18.0; other versions may export different data.
