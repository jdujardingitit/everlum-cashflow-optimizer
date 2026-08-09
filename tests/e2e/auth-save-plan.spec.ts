import { test, expect } from '@playwright/test';
import {
  addDebt,
  attachGuards,
  fillSummaryBudget,
  isAjaxActionResponse,
  openCalculator,
  mockTurnstileOnAllForms,
  testUsers,
  type AjaxAction,
} from './utils';

type AuthAction = 'login' | 'signup';

async function submitAuthForm(page: any, action: AuthAction): Promise<any> {
  const selectors = {
    login: {
      submit: '[data-testid="ecf-login-submit"]',
    },
    signup: {
      submit: '[data-testid="ecf-signup-submit"]',
    },
  };

  const actionName: AjaxAction = action === 'login' ? 'everlum_cf_login' : 'everlum_cf_signup';
  const responsePromise = page.waitForResponse(
    (response: any) => isAjaxActionResponse(response, actionName),
    { timeout: 20_000 },
  );
  const nonceResponsePromise = page.waitForResponse(
    (response: any) => isAjaxActionResponse(response, 'everlum_cf_auth_nonce'),
    { timeout: 20_000 },
  );

  await page.locator(selectors[action].submit).click();
  const response = await responsePromise;
  const nonceResponse = await nonceResponsePromise;
  expect(nonceResponse.ok()).toBeTruthy();
  expect((await nonceResponse.json())?.success).toBeTruthy();
  return response.json();
}

async function loginExistingUser(page: any): Promise<any> {
  const form = page.locator('#ecf-login-form');
  if (!testUsers.existingEmail || !testUsers.existingPassword) {
    return { success: false };
  }
  await expect(form).toBeVisible();
  await page.locator('#ecf-login-form [name="login"]').fill(testUsers.existingEmail);
  await page.locator('#ecf-login-form [name="password"]').fill(testUsers.existingPassword);
  const result = await submitAuthForm(page, 'login');
  return result;
}

async function seedCalculator(page: any): Promise<void> {
  await page.getByTestId('ecf-cta-start').click();
  await fillSummaryBudget(page, {
    income: 3600,
    expenses: 1500,
    savings: 300,
  });
  await page.getByTestId('ecf-step-budget-next').click();
  await addDebt(page, {
    name: 'Personal Loan',
    type: 'Personal Loan',
    balance: 4000,
    apr: 12,
    minimumPayment: 140,
  });
  await page.getByTestId('ecf-step-debts-next').click();
  await page.getByTestId('ecf-calc-button').click();
}

async function savePlanAsCurrentUser(page: any): Promise<number> {
  const savePlanResponse = page.waitForResponse((response: any) => (
    isAjaxActionResponse(response, 'everlum_cf_save_plan')
  ));
  await page.getByTestId('ecf-step-save').locator('#ecf-save-message');
  await page.locator('#ecf-save-plan-btn').click();
  const response = await savePlanResponse;
  const json = await response.json();
  if (!json.success || !json?.data?.plan_id) {
    return 0;
  }
  return Number(json.data.plan_id);
}

async function fetchPlanAsCurrentUser(page: any, planId: number): Promise<{ success: boolean; data?: unknown } | null> {
  const result = await page.evaluate(async (input) => {
    const form = new FormData();
    form.append('action', 'everlum_cf_get_plan');
    form.append('nonce', input.nonce);
    form.append('plan_id', String(input.planId));

    const response = await fetch('/wp-admin/admin-ajax.php', {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });

    return response.json();
  }, { nonce: await page.evaluate(() => (window as any).EverlumCF?.nonce || ''), planId });

  return result;
}

async function submitAuthFlowWithoutButton(nextPage: any, login: string, password: string): Promise<any> {
  await nextPage.locator('#ecf-login-form [name="login"]').fill(login);
  await nextPage.locator('#ecf-login-form [name="password"]').fill(password);
  return submitAuthForm(nextPage, 'login');
}

test.describe('Auth return path validation', () => {
  test('Save Plan with existing user login returns to Save Plan step', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    test.skip(!testUsers.existingEmail || !testUsers.existingPassword, 'Set ECF_TEST_USER_EMAIL and ECF_TEST_USER_PASSWORD for login flow');

    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await seedCalculator(page);
    await page.getByTestId('ecf-results-save-button').click();
    await page.locator('#ecf-save-message').scrollIntoViewIfNeeded();

    await page.locator('#ecf-login-form [name="login"]').fill(testUsers.existingEmail);
    await page.locator('#ecf-login-form [name="password"]').fill(testUsers.existingPassword);
    const result = await submitAuthForm(page, 'login');

    expect(result.success).toBeTruthy();
    await expect(page.getByTestId('ecf-step-save')).toBeVisible();
    await expect(page).toHaveURL(/ecf_auth_return=save/);
    await assertNoErrors();
  });

  test('Save Plan with signup returns to Save Plan step', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await seedCalculator(page);
    await page.getByTestId('ecf-results-save-button').click();

    const random = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const signupEmail = testUsers.signupEmail || `ecf-e2e-${random}@example.com`;
    await page.locator('#ecf-signup-form [name="email"]').fill(signupEmail);
    await page.locator('#ecf-signup-form [name="name"]').fill('E2E Signup User');
    await page.locator('#ecf-signup-form [name="password"]').fill('Password!234');
    await page.locator('#ecf-signup-form [name="password2"]').fill('Password!234');

    const result = await submitAuthForm(page, 'signup');
    expect(result.success).toBeTruthy();
    await expect(page.getByTestId('ecf-step-save')).toBeVisible();
    await expect(page).toHaveURL(/ecf_auth_return=save/);
    await assertNoErrors();
  });

  test('Money Steps with existing login returns to Money Steps step', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    test.skip(!testUsers.existingEmail || !testUsers.existingPassword, 'Set ECF_TEST_USER_EMAIL and ECF_TEST_USER_PASSWORD for login flow');

    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await seedCalculator(page);
    await page.getByTestId('ecf-results-save-button').click();
    await page.locator('#ecf-login-form [name="login"]').fill(testUsers.existingEmail);
    await page.locator('#ecf-login-form [name="password"]').fill(testUsers.existingPassword);
    await submitAuthForm(page, 'login');

    await expect(page.getByTestId('ecf-step-save')).toBeVisible();
    await page.getByTestId('ecf-save-money-steps-button').click();
    await expect(page.getByTestId('ecf-step-money-steps')).toBeVisible();
    await expect(page).toHaveURL(/ecf_auth_return=moneysteps/);
    await assertNoErrors();
  });

  test('Money Steps with signup returns to Money Steps step', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await seedCalculator(page);

    await page.getByTestId('ecf-results-save-button').click();
    const random = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const signupEmail = testUsers.signupEmail || `ecf-e2e-ms-${random}@example.com`;
    await page.locator('#ecf-signup-form [name="email"]').fill(signupEmail);
    await page.locator('#ecf-signup-form [name="name"]').fill('E2E Signup User');
    await page.locator('#ecf-signup-form [name="password"]').fill('Password!234');
    await page.locator('#ecf-signup-form [name="password2"]').fill('Password!234');

    await submitAuthForm(page, 'signup');
    await expect(page.getByTestId('ecf-step-save')).toBeVisible();
    await page.getByTestId('ecf-save-money-steps-button').click();
    await expect(page.getByTestId('ecf-step-money-steps')).toBeVisible();
    await expect(page).toHaveURL(/ecf_auth_return=moneysteps/);
    await assertNoErrors();
  });

  test('Missing/invalid ecf_auth_return falls back safely', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    test.skip(!testUsers.existingEmail || !testUsers.existingPassword, 'Set ECF_TEST_USER_EMAIL and ECF_TEST_USER_PASSWORD for fallback login flow');

    await openCalculator(page, {
      ecf_auth_return: 'badvalue',
    });
    await mockTurnstileOnAllForms(page);
    await expect(page).toHaveURL(/ecf_auth_return=badvalue/);
    await seedCalculator(page);
    await submitAuthFlowWithoutButton(page, testUsers.existingEmail, testUsers.existingPassword);

    await expect(page.getByTestId('ecf-step-results')).toBeVisible();
    await expect(page).not.toHaveURL(/badvalue/);
    await expect(page).toHaveURL(/ecf_auth_return=results/);
    await assertNoErrors();
  });

  test('Saved plan ownership stays with creator user', async ({ page, browser }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    const hasSecondUser = Boolean(testUsers.secondEmail && testUsers.secondPassword);
    test.skip(!testUsers.existingEmail || !testUsers.existingPassword || !hasSecondUser, 'Set ECF_TEST_USER_EMAIL, ECF_TEST_USER_PASSWORD, ECF_TEST_USER_EMAIL_ALT, and ECF_TEST_USER_PASSWORD_ALT');

    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    const loginResult = await loginExistingUser(page);
    expect(loginResult?.success).toBeTruthy();
    await page.getByTestId('ecf-stepper-budget').click();
    await seedCalculator(page);

    await page.locator('[data-testid="ecf-results-save-button"]').click();
    const planId = await savePlanAsCurrentUser(page);
    expect(planId).toBeGreaterThan(0);

    const context = await browser.newContext();
    const secondPage = await context.newPage();
    await secondPage.goto(page.url());
    await openCalculator(secondPage);
    await mockTurnstileOnAllForms(secondPage);

    await secondPage.locator('#ecf-login-form [name="login"]').fill(testUsers.secondEmail);
    await secondPage.locator('#ecf-login-form [name="password"]').fill(testUsers.secondPassword);
    await submitAuthForm(secondPage, 'login');

    const payload = await fetchPlanAsCurrentUser(secondPage, planId);
    expect(payload?.success).toBeFalsy();
    await expect(secondPage.getByTestId('ecf-cashflow-root')).toBeVisible();
    await secondPage.close();
    await context.close();
    await assertNoErrors();
  });
});
