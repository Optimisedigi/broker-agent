---
name: update-app
description: Update dependencies, fix deprecations and warnings
---

# Dependency Update & Deprecation Fix

This project has two dependency systems: npm (frontend) and Cargo (Rust backend).

## Step 1: Check for Updates

```bash
# Frontend
npm outdated

# Backend
cargo outdated --manifest-path src-tauri/Cargo.toml 2>/dev/null || echo "Install cargo-outdated: cargo install cargo-outdated"
```

## Step 2: Update Dependencies

```bash
# Frontend
npm update
npm audit fix

# Backend
cargo update --manifest-path src-tauri/Cargo.toml
```

## Step 3: Check for Deprecations & Warnings

Run installation and check output carefully:

```bash
# Frontend - clean install
rm -rf node_modules package-lock.json
npm install
```

Read ALL output. Look for:
- Deprecation warnings
- Security vulnerabilities
- Peer dependency warnings
- Breaking changes

```bash
# Backend - check for warnings
cargo check --manifest-path src-tauri/Cargo.toml 2>&1
```

## Step 4: Fix Issues

For each warning/deprecation:
1. Research the recommended replacement or fix
2. Update code/dependencies accordingly
3. Re-run installation
4. Verify no warnings remain

## Step 5: Run Quality Checks

```bash
# TypeScript
npx tsc --noEmit

# Rust
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

Fix all errors before completing.

## Step 6: Verify Clean Install

```bash
# Frontend
rm -rf node_modules package-lock.json
npm install

# Backend
cargo check --manifest-path src-tauri/Cargo.toml
```

Verify ZERO warnings/errors and all dependencies resolve correctly.
