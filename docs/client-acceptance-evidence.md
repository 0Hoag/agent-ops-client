# Client acceptance evidence

Environment precedence can be reproduced with `pnpm verify:env`. The isolated fixture writes disposable `.env`, `.env.test`, and `.env.local` values, transpiles the actual `src/shared/env.ts` and `src/shared/http.ts` consumer, and verifies the configured Axios base URL. The wrong-order control reports `https://base.example !== https://local.example`.

`pnpm verify:servers` checks dev on `127.0.0.1:4317` and the production preview on `127.0.0.1:4318`; each waits for HTTP 200 and verifies cleanup of its owned process group. `pnpm verify:browser` uses Playwright route fixtures (not a real API), captures health loading/data/error and board loading/empty/error/data screenshots under `artifacts/browser/`, checks for browser page/console errors, and verifies dev server cleanup. The 503 responses intentionally model API errors; Chromium's corresponding failed-resource console notices are excluded, while application console/page errors fail the check.

Screenshots and `console-errors.log` are captured outputs, not real API smoke evidence. HTTP import audit: module API calls are in `src/modules/{board,health}/services/client.ts` and shared `src/shared/http.ts`; UI/hooks consume module service functions. No screen imports Axios or shared HTTP directly. The routes remain `/` (health) and `/board`.

Module layout and formatting were compared to the adapted `packages/fastchannel/src` module/route/paths/client conventions. The client router and API service paths remain client-specific. Company source is read-only and is not copied into this repository.
