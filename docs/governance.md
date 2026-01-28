# Repository Governance

This document describes the development workflow and policies for the Jarvis V5 repository.

## Branching Model

- **`main`** - Production-ready code; protected branch
- **`feature/*`** - Feature development branches
- All changes to `main` must go through Pull Requests

### Branch Naming Convention

```
feature/<short-description>   # New features
fix/<short-description>       # Bug fixes
docs/<short-description>      # Documentation updates
ci/<short-description>        # CI/CD changes
```

## Required CI Checks

The following checks must pass before merging to `main`:

| Check | Description |
|-------|-------------|
| `Lint` | ESLint code quality (apps/web) |
| `Typecheck` | TypeScript type checking |
| `Build` | Production build verification |
| `Smoke Tests` | End-to-end smoke tests |
| `Secret Scan` | Gitleaks secret detection |

### Informational Checks (soft gates)
| Check | Description | Status |
|-------|-------------|--------|
| `SCA (npm audit)` | Dependency vulnerability scan | Soft gate - Next.js upgrade pending |
| `CodeQL` | Static analysis | Skipped - requires GHAS for private repos |

## Local Development Commands

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Build all workspaces
npm run build

# Run smoke tests (requires server running)
npm run smoke

# Start development server
npm run dev
```

## Environment File Policy

**⚠️ NEVER commit `.env` files containing secrets.**

- Use `.env.example` files as templates
- Copy to `.env.local` for local development
- All `.env*` files (except `.env.example`) are gitignored
- Store production secrets in GitHub Secrets or your deployment platform

### Template Locations

- `apps/web/.env.example` - Frontend environment template
- `apps/server/.env.example` - Backend environment template

## Code Review Process

1. Create a feature branch from `main`
2. Make your changes with clear, atomic commits
3. Push and open a Pull Request
4. Ensure all CI checks pass
5. Request review from code owners (auto-assigned via CODEOWNERS)
6. Address review feedback
7. Merge after approval (squash or merge commit preferred)

## Release Process

1. All changes merged to `main` via PR
2. CI runs on every push to `main`
3. Manual tagging for version releases:
   ```bash
   git tag -a v<version> -m "Release v<version>"
   git push origin v<version>
   ```

## Security

- Dependabot monitors dependencies for vulnerabilities
- npm audit runs on every PR (reports critical/high vulnerabilities)
- Gitleaks prevents secret commits
- Report security issues privately to maintainers

### Known Security TODOs
- [ ] Upgrade Next.js to 14.2.35+ to resolve critical vulnerabilities
- [ ] Enable GitHub Advanced Security for CodeQL (if plan allows)
- [ ] Make SCA a hard gate after Next.js upgrade
