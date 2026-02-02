# Dependency Update Policy

This document describes how dependency updates are handled in the AKIOR project.

## Overview

Dependencies are managed via Dependabot, which automatically creates PRs for updates. The handling depends on the version bump type:

| Update Type | Handling | CI Required |
|-------------|----------|-------------|
| **Patch** (x.x.1 → x.x.2) | Auto-merge after CI passes | Yes |
| **Minor** (x.1.x → x.2.x) | Auto-merge after CI passes | Yes |
| **Major** (1.x.x → 2.x.x) | Manual review required | Yes |

## Auto-Merge Workflow

The `.github/workflows/dependabot-automerge.yml` workflow enables auto-merge for patch and minor updates:

1. Dependabot opens a PR
2. All required CI checks run (lint, typecheck, unit tests, E2E, etc.)
3. If all checks pass AND the update is patch/minor, auto-merge is enabled
4. PR is squash-merged into main automatically

### Repository Setting Required

For auto-merge to work, the repository must have "Allow auto-merge" enabled:

**GitHub UI:** Settings → General → Pull Requests → ✅ Allow auto-merge

If this setting is disabled, the workflow will not fail but auto-merge won't activate. PRs will need manual merging.

## Major Version Updates

Major updates are NOT auto-merged. The workflow adds a comment with a review checklist:

- Read the release notes and changelog
- Check for breaking changes
- Verify compatibility with existing code
- Run full test suite locally if needed

After review, merge manually using squash merge.

## When CI Fails on a Dependency Update

If CI fails on a Dependabot PR:

### 1. Assess the failure
- Check if it's a flaky test vs. real incompatibility
- Review the error logs

### 2. For test flakes
- Re-run the failed job
- If persistent, investigate the test

### 3. For real incompatibilities
- Check the package's release notes for breaking changes
- Open an issue or discussion if needed
- Options:
  - Fix the incompatibility in a follow-up commit to the Dependabot branch
  - Close the Dependabot PR and pin the dependency version
  - Wait for a fix from the upstream package

### 4. Fixing on Dependabot branch
```bash
# Checkout the Dependabot branch
git fetch origin
git checkout dependabot/npm_and_yarn/<branch-name>

# Make fixes
# ...

# Commit and push
git commit -m "fix: resolve incompatibility with <package>@<version>"
git push origin dependabot/npm_and_yarn/<branch-name>
```

## Dependency Groups

Dependabot is configured with dependency groups:

- **prod-dependencies**: Production runtime dependencies
- **dev-dependencies**: Development/build dependencies

This reduces PR noise by grouping related updates together.

## Manual Merging

When manually merging Dependabot PRs:

1. Ensure all CI checks pass
2. Use **squash merge**
3. Commit message format: `deps: dependabot update (<scope>)`
   - Example: `deps: dependabot update (dev-dependencies)`

## Security Updates

Security updates from Dependabot are treated with priority:

- Review immediately when opened
- Fast-track through CI
- Merge as soon as checks pass (even for major versions if the security risk warrants it)

## Troubleshooting

### Auto-merge not working?
1. Verify "Allow auto-merge" is enabled in repo settings
2. Check if all required status checks are passing
3. Ensure the PR author is `dependabot[bot]`
4. Confirm the update is patch or minor (majors are excluded)

### Conflicts with main?
1. Update the branch: `gh pr update-branch <PR_NUMBER> --rebase`
2. If conflicts persist, close and let Dependabot recreate

### Package causing repeated failures?
Consider adding it to `.github/dependabot.yml` ignore list:
```yaml
ignore:
  - dependency-name: "problematic-package"
    update-types: ["version-update:semver-major"]
```
