# Test Fixtures

This directory contains realistic repository fixtures for stress-testing the CLI mode.

Each fixture simulates a different scenario with its own `.nomerge.config.json` configuration.

## Fixtures

### `clean-repo/`
**Purpose**: Baseline test - repository with no forbidden patterns

**Files**:
- `src/main.js` - Clean production code
- `docs/README.md` - Clean documentation

**Expected Result**: ✅ Pass (no patterns found)

---

### `todo-fixme/`
**Purpose**: Test detection of common development markers

**Forbidden Patterns**: `TODO`, `FIXME`, `WIP`

**Files**:
- `src/auth.js` - Contains TODO and FIXME comments
- `src/api.js` - Contains WIP comment

**Expected Result**: ❌ Fail (multiple patterns detected)

---

### `custom-pattern/`
**Purpose**: Test custom pattern with case-sensitive matching

**Forbidden Pattern**: `DONOTMERGE` (case-sensitive)

**Files**:
- `lib/database.js` - Contains DONOTMERGE comments

**Expected Result**:
- ❌ Fail with `--case-sensitive`
- ✅ Pass without case-sensitivity if pattern is lowercase

---

### `with-ignores/`
**Purpose**: Test ignore patterns functionality

**Forbidden Pattern**: `nomerge`

**Ignore Patterns**: `docs/**`, `**/*.spec.js`, `*.md`

**Files**:
- `src/broken.js` - Contains pattern (NOT ignored - should be detected)
- `docs/README.md` - Contains pattern (ignored)
- `tests/test.spec.js` - Contains pattern (ignored)
- `src/main.js` - Clean file

**Expected Result**: ❌ Fail (only `src/broken.js` detected, others ignored)

---

### `nested-structure/`
**Purpose**: Test glob patterns with nested directories

**Forbidden Pattern**: `nomerge`

**Ignore Pattern**: `build/**`

**Files**:
- `src/utils/helpers/string.js` - Clean file
- `src/components/Button.jsx` - Contains pattern (should be detected)
- `build/output.js` - Contains pattern (should be ignored)

**Expected Result**: ❌ Fail (`src/components/Button.jsx` detected, build ignored)

---

### `case-sensitive/`
**Purpose**: Test case-sensitive vs case-insensitive matching

**Forbidden Pattern**: `nomerge` (case-sensitive)

**Files**:
- `src/config.js` - Contains `NoMerge` and `NOMERGE` (wrong case)
- `src/auth.js` - Contains `nomerge` (exact case match)

**Expected Result**:
- ❌ Fail with `--case-sensitive` (only `src/auth.js` detected)
- ❌ Fail without case-sensitivity (both files detected)

---

### `edge-cases/`
**Purpose**: Test pattern detection in various positions and contexts

**Forbidden Pattern**: `nomerge`

**Files**:
- `src/special.js` - Pattern at end of line, in multiline comments, in strings, at start
- `src/empty.js` - Empty file with just a comment

**Expected Result**: ❌ Fail (multiple occurrences in special.js)

---

### `multiple-patterns/`
**Purpose**: Test multiple forbidden patterns simultaneously

**Forbidden Patterns**: `HACK`, `XXX`, `TEMP`

**Files**:
- `src/incomplete.js` - Contains all three patterns
- `src/clean.js` - Clean code

**Expected Result**: ❌ Fail (all patterns detected in incomplete.js)

---

## Usage

Run integration tests against all fixtures:

```bash
deno test --allow-read --allow-run cli_integration_test.ts
```

Run CLI against a specific fixture:

```bash
deno run --allow-read main.ts --directory fixtures/todo-fixme --nomerge TODO
```

Test with custom patterns:

```bash
deno run --allow-read main.ts --directory fixtures/custom-pattern --nomerge DONOTMERGE --case-sensitive
```

Test ignore patterns:

```bash
deno run --allow-read main.ts --directory fixtures/with-ignores --ignore "docs/**" --ignore "**/*.spec.js"
```

## Adding New Fixtures

To add a new fixture:

1. Create a new directory under `fixtures/`
2. Add realistic source files
3. Create `.nomerge.config.json` if needed
4. Add test cases to `cli_integration_test.ts`
5. Document the fixture in this README
