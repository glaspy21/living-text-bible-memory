---
description: Finish a feature - verify, update PROGRESS.md, commit, push branch
---
1. Run lint, typecheck and tests; fix failures.
2. If UI changed, take desktop and mobile screenshots and compare with docs/reference/prototype-* .
3. Append a dated entry to PROGRESS.md (what changed, decisions, open items); update docs affected by the change.
4. Commit with a `feat|fix|docs|test|chore:` message and push the current branch (never force-push, never deploy).
5. Report the commit hash and what the owner should review.
