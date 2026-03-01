---
name: fix
description: Run typechecking and linting, then spawn parallel agents to fix all issues
---

# Project Code Quality Check

This command runs all linting and typechecking tools for this project, collects errors, groups them by domain, and spawns parallel agents to fix them.

## Step 1: Run Linting and Typechecking

Run these commands and capture output:

```bash
# TypeScript type checking
npx tsc --noEmit 2>&1

# Rust clippy linting
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings 2>&1

# Rust format check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check 2>&1
```

## Step 2: Collect and Parse Errors

Parse the output from each command. Group errors by domain:
- **Type errors**: TypeScript issues from `tsc --noEmit`
- **Clippy errors**: Rust lint issues from `cargo clippy`
- **Format errors**: Rust formatting issues from `cargo fmt --check`

Create a list of all files with issues and the specific problems in each file.

## Step 3: Spawn Parallel Agents

For each domain that has issues, spawn an agent in parallel using the Task tool in a SINGLE response with MULTIPLE Task tool calls:

- Spawn a "type-fixer" agent for TypeScript type errors
- Spawn a "clippy-fixer" agent for Rust clippy warnings/errors
- Spawn a "format-fixer" agent for Rust formatting issues

Each agent should:
1. Receive the list of files and specific errors in their domain
2. Fix all errors in their domain
3. Run the relevant check command to verify fixes
4. Report completion

## Step 4: Verify All Fixes

After all agents complete, run the full check again:

```bash
npx tsc --noEmit 2>&1
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings 2>&1
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check 2>&1
```

Ensure all issues are resolved. If any remain, fix them directly.
