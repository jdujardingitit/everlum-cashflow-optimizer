import { test, expect } from '@playwright/test';
import {
  addDebt,
  addExpense,
  addIncomeSource,
  attachGuards,
  fillSummaryBudget,
  openCalculator,
  mockTurnstileOnAllForms,
} from './utils';

test.describe('Cashflow optimizer core flow', () => {
  test('Guest calculator flow reaches Results without JS/AJAX failures', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);

    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await expect(page.getByTestId('ecf-stepper-optimizer')).toBeVisible();
    await expect(page.getByTestId('ecf-cta-start')).toBeVisible();

    await page.getByTestId('ecf-cta-start').click();
    await fillSummaryBudget(page, {
      income: 3000,
      expenses: 900,
      savings: 250,
      bigPurchase: {
        name: 'Emergency buffer',
        amount: 1200,
        contributionAmount: 200,
        contributionType: 'fixed',
        contributionFrequency: 'monthly',
      },
    });
    await page.getByTestId('ecf-step-budget-next').click();

    await addDebt(page, {
      name: 'Auto Loan',
      type: 'Auto Loan',
      balance: 3000,
      apr: 8.5,
      minimumPayment: 120,
    });

    await page.getByTestId('ecf-step-debts-next').click();
    await page.getByTestId('ecf-calc-button').click();
    await expect(page.getByTestId('ecf-results')).toBeVisible();

    await expect(page.getByTestId('ecf-result-table')).toBeVisible();
    await expect(page.getByText('Recommended strategy:')).toBeVisible();
    await expect(page.locator('th', { hasText: 'Strategy' })).toBeVisible();
    await assertNoErrors();
  });

  test('Summary budget calculation and unexpected funds are accepted', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);

    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await page.getByTestId('ecf-cta-start').click();

    await fillSummaryBudget(page, {
      income: 5000,
      expenses: 1300,
      savings: 300,
    });

    await page.getByRole('button', { name: 'Add expected fund' }).click();
    const fundRow = page.locator('#ecf-unexpected-funds .ecf-repeat-row').last();
    await fundRow.locator('[data-field="name"]').fill('Tax refund');
    await fundRow.locator('[data-field="amount"]').fill('500');
    await fundRow.locator('[data-field="date"]').fill('2026-12-31');

    await page.getByTestId('ecf-step-budget-next').click();
    await addDebt(page, {
      name: 'Credit Card',
      type: 'Credit Card',
      balance: 4000,
      apr: 18,
      minimumPayment: 160,
      creditLimit: 8000,
    });

    await page.getByTestId('ecf-step-debts-next').click();
    await page.getByTestId('ecf-calc-button').click();

    await expect(page.getByText(/Available cash flow: \$3400\.00/)).toBeVisible();
    await expect(page.getByText(/Income:\s*\$5000\.00/)).toBeVisible();
    await expect(page.locator('#ecf-balance-chart')).toBeVisible();
    await assertNoErrors();
  });

  test('Itemized budget excludes savings from expenses', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);

    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await page.getByTestId('ecf-cta-start').click();
    await page.locator('button[data-path="itemized"]').click();

    await expect(page.locator('.ecf-path-btn[data-path="summary"]')).not.toHaveClass(/is-active/);
    await expect(page.locator('.ecf-path-panel--summary')).not.toHaveClass(/is-active/);
    await expect(page.locator('.ecf-path-panel--itemized')).toHaveClass(/is-active/);

    await addIncomeSource(page, 'Paycheck 1', 3000, 'monthly');
    await addIncomeSource(page, 'Paycheck 2', 2000, 'monthly');

    await addExpense(page, {
      name: 'Rent',
      amount: 1000,
      frequency: 'monthly',
      ccEligible: 'no',
      paymentMethod: 'cash',
    });
    await addExpense(page, {
      name: 'Utilities',
      amount: 200,
      frequency: 'monthly',
      ccEligible: 'no',
      paymentMethod: 'cash',
    });
    await addExpense(page, {
      name: 'Internet',
      amount: 100,
      frequency: 'monthly',
      ccEligible: 'no',
      paymentMethod: 'cash',
    });
    await addExpense(page, {
      name: 'Normal Savings',
      amount: 300,
      frequency: 'monthly',
      ccEligible: 'no',
      paymentMethod: 'cash',
    });

    await page.getByTestId('ecf-step-budget-next').click();
    await addDebt(page, {
      name: 'Student Loan',
      type: 'Student Loan',
      balance: 6000,
      apr: 6.4,
      minimumPayment: 150,
    });

    await page.getByTestId('ecf-step-debts-next').click();
    await page.getByTestId('ecf-calc-button').click();

    await expect(page.getByText(/Available cash flow: \$3400\.00/)).toBeVisible();
    await expect(page.locator('[data-testid="ecf-result-table"]')).toBeVisible();
    await assertNoErrors();
  });
});
