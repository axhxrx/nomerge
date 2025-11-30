🚨 WARNING: ALL-LLM CODE: As of 2025-11-09 this entire repo has been coded by Claude Code with zero human code review and only giving instructions via the browser on my phone. It's an experiment to test Claude Code, including all the README below this line. This paragraph is the only thing written by or reviewed by a human in the entire project.

---

# NoMerge GitHub Action

Prevent PR merges when forbidden text patterns are found in files or PR descriptions.

Can be used as:
- **GitHub Action** - Automatically check PRs
- **CLI Tool** - Run locally or in build scripts

## Overview

This action helps prevent accidental merges of work-in-progress or incomplete pull requests by checking for forbidden text patterns in:

1. **Any file in the PR** - Useful for developers to mark incomplete code sections
2. **PR description** - Useful for marking the entire PR as work-in-progress

By default, it searches for "nomerge" (case-insensitive), but patterns are fully configurable.

## Features

- ✅ Configurable patterns via `.nomerge.config.json` or CLI args
- ✅ Supports multiple patterns (string or array)
- ✅ Ignore patterns with glob support (`*`, `**`, `?`)
- ✅ Case-sensitive option available
- ✅ Scans all files changed in the PR (or local directory)
- ✅ Checks PR description/body
- ✅ Built with TypeScript and Deno
- ✅ Clear, actionable error messages
- ✅ Fast and lightweight
- ✅ Can run directly from JSR.io (no installation needed)

## Usage

### As a CLI Tool

Run directly from JSR (once published):

```bash
# Check for default "nomerge" pattern in current directory
deno run --allow-read https://jsr.io/@axhxrx/nomerge/0.0.1/main.ts

# Check for custom patterns
deno run --allow-read https://jsr.io/@axhxrx/nomerge/0.0.1/main.ts \
  --nomerge FIXME \
  --nomerge TODO

# Ignore specific files
deno run --allow-read https://jsr.io/@axhxrx/nomerge/0.0.1/main.ts \
  --ignore "**/*.html" \
  --ignore "test/**"

# Case-sensitive search
deno run --allow-read https://jsr.io/@axhxrx/nomerge/0.0.1/main.ts \
  --nomerge FIXME \
  --case-sensitive

# Scan a specific directory
deno run --allow-read https://jsr.io/@axhxrx/nomerge/0.0.1/main.ts \
  --directory ./src

# Show help
deno run https://jsr.io/@axhxrx/nomerge/0.0.1/main.ts --help
```

### As a GitHub Action

Add this action to your workflow file (e.g., `.github/workflows/nomerge-check.yml`):

```yaml
name: NoMerge Check

on:
  pull_request:
    types: [opened, synchronize, edited]

jobs:
  nomerge-check:
    runs-on: ubuntu-latest
    name: Check for NoMerge markers
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for comparing branches

      - name: Run NoMerge Check
        uses: axhxrx/nomerge@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Note:** Replace `@main` with a specific version tag (e.g., `@v1.0.0`) for production use to ensure stability.

## Configuration

You can customize the forbidden patterns by creating a `.nomerge.config.json` file in your repository root.

### Default Behavior

Without a config file, the action searches for "nomerge" (case-insensitive).

### Custom Configuration

Create `.nomerge.config.json` with the following options:

```json
{
  "nomerge": "DONOTMERGE",
  "caseSensitive": false
}
```

**Options:**

- `nomerge` (string | string[]): Pattern(s) to search for. Can be a single string or an array of strings. Default: `"nomerge"`
- `caseSensitive` (boolean, optional): Whether to perform case-sensitive matching. Default: `false`
- `ignore` (string[], optional): Array of glob patterns for files to ignore. Supports `*`, `**`, and `?` wildcards

### Configuration Examples

**Single custom pattern:**
```json
{
  "nomerge": "DONOTMERGE"
}
```

**Multiple patterns:**
```json
{
  "nomerge": ["TODO", "FIXME", "WIP"]
}
```

**Case-sensitive matching:**
```json
{
  "nomerge": "NoMerge",
  "caseSensitive": true
}
```

**With ignore patterns:**
```json
{
  "nomerge": ["TODO", "FIXME"],
  "ignore": [
    "*.md",
    "docs/**",
    "**/*.test.ts"
  ]
}
```

### Notes

- The `.nomerge.config.json` file itself is automatically skipped during checks to avoid recursion
- Patterns are treated as literal strings (not regular expressions)
- Changes to the config file take effect immediately on the next PR check

## How It Works

1. The action triggers on pull request events (opened, synchronize, edited)
2. It loads configuration from `.nomerge.config.json` (or uses defaults)
3. It fetches the PR details using the GitHub API
4. It checks the PR description for forbidden patterns
5. It scans all changed files in the PR for forbidden patterns
6. If found anywhere, the check fails and blocks the merge
7. If not found, the check passes and the PR can be merged

## Development

Built with:
- **Deno**: Modern, secure runtime for JavaScript and TypeScript
- **TypeScript**: Type-safe code
- **GitHub Actions**: Native integration with GitHub

### Local Testing

```bash
# Run tests
deno test --allow-read

# Check TypeScript syntax
deno check main.ts

# Run CLI mode locally
deno run --allow-read main.ts

# Run as GitHub Action (requires GITHUB_TOKEN and event file)
export GITHUB_TOKEN=your_token
export GITHUB_EVENT_PATH=path/to/event.json
export GITHUB_REPOSITORY=owner/repo
export GITHUB_ACTIONS=true
deno run --allow-env --allow-net --allow-read main.ts
```

## Requirements

- GitHub repository with Actions enabled
- **Branch protection rules** - **REQUIRED** to actually block merges

## ⚠️ Important: Enable Branch Protection

The NoMerge action detects forbidden patterns and fails the workflow check, but **GitHub allows merges even with failed checks unless branch protection is enabled**.

**To actually block PRs from merging**, you must enable branch protection on your target branch (e.g., `main`).

### Quick Setup

See **[unused/BRANCH_PROTECTION.md](unused/BRANCH_PROTECTION.md)** for detailed instructions.

**Quick command (using GitHub API):**
```bash
curl -X PUT \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/branches/main/protection \
  -d '{"required_status_checks":{"strict":true,"contexts":["Check for NoMerge markers"]},"enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null}'
```

**Or via GitHub Web UI:**
1. Go to: `Settings` → `Branches` → `Add rule`
2. Branch name pattern: `main`
3. Enable: ✅ **Require status checks to pass before merging**
4. Select: ✅ **Check for NoMerge markers**

See [unused/BRANCH_PROTECTION.md](unused/BRANCH_PROTECTION.md) for complete instructions.

## License

MIT

## Contributing

Contributions welcome! Please see [unused/PLAN.md](unused/PLAN.md) for the development roadmap.
