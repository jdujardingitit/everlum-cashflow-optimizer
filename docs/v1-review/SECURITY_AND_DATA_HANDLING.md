# Security and Data Handling

## Classification

The public source, documentation, test evidence, screenshots, and release assets are synthetic/nonproduction. The local recovery package is private synthetic operational data.

## Prohibited data

Never use or preserve real customers, real financial plans, bank data, payment data, production URLs, production logs, API keys, tokens, password hashes, reset links, `wp-config.php`, populated `.env` files, or other PII.

## Required controls

- Use `.test` email domains and generated local-only credentials.
- Keep credentials outside Git, release notes, screenshots, logs, and public assets.
- Keep the SQL snapshot and full recovery package outside OneDrive and outside the repository.
- Do not upload SQL to the GitHub release.
- Disable Clarity during QA and mask all financial, identity, saved-plan, and Money Steps areas when analytics is enabled elsewhere.
- Send only event names to UX analytics, never financial values.
- Use Turnstile mock or vendor test keys only.
- Disable outbound email/SMS and production integrations.
- Block indexing and background WordPress updates in review environments.
- Use Tailscale Serve only for optional private remote review; never Funnel.

Clarity is for UX tracking only. Financial inputs must remain masked.

Before publishing any asset, scan it for credentials, tokens, production hosts, email addresses outside approved `.test` values, SQL records, and financial input values.
