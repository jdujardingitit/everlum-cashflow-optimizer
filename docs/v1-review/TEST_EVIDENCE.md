# V1 Test Evidence

## Verified runs

| Evidence | Value |
| --- | --- |
| Tested commit | `e4de26b154b10f01c5df14c3c9de04ecd48b0b9e` |
| Original passing run | `31335807549` |
| Original event | `push` |
| Preservation rerun | `31408803647` |
| Rerun event | `workflow_dispatch` |
| Rerun job | `93521615132` |
| Rerun duration | 3m33s job, 1.6m Playwright |
| Frozen-tag restore run | `31417607189` |
| Frozen-tag restore job | `93550219963` |
| Frozen-tag restore result | 34 passed in 1.7m Playwright |
| Chromium | 17 passed |
| Firefox | 17 passed |
| Total | 34 passed, 0 failed |

Both runs used the same exact commit and the repository workflow `Everlum Cashflow Optimizer - E2E QA`.

The additional clean restore run checked out `ecf-wordpress-v1.0-review` directly, rebuilt WordPress 6.5.5/PHP 8.2/MySQL 8.0, activated the plugin, created the QA page and synthetic users, and passed all 34 browser tests on the same SHA.

## Established commands

```text
php -l everlum-cashflow-optimizer.php
npm install
npx playwright install --with-deps
npm run test:e2e
npm run test:e2e:report
```

## Scenario matrix, repeated in Chromium and Firefox

1. Save Plan existing-user login returns to Save Plan.
2. Save Plan signup returns to Save Plan.
3. Money Steps existing-user login returns to Money Steps.
4. Money Steps signup returns to Money Steps.
5. Missing or invalid `ecf_auth_return` falls back safely.
6. Saved plan ownership remains scoped to its creator.
7. Guest calculator flow reaches Results without JS or AJAX failures.
8. Summary Budget calculation and unexpected funds are accepted.
9. Itemized Budget excludes savings from expenses.
10. Mobile portrait remains usable.
11. Mobile landscape controls and educational help remain usable.
12. Money Steps renders weekly, bi-weekly, and monthly output with required columns.
13. Guest Money Steps is gated behind account creation.
14. Generic Credit Card Velocity shows estimated timing and default APR notices.
15. Custom timing fields apply the partial-date disclaimer.
16. LOC Velocity shows N/A without inputs and an estimate with inputs.
17. Turnstile targets exist for authentication and public forms.

## Strict guards

The Playwright harness fails on uncaught page errors, browser console errors, unexpected AJAX or network failures, and invalid application assertions. The passing guest-flow test explicitly states that Results were reached without JS/AJAX failures. Saved-plan ownership isolation, auth nonce refresh, URL/query preservation, Turnstile mock behavior, and Clarity disable behavior are part of the established test code.

## Artifact evidence

The passing runs uploaded `eecf-playwright-runtime-artifacts`, containing the Playwright HTML report, `test-results`, and the WordPress server log. The original artifact ID is `9044316878`. Evidence was downloaded before expiration into a local temporary diagnostics directory and is not committed.

No passing test was skipped, disabled, weakened, or given a longer timeout for preservation.
