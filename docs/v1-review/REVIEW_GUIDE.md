# WordPress V1 Owner Review Guide

## Required state

- Use only `ecf-wordpress-v1.0-review` or `archive/wordpress-v1-review`.
- Use synthetic `.test` users and synthetic financial cases.
- Keep Clarity disabled and Turnstile mocked or configured with test keys.
- Confirm the banner reads `V1 REVIEW - NONPRODUCTION`.
- Use the `/everlum-cf-qa/` page with the required QA flags.

## Quick review sequence

1. Open Budget and verify Summary and Itemized modes remain mutually exclusive.
2. Verify Summary Budget computes income minus expenses minus normal savings.
3. Verify Itemized Budget does not count savings as an expense and subtract it again.
4. Add debts and inspect Minimum Payments, Avalanche, Snowball, and Custom ordering.
5. Inspect Credit Card Velocity generic and custom timing labels and disclaimers.
6. Confirm LOC is optional and Infinite Banking is N/A or limited when not ready.
7. Reach Results and review recommendation, payoff timeline, interest, order, and balances.
8. As a guest, test Save Plan login and signup returns.
9. Test Money Steps login and signup returns and weekly, bi-weekly, and monthly rows.
10. Save a plan as User A, sign in as User B, and verify User B cannot retrieve it.
11. Repeat on desktop Chromium, desktop Firefox, and a mobile portrait viewport.
12. Confirm no PHP fatal, browser console, page, AJAX, or unexpected network errors.

## Expected baseline

The automated baseline contains 17 scenarios in Chromium and the same 17 in Firefox. All 34 passed in workflow runs `31335807549` and `31408803647` on commit `e4de26b154b10f01c5df14c3c9de04ecd48b0b9e`.

Owner review is not production approval. Do not enter real financial information.
