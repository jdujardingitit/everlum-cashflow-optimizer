# Reproducible V1 Review Runtime

This Docker runtime is preservation infrastructure. It does not modify the frozen plugin.

## Requirements

- Docker Desktop or Docker Engine with Compose v2
- Git
- PowerShell 7 or Windows PowerShell 5.1 for `manage-review.ps1`
- Node.js 20 and npm only when running the Playwright action locally

## Actions

`manage-review.ps1` accepts `Setup`, `Start`, `Stop`, `Reset`, `Health`, `Test`, and `Remove`.

- Setup verifies the frozen tag, archives the plugin directly from it, generates local credentials outside Git, starts WordPress/MySQL, activates the plugin, creates the QA page, and seeds two synthetic users.
- Start and Stop preserve the private database volume.
- Reset deletes only synthetic plan/preregistration rows and recreates the synthetic users and QA page.
- Health checks database, site, and `data-testid="ecf-cashflow-root"`.
- Test runs the established Playwright suite when Node/npm and browsers are installed.
- Remove deletes only the named Docker project and the local review runtime under LocalAppData.

Local URL:

`http://127.0.0.1:9400/everlum-cf-qa/?ecf_e2e=1&disable_clarity=1&ecf_mock_turnstile=1`

The environment displays `V1 REVIEW - NONPRODUCTION`, blocks indexing and updates, disables Clarity, sends no email, and uses only `.test` users. Generated credentials are written to the private runtime directory and never to Git.

If Tailscale is already installed and connected, the site may be shared with Tailscale Serve only. Never use Funnel.
