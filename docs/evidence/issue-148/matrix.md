# Page/state/viewport matrix

Restored run `1794405171287`: **76/76 cells pass** the serious/critical axe,
document overflow and desktop header alignment assertions. At 390 px, scrollable
horizontal content regions are also zero. Axe version: 4.14.0; Chromium via
Playwright 1.64.1. Full node-level axe results: [matrix.json](matrix.json).

| Page | State | Data source | 1280 px | 390 px |
| --- | --- | --- | --- | --- |
| Overview | Populated | Real API | [image](overview-populated-1280.png) | [image](overview-populated-390.png) |
| Overview | Dark | Real API | [image](overview-dark-1280.png) | [image](overview-dark-390.png) |
| Overview | Loading | Route fixture | [image](overview-loading-1280.png) | [image](overview-loading-390.png) |
| Overview | Empty | Route fixture | [image](overview-empty-1280.png) | [image](overview-empty-390.png) |
| Overview | Error | Route fixture | [image](overview-error-1280.png) | [image](overview-error-390.png) |
| Work | Populated | Real API, SQL-seeded issue | [image](work-populated-1280.png) | [image](work-populated-390.png) |
| Work | Dark | Real API | [image](work-dark-1280.png) | [image](work-dark-390.png) |
| Work | Loading | Route fixture | [image](work-loading-1280.png) | [image](work-loading-390.png) |
| Work | Empty | Route fixture | [image](work-empty-1280.png) | [image](work-empty-390.png) |
| Work | Error | Route fixture | [image](work-error-1280.png) | [image](work-error-390.png) |
| Usage | Populated | Real API | [image](usage-populated-1280.png) | [image](usage-populated-390.png) |
| Usage | Dark | Real API | [image](usage-dark-1280.png) | [image](usage-dark-390.png) |
| Usage | Loading | Route fixture | [image](usage-loading-1280.png) | [image](usage-loading-390.png) |
| Usage | Empty | Route fixture | [image](usage-empty-1280.png) | [image](usage-empty-390.png) |
| Usage | Error | Route fixture | [image](usage-error-1280.png) | [image](usage-error-390.png) |
| Session detail | Populated | Real API, SQL-seeded timeline step | [image](session-populated-1280.png) | [image](session-populated-390.png) |
| Session detail | Dark | Real API | [image](session-dark-1280.png) | [image](session-dark-390.png) |
| Session detail | Loading | Route fixture | [image](session-loading-1280.png) | [image](session-loading-390.png) |
| Session detail | Empty | Route fixture | [image](session-empty-1280.png) | [image](session-empty-390.png) |
| Session detail | Error | Route fixture | [image](session-error-1280.png) | [image](session-error-390.png) |
| Settings / Repositories | Populated | Real API | [image](settings-populated-1280.png) | [image](settings-populated-390.png) |
| Settings / Repositories | Dark | Real API | [image](settings-dark-1280.png) | [image](settings-dark-390.png) |
| Settings / Repositories | Loading | Route fixture | [image](settings-loading-1280.png) | [image](settings-loading-390.png) |
| Settings / Repositories | Empty | Route fixture | [image](settings-empty-1280.png) | [image](settings-empty-390.png) |
| Settings / Repositories | Error | Route fixture | [image](settings-error-1280.png) | [image](settings-error-390.png) |
| Onboarding checklist | Complete | Real API | [image](onboarding-populated-1280.png) | [image](onboarding-populated-390.png) |
| Onboarding checklist | Dark | Real API | [image](onboarding-dark-1280.png) | [image](onboarding-dark-390.png) |
| Onboarding checklist | Loading | Route fixture | [image](onboarding-loading-1280.png) | [image](onboarding-loading-390.png) |
| Onboarding checklist | Empty | Route fixture | [image](onboarding-empty-1280.png) | [image](onboarding-empty-390.png) |
| Onboarding checklist | Error | Route fixture | [image](onboarding-error-1280.png) | [image](onboarding-error-390.png) |
| Settings / Agent setup | Populated | Real API | [image](settings-agent-populated-1280.png) | [image](settings-agent-populated-390.png) |
| Settings / Agent setup | Dark | Real API | [image](settings-agent-dark-1280.png) | [image](settings-agent-dark-390.png) |
| Settings / Model prices | Populated | Real API | [image](settings-prices-populated-1280.png) | [image](settings-prices-populated-390.png) |
| Settings / Model prices | Dark | Real API | [image](settings-prices-dark-1280.png) | [image](settings-prices-dark-390.png) |
| Settings / Members | Populated | Real API | [image](settings-members-populated-1280.png) | [image](settings-members-populated-390.png) |
| Settings / Members | Dark | Real API | [image](settings-members-dark-1280.png) | [image](settings-members-dark-390.png) |
| Settings / Advanced navigation | Populated | Real API | [image](settings-advanced-populated-1280.png) | [image](settings-advanced-populated-390.png) |
| Settings / Advanced navigation | Dark | Real API | [image](settings-advanced-dark-1280.png) | [image](settings-advanced-dark-390.png) |

## Keyboard results

[Machine-readable results](keyboard.json): visible solid 2 px focus outline;
mobile document-start Tab order → menu → Close → Overview → Work; Enter opens
Work and closes the drawer. Settings uses roving tab focus, ArrowRight/ArrowLeft
(unit-tested wrap), Home and End with an associated panel. At both widths,
keyboard activation covers date presets, Usage → Session → Usage, onboarding →
Agent setup, and Work → detail. These are specific tested flows, not a claim of
screen-reader or exhaustive keyboard coverage.

## Network and cleanup

[Safe response summaries](network.json): 173 real HTTP 200 responses; no real
API failures in the restored run. Explicit fixture failures returned 503.
The original, broken and restored runs shared project `w18-qa-8679`, database,
credentials and fixture identities. Ports: API 53163, client 53164, PostgreSQL
53165. Cleanup `down --volumes --remove-orphans --rmi local` exited 0; label
inspection found zero owned containers, networks or volumes, and `lsof` found
no listening servers on those three ports. The disposable directory was removed.

## Remaining lower-impact findings

Zero serious/critical does not mean zero axe findings. The manifest retains
moderate `landmark-unique` (Advanced navigation and repeated Usage setup links),
moderate `page-has-heading-one` (mobile Session transient states), and minor
`empty-table-header` (action columns in prices/members). These remain uncorrected
in this run. Members' raw identity is tracked separately in #178; price effective
dates also still display the API timestamp verbatim.
