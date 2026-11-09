# Future enhancements

This is an ideas backlog for future versions of Journey Atlas, **not a commitment or release schedule**. Suggestions and feedback are welcome through GitHub Issues.

## Ideas to explore

| Idea | Potential benefit | Considerations |
| --- | --- | --- |
| **Energy efficiency** | Show mi/kWh and kWh/100 km for journeys, with averages and comparisons | Check which energy and distance fields are consistently present in MyŠkoda exports; avoid implying estimated route mileage is recorded distance |
| **Efficiency trends** | Compare efficiency over time, by month or journey length | Consider temperature, season and driving conditions; avoid misleading comparisons |
| **Journey statistics dashboard** | Summarise total journeys, mileage, energy and travel patterns | Keep calculations transparent and useful on small datasets |
| **Charging-stop summaries** | Review stops marked as charging and optionally add charging notes | Charging points added manually are not necessarily charging sessions recorded by the vehicle |
| **More export formats** | Support CSV variations from other MyŠkoda versions or vehicles | Needs redacted examples and schema validation |
| **Improved incomplete-data review** | Make it easier to find, filter and correct records requiring attention | Preserve the original imported data and make changes reversible |
| **Map and route usability** | Easier shaping-point placement, editing and route comparisons | Keep the interface approachable and mobile-friendly |
| **Portable sharing** | Export a privacy-conscious map or summary image | Never expose precise home or work locations by default |
| **Accessibility and smaller screens** | Better keyboard navigation and responsive layouts | Test with real browsers and assistive technologies |

## Prioritisation

Before starting a feature, confirm that it is useful to owners, can work with available CSV data, and does not compromise the local-first privacy model. The current focus is a stable, clearly documented v1.0 release.
