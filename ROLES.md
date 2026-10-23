# Roles

| Role | Responsibility | Boundary |
| --- | --- | --- |
| Owner | Product decisions, credentials, irreversible actions | Agents do not make these decisions |
| Coordinator | Plan and dispatch issues, review results, merge approved PRs | Does not implement worker tasks |
| Implementer | Complete the assigned brief in one branch and open a PR | Does not merge or expand into unrelated issues |
| Reviewer | Inspect changes and checks for false passes | Does not edit or commit |

## Implementer checklist

1. Read the assigned brief and the referenced client standards.
2. Run the required client gate from [AGENTS.md](AGENTS.md).
3. Validate changed shell scripts and JSON configuration.
4. Open a PR against `main` with `Closes #n`, commands run and results, and a `Not covered` section.
5. Report blockers or unverified acceptance explicitly; never claim checks that were not run.
