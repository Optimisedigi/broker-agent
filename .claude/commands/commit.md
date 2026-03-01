---
name: commit
description: Run checks, commit with AI message, and push
---

1. Run quality checks:
   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml
   npx tsc --noEmit
   ```
   Fix ALL errors before continuing.

2. Review changes: `git status` and `git diff --staged` and `git diff`

3. Generate commit message:
   - Start with verb (Add/Update/Fix/Remove/Refactor)
   - Be specific and concise
   - One line preferred

4. Stage relevant files, commit, and push.
