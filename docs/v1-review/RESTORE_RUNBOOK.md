# V1 Restore Runbook

## Clean source restoration

1. Clone the repository into a new nonproduction directory.
2. Fetch tags and check out `ecf-wordpress-v1.0-review` in detached mode.
3. Verify `git rev-parse HEAD` equals `e4de26b154b10f01c5df14c3c9de04ecd48b0b9e`.
4. Verify the annotated tag message is `Everlum Cashflow Optimizer WordPress V1 review baseline`.
5. Do not add a banner or environment behavior to the frozen plugin.

## WordPress reconstruction

1. Provision WordPress 6.5.5, PHP 8.2, and MySQL 8.0 in an isolated environment.
2. Use a usable default theme, with Twenty Twenty-Four matching the verified baseline.
3. Configure `/%postname%/` permalinks.
4. Install the tagged plugin file and `assets/` directory under `wp-content/plugins/everlum-cashflow-optimizer`.
5. Activate only the Everlum Cashflow Optimizer application plugin.
6. Create page slug `everlum-cf-qa` containing `[everlum_cashflow_optimizer]`.
7. Use an environment-only must-use plugin for the nonproduction banner, update blocking, search blocking, status page, and Clarity disable behavior.
8. Seed only synthetic `.test` users and plans.

## Synthetic snapshot restoration

The private recovery package contains the synthetic SQL snapshot and checksums. It is not a GitHub release asset. Restore it only to the isolated review database, then run the deterministic seed/reset script to normalize synthetic users and plans.

## Validation

1. Check database health.
2. Check the site root and `/everlum-cf-qa/` return HTTP 200.
3. Confirm `data-testid="ecf-cashflow-root"` is present.
4. Use the canonical QA URL with all three flags.
5. Run PHP lint and the full established Playwright suite.
6. Require 17 Chromium and 17 Firefox passes.
7. Verify User B cannot retrieve User A's plan.
8. Verify no PHP fatal, console, page, AJAX, or unexpected network error.
9. Run reset and confirm the synthetic baseline is recreated.

The `runtime/manage-review.ps1` helper supplies setup, start, stop, reset, health, test, and removal actions when Docker is available. The frozen application must not be edited to repair restore infrastructure.
