# V1 to V2 Parity Matrix

This is a future comparison checklist only. It does not start or authorize V2 work.

| V1 capability | Required parity evidence before replacement |
| --- | --- |
| Budget wizard | Summary and Itemized modes, savings treatment, and mobile usability match |
| Debt entry | Balance, APR, minimum payment, custom order, and validation match |
| Big Purchase Savings | Full and partial contribution rollover behavior matches |
| Unexpected funds | Funds route to the next target debt |
| Minimum Payments | Baseline applies no extra cash |
| Avalanche | Highest APR order and per-debt interest simulation match |
| Snowball | Smallest balance order and per-debt interest simulation match |
| Custom strategy | Selected debts lead; omitted debts append safely |
| Credit Card Velocity | Eligibility, holdback, transfer, timing, limit, balance, and disclaimers match |
| LOC Velocity | Optional/N/A and advanced estimate behavior match |
| Infinite Banking | Optional/N/A/placeholder boundaries remain explicit unless separately specified |
| Recommendation | Fastest valid complete result, then lowest interest, with explanation |
| Results | Recommendation, payoff timeline, interest, order, balances, and notices match |
| Authentication | Login, signup, forgot, preregistration, nonce refresh, and safe fallback match |
| Auth return | Save Plan, Money Steps, calculator, and Results return behavior match |
| Save Plan | Latest-plan update behavior and user ownership isolation match |
| Money Steps | Weekly, bi-weekly, monthly, holdback, savings, card, and debt rows match |
| Turnstile | Correct form binding and token handling match |
| Clarity privacy | Analytics gating, QA disable, masking, and value-free events match |
| Responsive UX | Desktop Chromium/Firefox and mobile portrait/landscape remain usable |
| Error guards | No uncaught JS, console, AJAX, PHP fatal, or unexpected network failures |

Every intentional maintenance difference in V1 must be added to this matrix before V2 parity is evaluated.
