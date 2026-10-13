# Gotchas

- **Test the real precondition, not a convenient one.** A plan-backfill fix passed its test because the test built a fresh plan with the variant already enabled. The real plan predated the variant and lacked the slot array. When a bug report involves an existing plan or actor, build the fixture in its *old* state and run it through the real load path (`_loadOrCreatePlan` / `_migratePlan`), then confirm the test fails without the fix.
