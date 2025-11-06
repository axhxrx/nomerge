# Branch Protection Setup

To effectively enforce the NoMerge action and **actually block** PRs from merging when forbidden patterns are detected, you need to enable **branch protection rules** on your target branches (typically `main` or `master`).

## Why Branch Protection is Required

The NoMerge action correctly detects forbidden patterns and fails the workflow check. However, **GitHub allows PRs to be merged even with failed checks unless branch protection is enabled**.

Without branch protection:
- ❌ Action detects forbidden pattern → ✅ Check fails → ⚠️ PR can still be merged

With branch protection:
- ❌ Action detects forbidden pattern → ✅ Check fails → 🚫 PR **cannot** be merged

## Setup Methods

Choose one of the following methods to enable branch protection:

---

### Method 1: Using the GitHub API (Recommended for automation)

You can enable branch protection programmatically using the GitHub API with a Personal Access Token (PAT).

**Prerequisites:**
- GitHub Personal Access Token with `repo` scope
- Repository owner/admin permissions

**Command:**

```bash
curl -X PUT \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/branches/main/protection \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["Check for NoMerge markers"]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": null,
    "restrictions": null,
    "required_linear_history": false,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

**Replace:**
- `YOUR_GITHUB_TOKEN` with your GitHub Personal Access Token
- `OWNER` with your GitHub username or organization name
- `REPO` with your repository name
- `main` with your default branch name if different (e.g., `master`)

**Example:**

```bash
curl -X PUT \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer github_pat_11AAA52ZA0..." \
  https://api.github.com/repos/myorg/myrepo/branches/main/protection \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["Check for NoMerge markers"]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": null,
    "restrictions": null,
    "required_linear_history": false,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

**Success Response:**

You should receive a JSON response with status `200 OK` showing the branch protection configuration.

---

### Method 2: Using the GitHub Web UI (Manual Setup)

If you prefer to configure branch protection manually through the GitHub interface:

1. **Navigate to your repository settings:**
   - Go to your repository on GitHub
   - Click **Settings** (top navigation bar)
   - In the left sidebar, click **Branches** under "Code and automation"

   **Direct URL format:**
   ```
   https://github.com/OWNER/REPO/settings/branches
   ```

2. **Add a branch protection rule:**
   - Click **Add rule** button (or **Add branch protection rule**)
   - In "Branch name pattern", enter: `main` (or your default branch name)

3. **Configure the protection rule:**
   - ✅ Check: **Require status checks to pass before merging**
   - ✅ Check: **Require branches to be up to date before merging** (optional but recommended)
   - In the status checks list, search for and select: **Check for NoMerge markers**

   > **Note:** The status check will only appear in the list after it has run at least once on a PR.

4. **Additional recommended settings (optional):**
   - ☐ Require a pull request before merging
   - ☐ Require approvals
   - ☐ Dismiss stale pull request approvals when new commits are pushed
   - ☐ Require review from Code Owners
   - ☐ Require linear history
   - ☐ Require deployments to succeed before merging

5. **Save the rule:**
   - Scroll to the bottom and click **Create** or **Save changes**

---

## Verification

To verify that branch protection is working:

1. **Create a test PR** with a file containing the forbidden pattern
2. **Check the PR status** - you should see the NoMerge Check failing
3. **Try to merge** - the merge button should be disabled with a message like:
   ```
   Merging is blocked
   Required status check "Check for NoMerge markers" is failing
   ```

---

## Configuration Details

### Required Status Check Name

The status check is named: **`Check for NoMerge markers`**

This is defined in your workflow file (`.github/workflows/nomerge-check.yml`):

```yaml
jobs:
  nomerge-check:
    runs-on: ubuntu-latest
    name: Check for NoMerge markers  # ← This is the status check name
```

If you change this name in your workflow, you must update the branch protection settings accordingly.

### Strict Mode

Setting `"strict": true` in the API call (or checking "Require branches to be up to date before merging" in the UI) means:
- PR branches must be up-to-date with the base branch before merging
- This ensures the check runs against the latest code
- Recommended for most repositories

### Enforce Admins

Setting `"enforce_admins": false` means:
- Repository admins can bypass branch protection rules
- Useful for emergency fixes or special circumstances
- Set to `true` if you want to enforce rules for everyone including admins

---

## Troubleshooting

### "Status check not found" error

If the status check doesn't appear in the list:
1. The check must run at least once before it appears
2. Create a test PR to trigger the workflow
3. Wait for the check to complete
4. Then configure branch protection

### Branch protection doesn't seem to work

Verify:
1. The branch name matches exactly (case-sensitive)
2. The status check name matches exactly: `Check for NoMerge markers`
3. You have the necessary permissions (repo admin/owner)
4. The workflow file exists in the default branch

### Merge button is disabled for all PRs

This might happen if:
1. The status check name doesn't match
2. The workflow is failing for other reasons
3. The branch is behind the base branch (if strict mode is enabled)

**Solution:** Check the Actions tab for workflow results and ensure the check passes for clean PRs.

---

## API Reference

For more advanced configurations, see the GitHub API documentation:

- [Update branch protection](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection)
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

---

## Additional Resources

- **GitHub Web UI:** `https://github.com/OWNER/REPO/settings/branches`
- **API Endpoint:** `PUT /repos/{owner}/{repo}/branches/{branch}/protection`
- **GitHub Docs:** https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches

---

## Quick Reference Commands

**Enable protection:**
```bash
curl -X PUT \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/$OWNER/$REPO/branches/main/protection \
  -d '{"required_status_checks":{"strict":true,"contexts":["Check for NoMerge markers"]},"enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null}'
```

**View current protection:**
```bash
curl -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/$OWNER/$REPO/branches/main/protection
```

**Remove protection:**
```bash
curl -X DELETE \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/$OWNER/$REPO/branches/main/protection
```
