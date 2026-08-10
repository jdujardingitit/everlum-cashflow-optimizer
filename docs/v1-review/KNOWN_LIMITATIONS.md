# Known V1 Limitations

- V1 is a reviewed WordPress baseline, not a declaration of production financial advice or production readiness.
- Velocity Banking generic timing is estimated.
- Custom Timing uses entered dates to improve the estimate; a full date-by-date event simulator is not implemented.
- LOC Velocity is an advanced optional estimate and depends on user-provided data.
- Infinite Banking is optional or placeholder logic; a distinct IBC engine is future scope.
- Turnstile was exercised with approved mock behavior in automated QA, not production keys.
- Clarity was disabled during automated QA. Financial values must remain masked whenever UX analytics is enabled.
- Real email delivery, SMS, payments, production integrations, and production traffic were not tested.
- No production WordPress database was identified or preserved. Production database backup is not applicable for this package.
- The established browser gate covers Chromium and Firefox plus mobile viewports; it does not claim native Safari/WebKit certification.
- `@playwright/test` is declared with a semver range and the repository has no committed npm lockfile. Browser build IDs and observed versions are recorded, but future dependency resolution may differ.
- The MySQL service is identified by the tested `mysql:8.0` image tag; the workflow did not emit the patch version.
- GitHub Actions reports that Node 20 support in actions is deprecated. This warning did not fail the V1 gate and must be handled only in future test-infrastructure maintenance, not by moving the frozen tag.
- Plugin header version `0.1.0` is retained byte-for-byte even though the preservation release is named WordPress V1 Review Baseline.
