# Cashflow Optimizer Sandbox QA Checklist (human-run)

Use this against LocalWP, staging, or any WordPress sandbox.  
Status before execution: **Milestone 2 calculation logic corrected by static review. Runtime QA and Velocity timing validation pending.**

## Required setup
- WordPress: 6.4+ (Multisite optional).
- PHP: 8.0+.
- Database: MySQL/MariaDB table storage available.
- WordPress plugin installed and activated from this repository.
- Test page containing `[everlum_cashflow_optimizer]`.
- Turnstile:
  - Sandbox: keys may be empty (mock mode).
  - Production/staging test of real mode: set both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- DB tables:
  - `wp_everlum_cf_plans`
  - `wp_everlum_cf_prereg_signups` (this is the prereg table name; avoid `wp_everlum_cf_signups`).

## Test users
- Existing user A (test account), logged in and verified.
- Existing user B (test account), logged in and verified.
- One disposable email pattern for new signups (e.g., `qa-new-####@example.test`).

## Turnstile instructions
- Mock mode (recommended for local/sandbox): leave Turnstile env vars empty.
- Real mode: set test keys and ensure Cloudflare widget appears for signup/login/forgot/prereg forms.

## Browser/device matrix
- Desktop Chrome
- Desktop Firefox
- Mobile portrait (required)
- Mobile landscape (required only if flow behavior differs in portrait)

## Execution steps
1. **Save Plan → existing user login**
   - As guest, reach Results, click **Continue to Save Plan**.
   - Complete login for existing User A.
   - Expect return to Save Plan step and Save action owned by User A.

2. **Save Plan → new user signup**
   - Repeat step with fresh email signup.
   - Expect auto-login and return to Save Plan step.

3. **Money Steps → existing user login**
   - As guest, go to Save Plan, click **Continue to Money Steps**, login User A.
   - Expect return to Money Steps step.

4. **Money Steps → new user signup**
   - Repeat step with fresh signup user.
   - Expect auto-login and return to Money Steps step.

5. **Normal calculator flow return**
   - Trigger login/signup from calculator path that maps to results/progress.
   - Expect return to Results/progress flow (no error state).

6. **Missing/invalid `ecf_auth_return` fallback**
   - Test with `?ecf_auth_return=badvalue` and `?ecf_auth_return=99`.
   - Expect safe fallback behavior and valid step navigation.

7. **Turnstile behavior**
   - Verify login/signup/forgot/prereg forms render/check for expected behavior in mock mode and real mode.

8. **Console checks**
   - No new JS errors during auth-return, save/load, and form submissions.
   - Network 200 for `admin-ajax.php` auth/save calls.

9. **Saved plan ownership checks**
   - Save under User A, capture `wp_everlum_cf_plans.id` and `user_id`.
   - Save under User B and confirm they cannot read User A row.
   - Confirm duplicate plan rows are not created for repeated saves by the same user in normal flow.
   - Confirm only expected rows exist in `wp_everlum_cf_plans` for test users after cleanup.
