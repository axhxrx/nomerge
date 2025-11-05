# NoMerge GitHub Action

A GitHub Action that prevents PR merges when the text "nomerge" (case-insensitive) is found in files or PR descriptions.

## Overview

This action helps prevent accidental merges of work-in-progress or incomplete pull requests by checking for the presence of "nomerge" text in:

1. **Any file in the PR** - Useful for developers to mark incomplete code sections
2. **PR description** - Useful for marking the entire PR as work-in-progress

## Features

- ✅ Case-insensitive "nomerge" detection
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

## How It Works

1. The action triggers on pull request events (opened, synchronize, edited)
2. It fetches the PR details using the GitHub API
3. It checks the PR description for "nomerge" text
4. It scans all changed files in the PR for "nomerge" text
5. If found anywhere, the check fails and blocks the merge
6. If not found, the check passes and the PR can be merged

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
- Branch protection rules (optional but recommended) to require this check before merging

## License

MIT

## Contributing

Contributions welcome! Please see [PLAN.md](PLAN.md) for the development roadmap.
