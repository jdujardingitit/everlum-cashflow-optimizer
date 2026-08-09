import { test, expect } from '@playwright/test';
import {
  addDebt,
  attachGuards,
  fillSummaryBudget,
  openCalculator,
  mockTurnstileOnAllForms,
} from './utils';

test.describe('Credit/LOC velocity behavior', () => {
  test('Credit card velocity shows estimated generic timing disclaimer and default APR note', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    await openCalculator(page);
    await mockTurnstileOnAllForms(page);

    await page.getByTestId('ecf-cta-start').click();
    await fillSummaryBudget(page, {
      income: 2800,
      expenses: 1500,
      savings: 300,
    });

    await page.getByTestId('ecf-step-budget-next').click();
    await addDebt(page, {
      name: 'Visa',
      type: 'Credit Card',
      balance: 6000,
      apr: 0,
      minimumPayment: 120,
      creditLimit: 10000,
    });

    await page.getByTestId('ecf-step-debts-next').click();
    await page.locator('input[name="velocitySummaryCheckingHoldback"]').fill('900');
    await page.locator('input[name="velocityCardName"]').fill('Primary Card');
    await page.locator('input[name="velocityTargetDebt"]').fill('Visa');
    await page.locator('input[name="velocityCardBalance"]').fill('3000');
    await page.locator('input[name="velocityCardLimit"]').fill('10000');
    await page.locator('select[name="velocityCreditToolType"]').selectOption('none');

    await page.getByTestId('ecf-calc-button').click();

    await expect(page.getByTestId('ecf-results')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Recommended strategy:/ })).toBeVisible();
    await expect(page.getByText('Estimated Credit Card Velocity Result')).toBeVisible();
    await expect(page.getByText(/Velocity Banking results are estimated using generic timing/)).toBeVisible();
    await expect(page.getByText('29% is an average estimate. Please enter your actual credit card APR for more accurate results.')).toBeVisible();
    await assertNoErrors();
  });

  test('Custom timing fields can be used and the partial-date disclaimer applies', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    await openCalculator(page);
    await mockTurnstileOnAllForms(page);

    await page.getByTestId('ecf-cta-start').click();
    await fillSummaryBudget(page, {
      income: 2800,
      expenses: 1500,
      savings: 300,
    });
    await page.getByTestId('ecf-step-budget-next').click();
    await addDebt(page, {
      name: 'Visa',
      type: 'Credit Card',
      balance: 6000,
      apr: 22,
      minimumPayment: 120,
    });

    await page.getByTestId('ecf-step-debts-next').click();
    await page.locator('input[name="velocitySummaryCheckingHoldback"]').fill('900');
    await page.getByRole('radio', { name: 'Custom timing' }).check();
    await page.locator('input[name="velocityPaycheckDates"]').fill('2026-08-10,2026-08-24');
    await page.locator('input[name="velocityStatementDate"]').fill('2026-09-01');
    await page.locator('input[name="velocityCardDueDate"]').fill('2026-09-18');
    await page.locator('input[name="velocityInterestChargeDate"]').fill('2026-09-22');
    await page.locator('input[name="velocityCardName"]').fill('Primary Card');
    await page.locator('input[name="velocityCardBalance"]').fill('3000');
    await page.locator('input[name="velocityCardLimit"]').fill('10000');
    await page.locator('input[name="velocityCardApr"]').fill('22');
    await page.locator('input[name="velocityTargetDebt"]').fill('Visa');

    await page.getByTestId('ecf-calc-button').click();

    await expect(page.getByText('Custom Timing Velocity Estimate')).toBeVisible();
    await expect(page.getByTestId('ecf-result-table').getByText(/full date-by-date simulation is still pending/i)).toBeVisible();
    await assertNoErrors();
  });

  test('LOC velocity shows N/A when no LOC inputs and estimate when LOC inputs are present', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    await openCalculator(page);
    await mockTurnstileOnAllForms(page);

    await page.getByTestId('ecf-cta-start').click();
    await fillSummaryBudget(page, {
      income: 4000,
      expenses: 2000,
      savings: 400,
    });
    await page.getByTestId('ecf-step-budget-next').click();
    await addDebt(page, {
      name: 'Credit Card',
      type: 'Credit Card',
      balance: 8000,
      apr: 22,
      minimumPayment: 220,
    });

    await page.getByTestId('ecf-step-debts-next').click();
    await page.locator('select[name="velocityCreditToolType"]').selectOption('none');
    await page.getByTestId('ecf-calc-button').click();
    await expect(page.getByText('LOC Velocity: N/A')).toBeVisible();

    await openCalculator(page);
    await page.getByTestId('ecf-cta-start').click();
    await fillSummaryBudget(page, {
      income: 4000,
      expenses: 2000,
      savings: 400,
    });
    await page.getByTestId('ecf-step-budget-next').click();
    await addDebt(page, {
      name: 'Credit Card',
      type: 'Credit Card',
      balance: 8000,
      apr: 22,
      minimumPayment: 220,
    });
    await page.getByTestId('ecf-step-debts-next').click();
    await page.locator('select[name="velocityCreditToolType"]').selectOption('heloc');
    await page.locator('input[name="velocityCreditToolBalance"]').fill('4000');
    await page.locator('input[name="velocityCreditToolLimit"]').fill('15000');
    await page.locator('input[name="velocityCreditToolApr"]').fill('11');
    await page.locator('input[name="velocityCreditToolMinimumPayment"]').fill('150');
    await page.locator('input[name="velocityTargetDebt"]').fill('Credit Card');

    await page.getByTestId('ecf-calc-button').click();
    await expect(page.getByText('Advanced LOC Velocity Estimate', { exact: true })).toBeVisible();
    await assertNoErrors();
  });

  test('Turnstile targets exist for auth/public forms', async ({ page }, testInfo) => {
    const assertNoErrors = attachGuards(page, testInfo);
    await openCalculator(page);
    await assertNoErrors();

    const turnstileTargets = [
      'signup',
      'login',
      'forgot',
      'prereg',
    ];

    for (const target of turnstileTargets) {
      await expect(page.locator(`[data-turnstile-target="${target}"]`)).toHaveCount(1);
    }
  });
});
