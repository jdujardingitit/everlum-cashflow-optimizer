# Everlum Cashflow Optimizer WordPress V1 Preservation

This directory preserves the review baseline without modifying the frozen V1 application.

## Frozen references

- Commit: `e4de26b154b10f01c5df14c3c9de04ecd48b0b9e`
- Archive branch: `archive/wordpress-v1-review`
- Annotated tag: `ecf-wordpress-v1.0-review`
- Original verified run: `31335807549`
- Fresh preservation rerun: `31408803647`
- Result: 34 of 34 Playwright tests passed, with 17 Chromium and 17 Firefox tests.

The tag and archive branch point directly to the tested application commit. This documentation branch intentionally contains later documentation-only commits and must never replace or move the tag.

## Start here

- `REVIEW_GUIDE.md`: owner review flow.
- `ENVIRONMENT_MANIFEST.md`: pinned and observed runtime details.
- `TEST_EVIDENCE.md`: QA evidence and test matrix.
- `KNOWN_LIMITATIONS.md`: accepted V1 boundaries.
- `RESTORE_RUNBOOK.md`: clean restoration procedure.
- `RESTORE_DRILL.md`: completed restore evidence and remaining local-runtime caveat.
- `V1_TO_V2_PARITY_MATRIX.md`: future parity checklist only; V2 is not started here.
- `SECURITY_AND_DATA_HANDLING.md`: synthetic-data and secret restrictions.
- `V1_MAINTENANCE_POLICY.md`: frozen-version policy.
- `runtime/README.md`: reproducible nonproduction review environment.

## Canonical QA page

- Slug: `/everlum-cf-qa/`
- Shortcode: `[everlum_cashflow_optimizer]`
- Required QA query flags: `ecf_e2e=1`, `disable_clarity=1`, and `ecf_mock_turnstile=1`.

This baseline is nonproduction and retained for owner review and later V2 parity comparison. No production database, credentials, SQL backup, secrets, or real user data are included.
