---
name: publish-change
description: "Commit a logical change, open a pull request, or prepare and execute an authorized release."
disable-model-invocation: true
---

# Publish a change

1. Select `--mode commit`, `--mode pull-request` or `--mode release`, inferring it from the
   user's explicit natural language request when supplied. Record the
   target and authorized external actions. A request for one mode does not authorize the
   others: a commit stops at a commit, a PR stops at the requested PR work, and release
   preparation stops at a verified dry run unless actual publication was requested.
2. Read `references/procedures/publishing-change.md`, including its shared gate and the
   selected mode. Finish concrete preparation before requesting missing authority. Existing
   user authorization remains valid; do not add another confirmation for the same action.
3. Return **COMPLETE / NEEDS WORK / BLOCKED**, the actual commit hash, PR URL or release
   result, and current-tree verification evidence. For preparation-only work, label the
   commands as ready to run and state that publication has not occurred.
