# NoMerge GitHub Action - Implementation Plan

## Project Overview
Build a GitHub Actions action using TypeScript and Deno that prevents PR merges when the text "nomerge" (case-insensitive) is found in:
1. Any file in the PR branch
2. The PR description on GitHub

## Technology Stack
- **Runtime**: Deno (TypeScript natively supported)
- **Platform**: GitHub Actions
- **API**: GitHub REST API (via Octokit or native fetch)

## Project Structure
```
/
├── .github/
│   └── workflows/
│       └── nomerge-check.yml    # Workflow that runs our action
├── src/
│   └── main.ts                  # Main action logic
├── action.yml                   # Action metadata/configuration
├── README.md                    # Documentation
├── PLAN.md                      # This file
└── .gitignore
```

## Implementation Phases

### Phase 1: Basic Action Setup ✓
**Goal**: Create a minimal working GitHub Action with Deno

**Tasks**:
1. Create `action.yml` with basic metadata
   - Define action name, description, author
   - Specify it runs using composite steps (to use Deno)
   - Accept inputs (GITHUB_TOKEN)
   - Define outputs (if needed)

2. Create `src/main.ts` with minimal logic
   - Log "NoMerge action running..."
   - Log environment info (Deno version, OS, etc.)
   - Exit with success code

3. Create `.gitignore` for Deno cache and other artifacts

**Success Criteria**:
- Action file is valid YAML
- TypeScript file has no syntax errors
- Can run locally with `deno run src/main.ts`

### Phase 2: Workflow Integration & Testing
**Goal**: Run the action in a GitHub Actions workflow

**Tasks**:
1. Create `.github/workflows/nomerge-check.yml`
   - Trigger on: pull_request (opened, synchronize, edited)
   - Checkout code
   - Setup Deno
   - Run our action
   - Use GITHUB_TOKEN for API access

2. Create test branch and PR
   - Push changes to feature branch
   - Create PR to test workflow
   - Verify action runs and logs appear

3. Test merge flow
   - Verify PR can be merged when action passes
   - Confirm workflow appears in PR checks

**Success Criteria**:
- Workflow triggers on PR creation
- Action logs appear in workflow run
- Basic action completes successfully

### Phase 3: GitHub API Integration
**Goal**: Access PR information via GitHub API

**Tasks**:
1. Parse GitHub context from environment
   - Read GITHUB_EVENT_PATH
   - Extract PR number, repo owner, repo name
   - Get commit SHA

2. Fetch PR details via API
   - Use GitHub REST API
   - Get PR description/body
   - Get list of changed files
   - Handle pagination for large PRs

3. Implement API client
   - Use Deno's native fetch or Octokit for Deno
   - Handle authentication with GITHUB_TOKEN
   - Error handling and retries

**Success Criteria**:
- Can read PR number from context
- Successfully fetch PR data via API
- Can list all files changed in PR

### Phase 4: NoMerge Detection Logic
**Goal**: Implement the core functionality

**Tasks**:
1. Check PR description
   - Search for "nomerge" (case-insensitive)
   - Log if found with clear message

2. Check changed files
   - For each file in the PR:
     - Fetch file content from GitHub API (or read locally)
     - Search for "nomerge" (case-insensitive)
     - Track which files contain the text
   - Handle binary files gracefully
   - Handle deleted files

3. Action outcomes
   - If "nomerge" found anywhere:
     - Log detailed message (where found)
     - Exit with error code (1)
   - If not found:
     - Log success message
     - Exit with success code (0)

4. Detailed reporting
   - Create action summary with results
   - List files containing "nomerge"
   - Show PR description excerpt if matched

**Success Criteria**:
- Correctly identifies "nomerge" in PR description
- Correctly identifies "nomerge" in file contents
- Case-insensitive matching works
- Clear error messages indicate where "nomerge" was found

### Phase 5: Testing & Refinement
**Goal**: Validate the action with real-world scenarios

**Test Cases**:
1. ✅ PR without "nomerge" anywhere → Should pass
2. ❌ PR with "nomerge" in description → Should fail
3. ❌ PR with "NoMerge" in a file (case variation) → Should fail
4. ❌ PR with "NOMERGE" in multiple files → Should fail, list all
5. ✅ PR that removes a file with "nomerge" → Should pass
6. Edge cases:
   - Large PRs (many files)
   - Binary files
   - Empty PR description

**Refinements**:
- Add configuration options (if needed)
- Optimize performance for large PRs
- Improve error messages
- Add comprehensive README

**Success Criteria**:
- All test cases pass
- Action reliably blocks merges when "nomerge" present
- Action doesn't create false positives
- Performance is acceptable (< 1 minute for typical PRs)

## Phase 6: Documentation & Polish
**Goal**: Professional, production-ready action

**Tasks**:
1. Write comprehensive README.md
   - Installation/usage instructions
   - Configuration options
   - Examples
   - Troubleshooting

2. Add code comments and documentation
   - JSDoc comments for functions
   - Inline comments for complex logic

3. Optional enhancements:
   - Support for custom keywords beyond "nomerge"
   - Whitelist certain files/paths
   - Configurable case sensitivity

**Success Criteria**:
- Clear documentation for users
- Code is maintainable
- Ready for public use

## Technical Details

### Deno Permissions Needed
```bash
deno run \
  --allow-env \      # Read environment variables
  --allow-net \      # GitHub API calls
  --allow-read \     # Read local files and event data
  src/main.ts
```

### GitHub Context Available
- `GITHUB_TOKEN`: Authentication token (from secrets)
- `GITHUB_EVENT_PATH`: Path to webhook event payload
- `GITHUB_REPOSITORY`: owner/repo
- `GITHUB_SHA`: Commit SHA
- Event payload contains: PR number, head/base refs, etc.

### GitHub API Endpoints Needed
- `GET /repos/{owner}/{repo}/pulls/{pull_number}` - Get PR details
- `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` - Get changed files
- `GET /repos/{owner}/{repo}/contents/{path}?ref={sha}` - Get file content

### Action Blocking Mechanism
- When action exits with code 1 (failure), the check fails
- Repository can require this check to pass before merging
- Settings → Branches → Branch protection rules → Require status checks

## Development Workflow

1. **Local Development**:
   ```bash
   # Test TypeScript syntax
   deno check src/main.ts

   # Run locally (with mock data)
   deno run --allow-all src/main.ts

   # Format code
   deno fmt src/
   ```

2. **Testing on GitHub**:
   - Push to feature branch
   - Create PR
   - Check Actions tab for results
   - Iterate based on results

3. **Debugging**:
   - Add verbose logging
   - Use `console.log` for debugging
   - Check raw event payload
   - Use GitHub API in browser/curl to verify data

## Potential Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Large PRs with many files | Implement pagination, limit checked files if needed |
| Binary files | Check file type, skip binary files |
| API rate limits | Use GITHUB_TOKEN (higher limits), cache when possible |
| Network failures | Implement retry logic with exponential backoff |
| Deleted files | Check file status, skip deleted files |
| Performance | Parallel file checks, early exit on first match |

## Success Metrics
- ✅ Action runs successfully on every PR
- ✅ Correctly blocks PRs with "nomerge" in description
- ✅ Correctly blocks PRs with "nomerge" in any file
- ✅ Allows clean PRs to merge
- ✅ Clear, actionable error messages
- ✅ Runs in < 30 seconds for typical PRs
- ✅ No false positives or negatives

## Timeline Estimate
- Phase 1: 30 minutes
- Phase 2: 30 minutes
- Phase 3: 1 hour
- Phase 4: 1.5 hours
- Phase 5: 1 hour
- Phase 6: 30 minutes

**Total**: ~5 hours

## Next Steps
1. ✅ Create this plan document
2. → Start Phase 1: Create action.yml and basic main.ts
3. → Commit and push initial setup
4. → Create workflow file
5. → Test basic action
6. → Implement full functionality
7. → Test thoroughly
8. → Document and polish
