# Everlum Cash Flow Optimizer Runtime QA Guide

Runtime QA is not executed in this Codex session. Use one of the paths below.

## Current status baseline

- **Playwright tests scaffolded**: `tests/e2e/*.spec.ts`
- **Runtime**: prepared but not executed here
- Status message: **Playwright tests prepared. Runtime execution pending environment access.**

## Path A (preferred): GitHub Actions CI

Use `.github/workflows/e2e.yml`:

- Starts MySQL.
- Bootstraps WordPress locally.
- Installs the plugin from repo files.
- Creates the calculator page (`[everlum_cashflow_optimizer]`).
- Creates test users.
- Runs `npm install`, `npx playwright install`, and `npm run test:e2e`.
- Captures:
  - `playwright-report`
  - `test-results` (screenshots/traces on failure)
  - WordPress server logs

### Required repo inputs

- WordPress core download version is pinned in workflow.
- Plugin source is repo root:
  - `everlum-cashflow-optimizer.php`
  - `assets/`

### CI runner variables in workflow

- `ECF_CALC_URL` is set to the sandbox page URL for the created QA page.
- `ECF_TEST_USER_EMAIL`
- `ECF_TEST_USER_PASSWORD`
- `ECF_TEST_USER_EMAIL_ALT`
- `ECF_TEST_USER_PASSWORD_ALT`
- `ECF_E2E_TURNSTILE_MOCK=1`

### Run

Push to `master` or trigger manually:

- GitHub Actions → **Everlum Cashflow Optimizer - E2E QA** → **Run workflow**

### Outputs to collect

- Playwright HTML report: `playwright-report/`
- Trace files and failure screenshots: inside `test-results/`
- Server logs: `${RUNNER_TEMP}/wp-server.log`

## Path B: Docker / local sandbox

Use the included:

- `docker-compose.yml`
- `scripts/setup-wp.sh`
- `scripts/install-plugin.sh`

### Commands

1. Start services:

```bash
docker compose up -d
```

2. Wait for both `db` and `wordpress` to be healthy, then create WordPress data and plugin install:

```bash
docker compose run --rm wpcli bash /workspace/scripts/setup-wp.sh
```

3. Install Node dependencies and run Playwright:

```bash
npm install
npx playwright install --with-deps
```

4. Run test matrix:

```bash
ECF_CALC_URL=http://localhost:8080/everlum-cf-qa/ \
ECF_TEST_USER_EMAIL=eecf-user-a@example.test \
ECF_TEST_USER_PASSWORD=EecfPassA!234 \
ECF_TEST_USER_EMAIL_ALT=eecf-user-b@example.test \
ECF_TEST_USER_PASSWORD_ALT=EecfPassB!234 \
ECF_E2E_TURNSTILE_MOCK=1 \
npm run test:e2e
```

5. Optional report:

```bash
npm run test:e2e:report
```

## Path C: External staging URL

When using external QA/staging site, set:

- `ECF_CALC_URL=https://staging-site-url/...`
- `ECF_TEST_USER_EMAIL=...`
- `ECF_TEST_USER_PASSWORD=...`
- `ECF_TEST_USER_EMAIL_ALT=...`
- `ECF_TEST_USER_PASSWORD_ALT=...`
- `ECF_TEST_SIGNUP_EMAIL=...` (optional)
- `ECF_E2E_TURNSTILE_MOCK=1`
- include `ecf_e2e=1` and/or `disable_clarity=1` in query where possible (or rely on runtime injection in test helpers)

Then run:

```bash
npm install
npx playwright install --with-deps
npm run test:e2e
npm run test:e2e:report
```

## Clarity + data safety

Runtime runs should verify:

- Clarity loads only when a valid project ID is present.
- Tests include:
  - `ecf_e2e=1`
  - `disable_clarity=1`
  - `ECF_E2E_TURNSTILE_MOCK=1` / mocked Turnstile token fill in `tests/e2e`
- Sensitive containers/fields are masked via:
  - `.ecf-sensitive`
  - `.ecf-financial-input`
  - `.ecf-money-steps`
  - `.ecf-saved-plan`
  - `data-clarity-mask="true"`

## Runtime QA review package outputs

For each run, include:

1. Runtime path used
2. Sandbox URL tested
3. Report location (`playwright-report`)
4. Failure artifacts from `test-results` (screenshots, traces)
5. Pass/fail matrix summary
6. Console errors, if any
7. AJAX/network errors, if any
8. Saved-plan user-scope checks
9. Clarity disabled/masked confirmation
10. Remaining issues before approval

## Runtime status vocabulary

- If tests are prepared but not run:
  - **Playwright tests prepared. Runtime execution pending environment access.**
- If tests run and pass:
  - **Runtime QA passed in sandbox/staging. Ready for manual owner review.**
- If tests run and fail:
  - **Runtime QA completed with failures. Fixes required before approval.**
