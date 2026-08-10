# V1 Restore Drill

## Authoritative clean restore

- Date: 2026-08-10
- Source: annotated tag `ecf-wordpress-v1.0-review`
- Commit: `e4de26b154b10f01c5df14c3c9de04ecd48b0b9e`
- Workflow run: `31417607189`
- Job: `93550219963`
- Environment: Ubuntu 24.04, WordPress 6.5.5, PHP 8.2.33, MySQL 8.0, Node 20.20.2, npm 10.8.2
- Page: `/everlum-cf-qa/`
- Flags: `ecf_e2e=1`, `disable_clarity=1`, `ecf_mock_turnstile=1`
- Browser matrix: Chromium 17 passed; Firefox 17 passed
- Total: 34 passed in 1.7 minutes of Playwright execution
- PHP lint: passed
- WordPress bootstrap and plugin activation: passed
- Calculator root, authentication return, saved-plan isolation, Money Steps, URL/query preservation, Turnstile mock, Clarity disable, and strict error guards: passed
- Artifact: `eecf-playwright-runtime-artifacts`

This is the authoritative complete V1 restore gate because it uses the frozen tag directly and the repository's established Linux/MySQL workflow.

## Private synthetic snapshot

- Snapshot type: sanitized SQLite database from the synthetic local owner-review environment
- Users and usermeta: removed
- Saved plans and preregistrations: removed
- Credentials or known secret values: no matches
- Allowed email: `ecf-review-admin@example.test` only
- Allowed URL host: `127.0.0.1` only
- Active theme metadata: normalized to Twenty Twenty-Four
- Safety validation: passed

The snapshot restored far enough in WordPress Playground for the canonical synthetic page to be available through WordPress REST with the rendered `ecf-cashflow-root`, and for the environment status endpoint to report the frozen tag/commit. A full themed browser pass of that SQLite snapshot could not be completed on Windows because WordPress Playground repeatedly hit host mount/file-lock behavior. Docker is unavailable on this Lenovo, so the Docker/MySQL snapshot path remains an infrastructure validation action. This does not affect the authoritative tag-based GitHub restore run, but it remains a recovery-package hardening item and must not be represented as passed.

## Review environment

The existing local synthetic owner-review environment loaded the calculator, plugin CSS, plugin JavaScript, all six application steps, and the environment-only nonproduction banner. Twelve synthetic screenshots were captured across desktop and mobile. The browser console reported zero errors during the capture flow.
