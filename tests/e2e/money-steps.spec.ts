import { test, expect } from '@playwright/test';
import {
  addDebt,
  addExpense,
  addIncomeSource,
  attachGuards,
  fillSummaryBudget,
  openCalculator,
  mockTurnstileOnAllForms,
  testUsers,
} from './utils';

test.describe('Money Steps generation', () => {
  const hasLoginUser = Boolean(testUsers.existingEmail && testUsers.existingPassword);

  async function loginExistingUser(page: any) {
    const form = page.locator('#ecf-login-form');
    await expect(form).toBeVisible();
    await page.locator('#ecf-login-form [name="login"]').fill(testUsers.existingEmail);
    await page.locator('#ecf-login-form [name="password"]').fill(testUsers.existingPassword);
    await page.locator('[data-testid="ecf-login-submit"]').click();
    await expect(page.getByTestId('ecf-step-save')).toBeVisible({ timeout: 10_000 });
  }

  async function completeCalculatorAsLoggedInUser(page: any) {
    await page.getByTestId('ecf-cta-start').click();
    await fillSummaryBudget(page, {
      income: 4200,
      expenses: 1700,
      savings: 500,
    });

    await addIncomeSource(page, 'Gig Income', 900, 'monthly');

    await addExpense(page, {
      name: 'Rent',
      amount: 900,
      ccEligible: 'no',
      paymentMethod: 'cash',
      frequency: 'monthly',
    });

    await addDebt(page, {
      name: 'Auto Loan',
      type: 'Auto Loan',
      balance: 4200,
      apr: 8,
      minimumPayment: 140,
    });
    await page.getByTestId('ecf-step-budget-next').click();
    await page.getByTestId('ecf-step-debts-next').click();
    await page.getByTestId('ecf-calc-button').click();
    await page.getByTestId('ecf-results-save-button').click();
    await expect(page.getByTestId('ecf-step-money-steps')).toBeVisible();
    await page.getByTestId('ecf-save-money-steps-button').click();
    await expect(page.getByTestId('ecf-step-money-steps')).toBeVisible();
  }

  test('Money Steps shows weekly/biweekly/monthly output with required columns', async ({ page }, testInfo) => {
    test.skip(!hasLoginUser, 'Requires test user credentials via ECF_TEST_USER_EMAIL and ECF_TEST_USER_PASSWORD');

    const assertNoErrors = attachGuards(page, testInfo);
    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await loginExistingUser(page);
    await completeCalculatorAsLoggedInUser(page);

    const tableHeadings = [
      'Period #',
      'Start date',
      'End date',
      'Starting cash',
      'Income',
      'Expenses',
      'Normal savings',
      'Big purchase savings',
      'Minimum payments',
      'Extra debt payment',
      'Credit card charges',
      'Credit card payment',
      'Line of credit payment',
      'Ending cash',
      'Current target debt',
      'Remaining debt',
      'Credit card balance',
      'Credit tool balance',
      'Big purchase balance',
    ];

    for (const heading of tableHeadings) {
      await expect(page.locator('th', { hasText: heading })).toBeVisible();
    }

    await page.locator('#ecf-money-frequency').selectOption('weekly');
    await page.getByTestId('ecf-build-money-steps-btn').click();
    await expect(page.locator('#ecf-money-steps-table tbody tr')).toHaveCount(1);

    await page.locator('#ecf-money-frequency').selectOption('biweekly');
    await page.getByTestId('ecf-build-money-steps-btn').click();
    await expect(page.locator('#ecf-money-steps-table tbody tr')).toHaveCount(1);

    await page.locator('#ecf-money-frequency').selectOption('monthly');
    await page.getByTestId('ecf-build-money-steps-btn').click();
    await expect(page.locator('#ecf-money-steps-table tbody tr')).toHaveCount(1);

    await expect(page.locator('text=Income:')).toBeVisible();
    await expect(page.locator('text=Expenses:')).toBeVisible();
    await expect(page.locator('#ecf-step-money-steps .ecf-money-steps')).toHaveClass(/ecf-sensitive|ecf-money-steps/);
    await assertNoErrors();
  });

  test('Guest Money Steps section is gated behind account creation', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await page.getByTestId('ecf-cta-start').click();
    await fillSummaryBudget(page, {
      income: 2500,
      expenses: 900,
      savings: 200,
    });
    await addDebt(page, {
      name: 'Card',
      type: 'Credit Card',
      balance: 1600,
      apr: 20,
      minimumPayment: 80,
    });
    await page.getByTestId('ecf-step-budget-next').click();
    await page.getByTestId('ecf-step-debts-next').click();
    await page.getByTestId('ecf-calc-button').click();
    await page.getByTestId('ecf-results-save-button').click();
    await page.getByTestId('ecf-save-money-steps-button').click();

    await expect(page.getByText('Create a free account to use Money Steps.')).toBeVisible();
    await assertNoErrors();
  });
});
