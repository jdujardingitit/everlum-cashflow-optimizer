# V1 Environment Manifest

## Source identity

- Repository: `jdujardingitit/everlum-cashflow-optimizer`
- Default branch: `master`
- Tested commit: `e4de26b154b10f01c5df14c3c9de04ecd48b0b9e`
- Frozen tag: `ecf-wordpress-v1.0-review`
- Frozen branch: `archive/wordpress-v1-review`
- Plugin header version: `0.1.0`

## Verified CI runtime

- GitHub runner: Ubuntu 24.04 image `ubuntu24/20260720.247`
- WordPress: 6.5.5, `en_US`
- PHP: 8.2.33
- Database: official `mysql:8.0` service image
- Node.js: 20.20.2
- npm: 10.8.2
- Playwright dependency request: `@playwright/test ^1.54.1`
- Resolved Playwright browser build set: Chromium build 1234 and Firefox build 1538
- Chromium: Chrome for Testing 151.0.7922.34
- Firefox: 153.0
- Web server: WP-CLI PHP development server on `127.0.0.1:8080`
- Active theme: Twenty Twenty-Four, bundled with WordPress 6.5.5
- Active plugin: Everlum Cashflow Optimizer 0.1.0
- Bundled inactive plugins: Akismet and Hello Dolly from the WordPress 6.5.5 distribution

The workflow did not emit the MySQL patch version or an npm lockfile. The tested image tag and observed browser build IDs are preserved; this is recorded as a reproducibility limitation rather than guessed.

## WordPress configuration

- Permalinks: `/%postname%/`
- Page slug: `everlum-cf-qa`
- Page shortcode: `[everlum_cashflow_optimizer]`
- Plugin activation: required
- Environment type: `local`
- WP-Cron: disabled in QA
- Core and background updates: disabled in QA
- Search indexing: blocked in the review package

## Canonical URL

`http://127.0.0.1:8080/everlum-cf-qa/?ecf_e2e=1&disable_clarity=1&ecf_mock_turnstile=1`

The path and all existing query parameters must be preserved.

## Configuration names, never values

- `ECF_CALC_URL`
- `ECF_TEST_USER_EMAIL`
- `ECF_TEST_USER_PASSWORD`
- `ECF_TEST_USER_EMAIL_ALT`
- `ECF_TEST_USER_PASSWORD_ALT`
- `ECF_TEST_SIGNUP_EMAIL`
- `ECF_E2E_TURNSTILE_MOCK`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `EVERLUM_CLARITY_PROJECT_ID`
- `WP_DB_NAME`
- `WP_DB_USER`
- `WP_DB_PASSWORD`
- `WP_DB_HOST`

No configuration values are preserved in Git or release assets.
