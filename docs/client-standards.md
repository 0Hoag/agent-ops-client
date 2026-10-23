# Client code standards

The client is a standalone React application in `0Hoag/agent-ops-client`. The API remains in [`0Hoag/agent-ops`](https://github.com/0Hoag/agent-ops). Do not copy company source or secrets into this public repository; company repositories are read-only references.

## Layout and design

- `src/app/` owns application composition, routes, and layout.
- `src/modules/<name>/` owns each independent feature and its API services, types, pages, and components.
- `src/shared/` owns reusable HTTP, UI, and utility code.
- Modules must not import one another; shared behavior belongs in `src/shared/`.
- TypeScript strictness is required; type every API response.
- Use TanStack Query for server state and array query keys. Keep API access behind the module's service layer.
- Provide loading, empty, and error states on every API-backed screen.
- Keep the UI suitable for a dense ERP dashboard: one primary action per screen, no record data in headers, and no forced all-caps.

## Style and testing

- Follow the existing ESLint and TypeScript configuration; use single quotes, semicolons, and two-space indentation.
- Keep files focused and preferably under 200 lines.
- Use Vitest for pure functions and hooks. When claiming a test proves a behavior, demonstrate that the test fails when that behavior is broken.

## Runtime configuration

Document client environment variables in `.env.example`; never commit real values. The development server proxies `/healthz` to the API at `http://localhost:8080`. The API must be run separately from [`0Hoag/agent-ops`](https://github.com/0Hoag/agent-ops). Full end-to-end real API integration requires that API to be available; CI runs the standalone client checks only.
