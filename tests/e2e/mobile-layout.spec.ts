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

test.describe('Mobile UI layout and interaction', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });

  test('Mobile portrait flow remains usable with all key sections', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);

    await openCalculator(page);
    await mockTurnstileOnAllForms(page);
    await expect(page.getByTestId('ecf-cashflow-root')).toBeVisible();
    await expect(page.getByTestId('ecf-stepper-budget')).toBeVisible();

    await page.getByTestId('ecf-cta-start').click();
    await fillSummaryBudget(page, {
      income: 3000,
      expenses: 1200,
      savings: 250,
    });
    await page.getByRole('button', { name: 'Add expected fund' }).click();
    const fundRow = page.locator('#ecf-unexpected-funds .ecf-repeat-row').last();
    await fundRow.locator('[data-field="name"]').fill('Bonus');
    await fundRow.locator('[data-field="amount"]').fill('400');
    await fundRow.locator('[data-field="date"]').fill('2026-09-01');

    await page.getByTestId('ecf-step-budget-next').click();
    await addDebt(page, {
      name: 'Student Loan',
      type: 'Student Loan',
      balance: 4200,
      apr: 7,
      minimumPayment: 160,
    });
    await page.getByTestId('ecf-step-debts-next').click();
    await page.getByTestId('ecf-calc-button').click();

    await expect(page.getByTestId('ecf-results')).toBeVisible();
    await expect(page.getByTestId('ecf-results-save-button')).toBeVisible();
    await expect(page.locator('[data-testid="ecf-result-table"]')).toBeVisible();
    await assertNoErrors();
  });

  test('Mobile landscape keeps interactive controls and book help modal available', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    await page.setViewportSize({ width: 844, height: 390 });

    await openCalculator(page);
    await mockTurnstileOnAllForms(page);

    await page.getByTestId('ecf-cta-start').click();
    await page.locator('button[data-path="itemized"]').click();
    await addIncomeSource(page, 'Main Income', 5000, 'monthly');
    await addIncomeSource(page, 'Side Income', 300, 'monthly');

    await addExpense(page, {
      name: 'Groceries',
      amount: 450,
      ccEligible: 'yes',
      paymentMethod: 'card',
      frequency: 'monthly',
    });

    const helpIcon = page.locator('[data-velocity-help="velocityExpenseEligibility"]');
    await expect(helpIcon).toBeVisible();
    await helpIcon.click();
    await expect(page.locator('#ecf-velocity-help-modal')).toHaveClass(/is-open/);
    await expect(page.locator('#ecf-velocity-help-title')).toBeVisible();
    await page.locator('#ecf-velocity-help-close').click();
    await expect(page.locator('#ecf-velocity-help-modal')).not.toHaveClass(/is-open/);

    await page.getByTestId('ecf-step-budget-next').click();
    await addDebt(page, {
      name: 'Auto',
      type: 'Auto Loan',
      balance: 12000,
      apr: 9,
      minimumPayment: 320,
    });
    await page.getByTestId('ecf-step-debts-next').click();
    await page.getByTestId('ecf-calc-button').click();
    await expect(page.locator('#ecf-velocity-help-modal')).toHaveCount(1);
    await assertNoErrors();
  });
});
