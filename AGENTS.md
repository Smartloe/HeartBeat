# Repository Guidelines

## Project Structure & Module Organization

- The repository currently contains a single documentation file: `TuneHub API Documentation.md`.
- There is no source code or test directory yet. If code is added, keep `src/` for implementation, `tests/` for automated tests, and `assets/` for static files.
- Prefer descriptive filenames in English and keep new documentation at the top level unless it belongs under a `docs/` folder.

## Build, Test, and Development Commands

- No build or test scripts are configured in this repository.
- If you add a build system, document the exact commands here (for example: `npm run build`, `pytest`, or `make test`) and keep them runnable from the repository root.

## Coding Style & Naming Conventions

- No language-specific style guide is defined yet.
- When adding code, adopt a formatter and linter appropriate to the language and record them here (for example: `black`/`ruff` for Python or `prettier`/`eslint` for JavaScript).
- Use consistent naming: `snake_case` for Python modules, `camelCase` for JS variables, and `PascalCase` for types/classes.

## Testing Guidelines

- No test framework is configured.
- If tests are added, keep them colocated under `tests/` and use clear names like `test_<feature>.py` or `<feature>.spec.ts`.
- Document how to run the full test suite and any subsets.

## Commit & Pull Request Guidelines

- Git history is not available in this repository, so no commit message convention can be inferred.
- Use concise, descriptive commit subjects (50–72 characters) and include context in the body when changes are non-trivial.
- For pull requests, include a brief summary, list of changes, and any required screenshots or sample outputs.

## Security & Configuration Tips

- Avoid committing credentials. Store secrets in environment variables and document required keys in a future `docs/config.md` or `README.md`.
- If API keys are needed for TuneHub, add a sample `.env.example` and keep actual `.env` files untracked.
