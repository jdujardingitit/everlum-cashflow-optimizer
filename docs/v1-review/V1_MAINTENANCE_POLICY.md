# WordPress V1 Maintenance Policy

Everlum Cashflow Optimizer WordPress V1 is frozen at `ecf-wordpress-v1.0-review`.

- No new V1 features, architecture changes, calculation expansion, or design expansion.
- All product expansion belongs to a separately authorized V2 effort.
- Only critical security, data-loss, or production-blocking corrections may be considered.
- Every permitted correction must use a dedicated maintenance branch from the frozen tag.
- Every corrected release receives a new patch tag.
- `ecf-wordpress-v1.0-review` never moves, is never recreated, and is never deleted.
- `archive/wordpress-v1-review` remains pointed at the original reviewed commit.
- Every maintenance difference must be documented for future V2 parity.
- Every maintenance release must pass the complete established gate.

Documentation and restore infrastructure may evolve on `docs/wordpress-v1-preservation`, but must not alter the frozen plugin, assets, tests, calculations, wording, or expected outcomes.
