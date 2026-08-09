# Everlum Cash Flow Optimizer (Phase 1)

This plugin creates a safe side-by-side implementation of the Phase 1 calculator under a new shortcode:
`[everlum_cashflow_optimizer]`.

## What is included

- Step-by-step wizard UI:
  - Budget
  - Debts
  - Cash Flow Optimizer
  - Results
  - Save Plan
  - Money Steps
- Summary Budget and Itemized Budget paths (toggle between both).
- Strategy engine (minimum, avalanche, snowball, custom, velocity banking, infinite banking).
- Save plan for logged-in users in a dedicated table (`wp_everlum_cf_plans`).
- Save progress for guests via browser `localStorage`.
- Optional Turnstile fields for form submissions.
- Preregistration form for notification interests.
- Infinite Banking strategy is currently optional/placeholder-only in Phase 1; a distinct bounded IBC engine is not implemented yet.

## Install

1. Copy `everlum-cashflow-optimizer.php` and the `assets/` folder into a WordPress plugin directory.
2. Activate the plugin from the WP admin dashboard.
3. Add `[everlum_cashflow_optimizer]` to any post/page where the experience should appear.

## Recommended environment variables

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

If `TURNSTILE_SITE_KEY` or `TURNSTILE_SECRET_KEY` is missing, Turnstile enforcement is disabled with explicit staging/production notice via the admin warning.

## Storage and table names

- `wp_everlum_cf_plans` (via `everlum_cf_plans`)
- `wp_everlum_cf_prereg_signups` (via `everlum_cf_prereg_signups`)

Notes:
- In production/staging, if either Turnstile key is missing, the plugin shows an admin notice so the environment is not silently running with unprotected auth/public forms.
- Save-plan flow uses the current authenticated user's latest plan when no `plan_id` is provided, preventing accidental duplicate plan rows for the same user session.
- Infinite Banking currently runs as optional placeholder strategy logic until a dedicated bounded IBC engine is implemented.

- Itemized Budget flow excludes Normal Savings from expenses and subtracts it separately from income, so savings is not double-counted.
- Big purchase rollover adds only the unused portion of that month's big-purchase allocation back to debt.
- Velocity Banking does not apply artificial multipliers; its output is based on ordering, timing, and card-interest accrual on remaining card balance after in-month payoff flow.

## Planned safety behavior

- No page template is replaced.
- No existing live calculator is overridden by default.
- Existing theme/pages continue to run unless the shortcode is intentionally added.

## Server-side hooks ready for future expansion

- `everlum_cf_money_steps_access` filter can control paid gating later.
- `everlum_cf_frontend` nonce is used for all AJAX endpoints.

## Notes

- This is a working foundation for Phase 1 and should be reviewed by financial engineering + QA before production launch.
- Admin/developer settings, staging Access policy, and CDN/WAF tuning still need deployment-specific setup (Cloudflare side).

## Playwright / Microsoft Clarity setup (QA-ready)

### Environment requirements

- Node.js 18+ on the QA box (for local command execution)
- WordPress sandbox/staging with this plugin active
- Shortcode page containing `[everlum_cashflow_optimizer]`

### Suggested environment variables

- `ECF_CALC_URL` or `CALCULATOR_URL`: calculator page URL
- `ECF_TEST_USER_EMAIL`, `ECF_TEST_USER_PASSWORD`
- `ECF_TEST_USER_EMAIL_ALT`, `ECF_TEST_USER_PASSWORD_ALT` (cross-user plan ownership checks)
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (optional for sandbox, can run mocked)
- `EVERLUM_CLARITY_PROJECT_ID` (production/staging analytics only)

### Install Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

### Test commands

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:report
```

Use `ecf_mock_turnstile=1` and `disable_clarity=1` are injected automatically for E2E runs.

### Clarity in plugin

- Clarity is loaded only when:
  - analytics environment is enabled (`production` or `staging`, unless forced), and
  - a valid project ID is available from `EVERLUM_CLARITY_PROJECT_ID` (or admin option), and
  - `disable_clarity=1` or `ecf_e2e=1` are not present.
- If values are missing in non-analytics environments, Clarity is not loaded.
- Sensitive controls/values are marked with:
  - `.ecf-sensitive`
  - `.ecf-financial-input`
  - `.ecf-money-steps`
  - `.ecf-saved-plan`
  - `data-clarity-mask="true"` (field-level mask markers)

## Current QA status

Playwright test files are scaffolded and ready, but runtime execution remains environment-dependent.
Until Node/Playwright is available in the QA environment, status is:

**Playwright tests prepared. Runtime execution pending environment access.**

Runtime execution paths are now documented in `README_QA_RUNTIME.md`:

- Preferred: GitHub Actions workflow at `.github/workflows/e2e.yml`
- Fallback: `docker-compose.yml`, `scripts/setup-wp.sh`, `scripts/install-plugin.sh`
- External staging: use `ECF_CALC_URL` and test user env variables
