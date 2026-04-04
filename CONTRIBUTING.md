# Contributing to Specrail

Thanks for your interest in contributing to Specrail. This document covers everything you need to get started.

## Development Setup

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (the repo pins `pnpm@9.15.0`)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/gerrymiller/specrail.git
cd specrail

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages via Turborepo |
| `pnpm dev` | Start development mode (watch) |
| `pnpm test` | Run all tests via Vitest |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with V8 coverage |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format with Prettier |
| `pnpm format:check` | Check formatting without writing |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clean` | Remove all build artifacts and node_modules |

## Project Structure

```
specrail/
├── packages/
│   ├── core/          # Canonical model, types, Zod schemas
│   ├── ingest/        # OpenAPI parsing and normalization
│   ├── policy/        # Policy overlay engine
│   ├── cache/         # Two-tier bundle cache
│   ├── runtime/       # Direct API execution
│   ├── export/        # MCP + SKILLS.md generation
│   └── cli/           # CLI interface
├── fixtures/
│   ├── specs/         # Test OpenAPI specs
│   └── policies/      # Test policy overlays
├── docs/              # Architecture and design documentation
└── ...config files
```

## Branch Naming Conventions

This project follows gitflow. All work happens on branches off `develop`:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features and enhancements | `feature/add-openapi-3.1-support` |
| `bugfix/` | Bug fixes during development | `bugfix/fix-policy-rule-matching` |
| `chore/` | Maintenance, deps, refactoring | `chore/update-vitest` |
| `hotfix/` | Critical production fixes (from `main`) | `hotfix/fix-cache-corruption` |
| `release/` | Release preparation | `release/v0.2.0` |

**Never commit directly to `main`.**

## Workflow

### Making a Contribution

1. **Fork and clone** the repository.
2. **Check out `develop`** and pull the latest:
   ```bash
   git checkout develop
   git pull origin develop
   ```
3. **Create a branch** from `develop`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes.** Write code and tests together.
5. **Verify everything passes:**
   ```bash
   pnpm build
   pnpm test:coverage   # Must be >= 90%
   pnpm lint
   pnpm format:check
   pnpm typecheck
   ```
6. **Commit** with a conventional commit message (see below).
7. **Push** your branch and open a pull request against `develop`.

### Pull Request Process

- PRs target `develop`, not `main`.
- Fill out the PR template (if provided).
- Ensure CI passes (build, test, lint, typecheck, format).
- Coverage must stay at or above 90% for statements, branches, functions, and lines.
- One approval required before merge.
- Squash-merge preferred for feature branches.

## Code Standards

### TypeScript

- Strict mode is enabled. No `any` without good reason (ESLint warns on `@typescript-eslint/no-explicit-any`).
- Target: `ES2022`. Module: `ESNext` with `bundler` resolution.
- All packages build with `tsup`.
- Export types from `@specrail/core` for shared interfaces — don't duplicate type definitions across packages.

### Testing

- **Framework**: Vitest with V8 coverage.
- **Minimum coverage**: 90% on all four metrics (statements, branches, functions, lines). This is enforced in `vitest.config.ts`.
- Every new source file needs a corresponding test file.
- Use descriptive test names. Prefer `describe`/`it` blocks.
- Test both success and error paths.
- Place test fixtures in `fixtures/` at the repo root, not inside packages.

### Linting and Formatting

- **ESLint**: Flat config with `@eslint/js` recommended + `typescript-eslint` recommended.
- **Prettier**: Single quotes, semicolons, trailing commas everywhere, 100-char line width, 2-space indent, LF endings.
- Run `pnpm lint:fix && pnpm format` before committing.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `test`, `chore`, `docs`, `refactor`, `perf`, `ci`, `build`

**Scopes**: `core`, `ingest`, `policy`, `cache`, `runtime`, `export`, `cli`, `deps`, `config`

**Examples**:

```
feat(ingest): parse OpenAPI 3.1 discriminator unions
fix(policy): handle empty rule arrays without panic
test(cache): add integration tests for global cache fallback
chore(deps): bump typescript to 5.8
docs: update architecture diagram for new export flow
```

### Architectural Rules

These are project invariants. Don't violate them:

1. **Generated bundles never go in the repo.** `.specrail/` is gitignored. Don't commit `*.generated.json` or `*.bundle.json`.
2. **Auth credentials never appear in bundles or cache.** Credentials resolve from env vars at runtime.
3. **All cross-package types flow through `@specrail/core`.** Don't define capability types in other packages.
4. **Policy is the authority.** Every exported operation passes through the policy gate. No bypasses.

## Reporting Issues

Use [GitHub Issues](https://github.com/gerrymiller/specrail/issues). Include:

- Steps to reproduce
- Expected vs. actual behavior
- Specrail version, Node version, OS
- Relevant spec or policy files (sanitized)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
