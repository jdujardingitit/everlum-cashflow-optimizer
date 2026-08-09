# Milestone 2 Deterministic Calculation Fixtures

Status: **Milestone 2 calculation logic corrected by static review. Runtime QA and Velocity timing validation pending.**

## Assumptions used by the current engine

- Interest uses monthly compounding: `APR / 12 / 100`.
- No Velocity “10% boost” or artificial multiplier exists.
- Extra flow is zero for Minimum Payments Only.
- Velocity status is `ok` only when required inputs exist; missing timing/depth marks `missing` or partial.
- Infinite Banking remains placeholder in this phase and should not be treated as a completed compare strategy unless clearly enabled with a full engine.

## Deterministic fixture matrix

1. Summary Budget formula
- **Inputs**: Summary Income `5000`, Summary Expenses `1600`, Normal Savings `300`, Debts: one debt `1000` balance with minimum `100`
- **Expected**: `Available Cash Flow = 5000 - 1600 - 300 = 3100`
- **Actual**: `availableCashFlow` uses the same subtraction (`income - expenses - savings`).
- **Pass/Fail**: Pass
- **Notes**: No savings double-count in summary mode.

2. Itemized Budget no savings double-count
- **Inputs**: Income rows `3000`, `2000`; expenses `Rent 1000`, `Utilities 200`, `Internet 100`; normal savings row `300`
- **Expected**:
  - Total income `5000`
  - Non-savings expenses `1300`
  - Normal savings `300`
  - Available cash flow `5000 - 1300 - 300 = 3400`
- **Actual**: Itemized path excludes rows named `normal savings` from expenses; savings are summed separately and subtracted once.
- **Pass/Fail**: Pass
- **Notes**: Corrected from earlier inflated path.

3. Big Purchase partial rollover (partial usage)
- **Inputs**: Baseline available `1800`, big goal remaining `150`, monthly scheduled `200`, one debt balance `2000` minimum `100`
- **Expected**:
  - `paidToBig = 150`
- **Expected debt cash effect**: `1800 - 150 = 1650` (unused rollover `50` available to debt/extra this month)
- **Actual**: `paidToBig = min(monthlyCash, bigMonthly, bigRemaining)` then `monthlyCash -= paidToBig`.
- **Pass/Fail**: Pass

4. Big Purchase full-month completion
- **Inputs**: Baseline available `1800`, big goal remaining `200`, monthly scheduled `200`, same debt example
- **Expected**:
  - Month 1 `paidToBig = 200`, unused rollover `0`, debt cash baseline `1600`
  - Month 2 onward full `200` returns to debt cash after goal complete
- **Actual**: `bigRemaining` reaches zero on full contribution; subsequent months do not reserve contribution for goal.
- **Pass/Fail**: Pass

5. Unexpected funds to target debt
- **Inputs**: Debt A `600` (min 50), Debt B `300` (min 30), unexpected month 1 = `120`, mode = Avalanche, debt A target
- **Expected**: Unexpected amount applies to active target before generic extra allocation.
- **Actual**: `unexpected` is applied to `debtsByOrder[0]` before extra sweep.
- **Pass/Fail**: Pass

6. Minimum Payments Only baseline
- **Inputs**: One debt `900` minimum `100`, safe cash `500`, no big purchase/unexpected
- **Expected**: Extra after minimums is zero; no additional payoff beyond minimum flow.
- **Actual**: `mode === 'minimum'` disables extra repayment block and uses only minimum payment sequence.
- **Pass/Fail**: Pass

7. Avalanche order
- **Inputs**: Debt A `1200` APR `30` min `100`; Debt B `800` APR `5` min `700`; available cash `1000`
- **Expected**: Order by APR (high to low): A first then B.
- **Actual**: `getDebtOrder('avalanche')` sorts by APR desc.
- **Pass/Fail**: Pass

8. Snowball order
- **Inputs**: Same as fixture 7
- **Expected**: Order by smallest balance first: B first then A.
- **Actual**: `getDebtOrder('snowball')` sorts by balance asc.
- **Pass/Fail**: Pass

9. Custom strategy
- **Inputs**: Same debts as fixture 7; custom order text `B, A`
- **Expected**: B then A
- **Actual**: `getDebtOrder('custom')` resolves listed names first, appends missing entries.
- **Pass/Fail**: Pass

10. Credit Card Eligible = No
- **Inputs**: Expense row marked eligible “No”, no other eligible expenses
- **Expected**: Card method cannot be used for this expense and it increases required checking holdback.
- **Actual**: UI forces cash method when not eligible; ready checks fail if no eligible item and summary context has no card-eligible split.
- **Pass/Fail**: Pass

11. Credit Card Eligible = Yes, payment method = Cash/Checking
- **Inputs**: Expense eligible “Yes”, payment method set to Cash/Checking
- **Expected**: Expense remains checking-only; card flow unchanged for this item.
- **Actual**: `isCheckedCardEligible` requires both eligibility and method `card`.
- **Pass/Fail**: Pass

12. Credit Card Eligible = Yes, payment method = Credit Card
- **Inputs**: Eligible expense `Yes`, method `Credit Card`
- **Expected**: Expense contributes to card charge bucket.
- **Actual**: Included in `ccMonthlyCharge` and `calculateMonthCardCharges`.
- **Pass/Fail**: Pass

13. Required checking holdback behavior
- **Inputs**: Holdback set to `1000` and total fixed checking-safe expenses `1400`
- **Expected**: `safeCash` is reduced by holdback; check that 400 remains for minimums/extra/debt work.
- **Actual**: `safeCash = monthlyCash - requiredCheckingHoldback`.
- **Pass/Fail**: Pass

14. Generic timing
- **Inputs**: Velocity timing mode `generic`, any valid debt and credit inputs, no exact custom dates
- **Expected**: Strategy runs, result marked estimated, disclaimer shown.
- **Actual**: Timing note includes generic disclaimer; `timingEstimated` true.
- **Pass/Fail**: Pass

15. Custom timing
- **Inputs**: Custom timing mode with explicit paycheck, expense, statement, due, and interest dates
- **Expected**: Current build collects dates; results still partially estimated; note should explain partial implementation.
- **Actual**: `velocityCustomTimingNotice` is appended when `isCustomVelocity && isVelocityCard`.
- **Pass/Fail**: Pass (static)

16. Custom timing exact-date regression example
- **Inputs**:
  - Paycheck dates: `2026-09-05, 2026-09-20`
  - Expense (card) due date: `2026-09-15`
  - Statement close: `2026-09-30`
  - Due date: `2026-10-20`
  - Interest charge timing: `2026-10-21`
  - Card balance: `500`, card APR `18`, target debt existing
- **Expected**:
  - Dates are captured.
  - Card payment logic remains date-aware in partial manner (monthly + cutoff gate).
  - Expected card-paid-before-due flag uses this date context.
- **Actual**: Date strings are parsed and converted; partial date-by-date sequencing is still approximated.
- **Pass/Fail**: Pass (static + partial)

17. Missing APR
- **Inputs**: Credit card APR field blank
- **Expected**: default `29`, disclaimer shown.
- **Actual**: fallback APR `29`, `29% ... disclaimer` appended when card interest is calculated.
- **Pass/Fail**: Pass

18. Card paid before due
- **Inputs**: Card balance fully covered by available extra before cutoff date (or by paycheck before cutoff in custom mode)
- **Expected**: No card interest added.
- **Actual**: `shouldPayCardBeforeDue` and post-payment gate prevent charge when paid in full before cutoff.
- **Pass/Fail**: Pass

19. Card not paid before due
- **Inputs**: Card balance not fully paid by monthly extra flow and cutoff not achieved
- **Expected**: Remaining card balance accrues interest.
- **Actual**: `velocityCardInterest` added for unpaid card balance.
- **Pass/Fail**: Pass

20. LOC not entered
- **Inputs**: Credit-tool fields left empty
- **Expected**: LOC velocity does not run; Credit Card Velocity can still run if card inputs exist.
- **Actual**: `velocityReadiness('loc')` returns missing; LOC strategy skipped.
- **Pass/Fail**: Pass

21. LOC entered
- **Inputs**: LOC type `heloc` + required tool fields + optional due date + no custom timing blockers
- **Expected**: LOC Velocity strategy appears and uses tool payment/interest path.
- **Actual**: `statusLoc.ready` true enables LOC strategy.
- **Pass/Fail**: Pass

22. Recommendation logic
- **Inputs**: Multiple complete strategies (Minimum, Avalanche, Snowball, custom) and missing/na entries filtered.
- **Expected**: Engine recommends fastest complete strategy, then lowest total interest.
- **Actual**: comparable set filters `status === 'ok'`, sorts by `months`, then `totalInterest`.
- **Pass/Fail**: Pass

23. Consumer debt / card / LOC clear-state checks
- **Inputs**: Scenarios for `debt>0, card>0, loc=0`; `debt=0, card>0`; `debt=0, loc>0`; all zero
- **Expected**:
  - No “Debt-free” until all balances are zero.
  - Card/LOC residuals produce explicit not-free message.
- **Actual**: Velocity strategy notes branch by balances.
- **Pass/Fail**: Pass

## Runtime requirement

Deterministic static matrix is documented for code-path verification. Runtime sandbox/staging QA remains required for:
- form behavior,
- auth redirect path,
- turnstile attachment,
- duplicate plan ownership checks.
