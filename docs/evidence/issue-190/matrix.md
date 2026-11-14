| Acceptance | Command | Expected | Actual |
| --- | --- | --- | --- |
| SETTINGS_REAL_LOGIN | sign in synthetic account; select persisted organization | registered Settings repository panel | registered Settings repository panel |
| SETTINGS_SCREENSHOT_repositories_1280_light | viewport 1280; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_repositories_1280_dark | viewport 1280; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_repositories_390_light | viewport 390; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_repositories_390_dark | viewport 390; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_REPOSITORY_TEST_CREATE_SYNC | Settings → GitLab fixture → Test connection → Create → reload → Sync now → Work | HTTP 200/201/200; persisted repository; success timestamp; synced task visible | HTTP 200/201/200; persisted repository; success timestamp; synced task visible |
| SETTINGS_CLIPBOARD_EXACT_COMMAND | select repository + transcript; Copy command; read OS clipboard | : "${AGENT_RUN_TOKEN:?Set AGENT_RUN_TOKEN to the configured ingestion credential}" && agentops push --harness 'codex' --endpoint 'http://127.0.0.1:59571/api/v1/agent-runs' --repository-id '25980a79-0fde-4657-8ba1-d1382750af35' --wave setup --worker local-agent '/sessions/settings fixture.jsonl' | : "${AGENT_RUN_TOKEN:?Set AGENT_RUN_TOKEN to the configured ingestion credential}" && agentops push --harness 'codex' --endpoint 'http://127.0.0.1:59571/api/v1/agent-runs' --repository-id '25980a79-0fde-4657-8ba1-d1382750af35' --wave setup --worker local-agent '/sessions/settings fixture.jsonl' |
| SETTINGS_SCREENSHOT_prices_1280_light | viewport 1280; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_prices_1280_dark | viewport 1280; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_prices_390_light | viewport 390; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_prices_390_dark | viewport 390; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_PRICE_INDEPENDENT_COST | create $2 input/$5 output version; reload; Overview → 30 days → dedicated pricing repository | persisted 1M input + 100K output → price-derived USD $2.50; not recorded cost | persisted 1M input + 100K output → price-derived USD $2.50; not recorded cost |
| SETTINGS_SCREENSHOT_priced-overview_1280_light | viewport 1280; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_priced-overview_1280_dark | viewport 1280; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_priced-overview_390_light | viewport 390; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_priced-overview_390_dark | viewport 390; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_INVITATION_LINK | Members → viewer → invitation; separate synthetic account signs in and accepts; owner reloads | real invitation accepted; persisted viewer identity visible | real invitation accepted; persisted viewer identity visible |
| SETTINGS_SCREENSHOT_budgets_1280_light | viewport 1280; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_budgets_1280_dark | viewport 1280; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_budgets_390_light | viewport 390; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_budgets_390_dark | viewport 390; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_BUDGET_PERSISTED | Advanced → Budgets → create dated 2M-token/$25 budget → reload | same limits after real reload | same limits after real reload |
| SETTINGS_SCREENSHOT_alerts_1280_light | viewport 1280; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_alerts_1280_dark | viewport 1280; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_alerts_390_light | viewport 390; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_alerts_390_dark | viewport 390; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_ALERTS_PERSISTED | Advanced → Alerts → save .75/600/7200 thresholds; create synthetic Slack env reference; reload | persisted threshold + enabled channel; no external delivery claimed | persisted threshold + enabled channel; no external delivery claimed |
| SETTINGS_LOGS_REJECT_INVALID_TOKEN | real worker-log upgrade with deliberately invalid credential | HTTP 401; upstream session validation remains enforced | HTTP 401; upstream session validation remains enforced |
| SETTINGS_SCREENSHOT_logs_1280_light | viewport 1280; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_logs_1280_dark | viewport 1280; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_logs_390_light | viewport 390; CSS theme light; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_SCREENSHOT_logs_390_dark | viewport 390; CSS theme dark; screenshot | production panel; no document overflow | production panel; no document overflow |
| SETTINGS_REAL_WORKER_LOGS | Advanced → Logs → start allowlisted local fixture tool; observe real websocket | two deterministic process stdout lines + worker.completed rendered | two deterministic process stdout lines + worker.completed rendered |
| SETTINGS_RUNTIME | observe browser pageerror + real HTTP responses | no runtime errors or failed API requests | no runtime errors or failed API requests |
