# NoMerge GitHub Action

A GitHub Action that prevents PR merges when forbidden text patterns are found in files or PR descriptions.

## Overview

This action helps prevent accidental merges of work-in-progress or incomplete pull requests by checking for forbidden text patterns in:

1. **Any file in the PR** - Useful for developers to mark incomplete code sections
2. **PR description** - Useful for marking the entire PR as work-in-progress

By default, it searches for "nomerge" (case-insensitive), but patterns are fully configurable.

## Features

- ✅ Configurable patterns via `.nomerge.config.json`
- ✅ Supports multiple patterns (string or array)
- ✅ Case-sensitive option available
- ✅ Scans all files changed in the PR
- ✅ Checks PR description/body
- ✅ Built with TypeScript and Deno
- ✅ Clear, actionable error messages
- ✅ Fast and lightweight

## Usage

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
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run NoMerge Check
        uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

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

- `nomerge` (string | string[]): Pattern(s) to search for. Can be a single string or an array of strings.
- `caseSensitive` (boolean, optional): Whether to perform case-sensitive matching. Default: `false`

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
# Check TypeScript syntax
deno check src/main.ts

# Run locally (requires GITHUB_TOKEN env var)
export GITHUB_TOKEN=your_token
deno run --allow-env --allow-net --allow-read src/main.ts
```

## Requirements

- GitHub repository with Actions enabled
- **Branch protection rules** - **REQUIRED** to actually block merges

## ⚠️ Important: Enable Branch Protection

The NoMerge action detects forbidden patterns and fails the workflow check, but **GitHub allows merges even with failed checks unless branch protection is enabled**.

**To actually block PRs from merging**, you must enable branch protection on your target branch (e.g., `main`).

### Quick Setup

See **[BRANCH_PROTECTION.md](BRANCH_PROTECTION.md)** for detailed instructions.

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

See [BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) for complete instructions.

## License

MIT

## Contributing

Contributions welcome! Please see [PLAN.md](PLAN.md) for the development roadmap.
