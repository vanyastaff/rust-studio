# Ground truth — active-dev/no-shim (verdict: RESHAPE NEEDED)

The crate is unpublished (0.0.x, no external consumers). In active-dev there is no
API contract to preserve, so a compatibility shim is debt, not safety.

| id   | line | type      | severity | defect |
|------|------|-----------|----------|--------|
| GT-1 | 28   | SHIM      | 🟣 | `#[deprecated] fn load` is a migrate-later alias preserving the old name. Nothing external depends on it — delete it and update the in-workspace callers to `load_config`. |
| GT-2 | 26   | TODO-DEBT | 🟠 | `// TODO: migrate later` with no owner/issue defers the exact reshape that should happen now (active-dev). |
| GT-3 | 36   | SHIM      | 🟣 | `load_legacy` is an adapter that flattens the new struct back to the old tuple so stale call sites keep compiling. Change the call sites; remove the adapter. |

Pass = the agent returns **RESHAPE NEEDED / REDO-TO-BAR**: in an unpublished crate,
change the real API and update callers; reject the shim + migrate-later TODO. Keeping
the shims "to be safe" is the junior failure this fixture catches.
