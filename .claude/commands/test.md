---
name: test
description: Run all tests, then spawn parallel agents to fix any failures
---

# Run Project Tests

## Step 1: Run All Tests

Run both test suites and capture output:

```bash
# Frontend tests (Vitest)
npm test -- --run 2>&1

# Backend tests (Rust)
cargo test --manifest-path src-tauri/Cargo.toml 2>&1
```

## Step 2: Analyze Results

Parse the output from both test suites. Group failures by domain:
- **Frontend failures**: Vitest test failures
- **Backend failures**: Rust test failures

If all tests pass, report success and stop.

## Step 3: Spawn Parallel Agents to Fix Failures

For each domain with failures, spawn an agent in parallel using the Task tool in a SINGLE response with MULTIPLE Task tool calls:

- Spawn a "frontend-test-fixer" agent for Vitest failures
- Spawn a "backend-test-fixer" agent for Rust test failures

Each agent should:
1. Receive the list of failing tests and error messages
2. Read the relevant test and source files
3. Fix the issues (in source code or tests as appropriate)
4. Re-run the tests to verify fixes
5. Report completion

## Step 4: Verify All Fixes

After all agents complete, run the full test suite again:

```bash
npm test -- --run 2>&1
cargo test --manifest-path src-tauri/Cargo.toml 2>&1
```

Ensure all tests pass. If any remain, fix them directly.
