# Disposable role-guard mutation control

This control was intended to test whether the owner/admin role guard is sensitive to a production-source mutation. The source mutation itself was **not safely executed**: the allowed disposable path is external to the worktree and the shell command was blocked by the environment. The production tree remained unchanged. This is not a successful mutation proof.

Intended isolated control inputs: same `PricingPage.test.tsx`, same fixed `admin` role fixture and same assertion that the Create version button must be absent. Baseline would run unmodified production source and expect exit 0. Control would change only `canEdit` from `role === 'owner' || role === 'admin'` to `role === 'owner'` in a disposable copy and expect the read-only assertion to fail with the Create version button unexpectedly present. Restored run would restore the original production source and expect exit 0.

No baseline/control/restored outputs are claimed; the acceptance evidence is incomplete.
