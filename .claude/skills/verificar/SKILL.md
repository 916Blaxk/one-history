---
name: verificar
description: Runs the full One History check (type check, build, unit, API and E2E tests) in the right order without touching the real database. Use after changing code and before saying a change works.
---

First run `npm run lint`. The existing code already has lint errors, so this step never stops the check: report the totals and any findings in files you changed.

Then run these in order and stop at the first failure:

1. `npx tsc --noEmit`
2. `npx next build`. Do not use `npm run build`, which migrates the real database in `dados/`.
3. `npx vitest run`
4. `npx playwright test`

The tests in steps 3 and 4 create their own temporary database. Steps 3 and 4 need ports 3457 and 3458 free, and step 4 needs Edge installed.

If a test fails:
- Read the failure output. For E2E failures, look at the screenshots in `test-results/`.
- Find the cause before changing a test to make it pass.

Report the count of passed and failed tests for each suite, and name any step you skipped.
