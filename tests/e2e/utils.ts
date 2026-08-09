import { expect, type Page, type TestInfo } from '@playwright/test';

export const CALCULATOR_URL = process.env.ECF_CALC_URL
  || process.env.CALCULATOR_URL
  || process.env.BASE_URL
  || 'http://localhost:8000';

export const CALCULATOR_PATH = process.env.ECF_CALC_PATH || '/';
const turnstileMock = process.env.ECF_E2E_TURNSTILE_MOCK !== '0';
const disableClarity = true;
let buildUrlLogged = false;

export const testUsers = {
  existingEmail: process.env.ECF_TEST_USER_EMAIL || '',
  existingPassword: process.env.ECF_TEST_USER_PASSWORD || '',
  existingDisplayName: process.env.ECF_TEST_USER_NAME || 'Playwright QA',
  signupEmail: process.env.ECF_TEST_SIGNUP_EMAIL || '',
  signupPassword: process.env.ECF_TEST_SIGNUP_PASSWORD || 'E2ePass!234',
  secondEmail: process.env.ECF_TEST_USER_EMAIL_ALT || '',
  secondPassword: process.env.ECF_TEST_USER_PASSWORD_ALT || '',
};

export type AjaxAction = 'everlum_cf_login' | 'everlum_cf_signup' | 'everlum_cf_forgot' | 'everlum_cf_save_plan' | 'everlum_cf_get_plan' | 'everlum_cf_save_prereg';

function extractAjaxAction(postData: string): string {
  const urlEncodedMatch = /(?:^|&)action=([^&]+)/.exec(postData || '');
  if (urlEncodedMatch?.[1]) {
    return decodeURIComponent(urlEncodedMatch[1]);
  }

  const multipartMatch = /name="action"\r?\n\r?\n([^\r\n]+)/.exec(postData || '');
  return multipartMatch?.[1] || '';
}

function getRequestPostData(response: import('@playwright/test').Response): string {
  const request = response.request();
  const postData = request.postData();
  return typeof postData === 'string' ? postData : '';
}

export function isAjaxActionResponse(response: import('@playwright/test').Response, action: AjaxAction): boolean {
  const request = response.request();
  return response.url().includes('admin-ajax.php')
    && request.method() === 'POST'
    && extractAjaxAction(getRequestPostData(response)) === action;
}

export function buildCalculatorUrl(extraParams: Record<string, string> = {}): string {
  const hasCustomPath = CALCULATOR_PATH.trim() !== '/' && Boolean(process.env.ECF_CALC_PATH);
  const normalizedCalcUrl = CALCULATOR_URL.endsWith('/') ? CALCULATOR_URL : `${CALCULATOR_URL}/`;
  const base = hasCustomPath
    ? new URL(CALCULATOR_PATH, normalizedCalcUrl)
    : new URL(normalizedCalcUrl);
  const params = new URLSearchParams(base.search);
  params.set('ecf_e2e', '1');

  if (disableClarity) {
    params.set('disable_clarity', '1');
  }

  if (turnstileMock) {
    params.set('ecf_mock_turnstile', '1');
  }

  Object.entries(extraParams).forEach(([key, value]) => {
    params.set(key, value);
  });

  const next = new URL(base.toString());
  next.search = params.toString();
  const builtUrl = next.toString();
  const expectedPathBase = new URL(normalizedCalcUrl).pathname;
  const resolvedPath = new URL(builtUrl).pathname;
  if (expectedPathBase !== '/' && resolvedPath !== expectedPathBase && process.env.ECF_E2E_DEBUG_URL === '1') {
    throw new Error(`buildCalculatorUrl changed path unexpectedly: expected ${expectedPathBase}, got ${resolvedPath}`);
  }
  if (process.env.ECF_E2E_DEBUG_URL === '1' && !buildUrlLogged) {
    buildUrlLogged = true;
    console.log(`[e2e] buildCalculatorUrl => ${builtUrl}`);
  }
  if (!buildUrlLogged) {
    buildUrlLogged = true;
    console.log(`[e2e] buildCalculatorUrl => ${builtUrl}`);
  }
  return builtUrl;
}

export async function openCalculator(page: Page, extraParams: Record<string, string> = {}): Promise<void> {
  await page.goto(buildCalculatorUrl(extraParams), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ecf-cashflow-root')).toBeVisible();
}

export function attachGuards(page: Page, testInfo: TestInfo): () => Promise<void> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const ajaxFailures: string[] = [];

  const isExpectedConsoleNoise = (message: string) => {
    const noise = [
      'favicon.ico',
      'favicon',
      'net::ERR_NAME_NOT_RESOLVED',
      'net::ERR_INTERNET_DISCONNECTED',
    ];
    return noise.some((entry) => message.includes(entry));
  };

  const isAjaxFailure = (response: import('@playwright/test').Response) => {
    const request = response.request();
    const url = response.url();
    const status = response.status();
    const method = request.method();

    if (!url.includes('admin-ajax.php') || method !== 'POST') {
      return false;
    }

    return status >= 400 && status < 600;
  };

  page.on('console', (message) => {
    if (message.type() === 'error' && !isExpectedConsoleNoise(message.text())) {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('response', (response) => {
    if (isAjaxFailure(response)) {
      const postData = getRequestPostData(response);
      const action = extractAjaxAction(postData);
      ajaxFailures.push(`${response.request().method()} ${response.status()} ${response.url()}${action ? ` (action=${action})` : ''}`);
    }
  });

  return async () => {
    await testInfo.attach('console-errors.log', {
      body: consoleErrors.join('\n'),
      contentType: 'text/plain',
    });
    await testInfo.attach('page-errors.log', {
      body: pageErrors.join('\n'),
      contentType: 'text/plain',
    });
    await testInfo.attach('ajax-errors.log', {
      body: ajaxFailures.join('\n'),
      contentType: 'text/plain',
    });

    if (consoleErrors.length) {
      throw new Error(`Uncaught console errors detected:\n${consoleErrors.join('\n')}`);
    }
    if (pageErrors.length) {
      throw new Error(`Uncaught page errors detected:\n${pageErrors.join('\n')}`);
    }
    if (ajaxFailures.length) {
      throw new Error(`Unexpected admin-ajax failures:\n${ajaxFailures.join('\n')}`);
    }
  };
}

export async function gotoStep(page: Page, stepId: string): Promise<void> {
  await page.locator(`[data-testid="${stepId}"]`).scrollIntoViewIfNeeded();
}

export async function fillSummaryBudget(page: Page, values: { income: number; expenses: number; savings: number; bigPurchase?: { name: string; amount: number; contributionAmount: number; contributionType?: 'fixed' | 'percent'; contributionFrequency?: 'monthly' | 'paycheck'; } }): Promise<void> {
  await page.locator('input[name="summaryIncome"]').fill(String(values.income));
  await page.locator('input[name="summaryExpenses"]').fill(String(values.expenses));
  await page.locator('input[name="summarySavings"]').fill(String(values.savings));

  if (values.bigPurchase) {
    await page.locator('input[name="bigGoalName"]').fill(values.bigPurchase.name);
    await page.locator('input[name="bigGoalAmount"]').fill(String(values.bigPurchase.amount));
    await page.locator('select[name="bigGoalContributionType"]').selectOption(values.bigPurchase.contributionType || 'fixed');
    await page.locator('input[name="bigGoalContributionAmount"]').fill(String(values.bigPurchase.contributionAmount));
    await page.locator('select[name="bigGoalFrequency"]').selectOption(values.bigPurchase.contributionFrequency || 'monthly');
  }
}

export async function addIncomeSource(page: Page, name: string, amount: number, frequency: 'monthly' | 'paycheck' | 'weekly' = 'monthly'): Promise<void> {
  await page.getByRole('button', { name: 'Add source' }).click();
  const row = page.locator('#ecf-income-sources .ecf-repeat-row').last();
  await row.locator('[data-field="name"]').fill(name);
  await row.locator('[data-field="amount"]').fill(String(amount));
  await row.locator('select[data-field="frequency"]').selectOption(frequency);
}

export async function addExpense(page: Page, values: { name: string; amount: number; frequency?: 'monthly' | 'paycheck' | 'weekly'; ccEligible?: 'yes' | 'no'; paymentMethod?: 'cash' | 'card' | 'lineOfCredit' | 'other'; dueDate?: string; }): Promise<void> {
  await page.getByRole('button', { name: 'Add category' }).click();
  const row = page.locator('#ecf-expense-list .ecf-repeat-row').last();
  await row.locator('[data-field="name"]').fill(values.name);
  await row.locator('[data-field="amount"]').fill(String(values.amount));
  await row.locator('select[data-field="frequency"]').selectOption(values.frequency || 'monthly');
  if (values.dueDate) {
    await row.locator('[data-field="dueDate"]').fill(values.dueDate);
  }
  if (values.ccEligible) {
    await row.locator('select[data-field="ccEligible"]').selectOption(values.ccEligible);
  }
  if (values.paymentMethod) {
    await row.locator('select[data-field="paymentMethod"]').selectOption(values.paymentMethod);
  }
}

export async function addDebt(page: Page, values: { name: string; type?: string; balance: number; apr: number; minimumPayment: number; creditLimit?: number; }): Promise<void> {
  await page.getByRole('button', { name: 'Add debt' }).click();
  const row = page.locator('#ecf-debt-list .ecf-repeat-row').last();
  await row.locator('[data-field="name"]').fill(values.name);
  await row.locator('select[data-field="type"]').selectOption(values.type || 'Personal Loan');
  await row.locator('[data-field="balance"]').fill(String(values.balance));
  await row.locator('[data-field="apr"]').fill(String(values.apr));
  await row.locator('[data-field="minimumPayment"]').fill(String(values.minimumPayment));
  if (values.creditLimit !== undefined) {
    await row.locator('[data-field="creditLimit"]').fill(String(values.creditLimit));
  }
}

export async function mockTurnstileOnAllForms(page: Page): Promise<void> {
  const tokenInputs = page.locator('input[name="cf-turnstile-response"]');
  const count = await tokenInputs.count();
  for (let index = 0; index < count; index += 1) {
    await tokenInputs.nth(index).fill('mock-e2e-turnstile-token');
  }
}

export async function openAuthTab(page: Page, target: 'signup' | 'login' | 'forgot'): Promise<void> {
  const map: Record<typeof target, string> = {
    signup: 'ecf-signup-form',
    login: 'ecf-login-form',
    forgot: 'ecf-forgot-form',
  };
  await page.getByTestId(map[target]).scrollIntoViewIfNeeded();
}

export async function expectAuthReturnInUrl(page: Page, expected: 'save' | 'moneysteps' | 'results' | 'calculator' | 'badvalue' | 'missing'): Promise<void> {
  const url = new URL(page.url());
  const value = url.searchParams.get('ecf_auth_return');
  if (expected === 'missing') {
    expect(value).toBeNull();
  } else if (expected === 'badvalue') {
    expect((value || '').toLowerCase()).toContain('badvalue');
  } else {
    expect((value || '').toLowerCase().replace(/[^a-z0-9]/g, '')).toContain(expected);
  }
}
