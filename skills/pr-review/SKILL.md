---
name: pr-review
description: Generate a PR summary markdown and perform a senior code review. Use when the user asks to review a PR, review the current branch, or says "review this PR". Generates the diff/metadata summary automatically then reviews it.
---

# PR Review

## Workflow

### 1. Generate the PR summary

Run the script to produce a markdown file with the PR diff and metadata:

```bash
bun skills/pr-review/scripts/get-pr-summary/gen_pr_summary.ts -o pr_summary.md
```

Options:
- `-p <number|url>` — specify a PR number or URL (defaults to current branch)
- `-c` — include reviews and comments
- `-o <file>` — write output to file (defaults to stdout)

Requires: `bun` installed globally (`brew install bun`), `gh` authenticated (`gh auth login`).

### 2. Review

Read `pr_summary.md`, then follow these steps:

1. **Understand the goal** — Extract the PR's explicit goal, constraints, and expected behavior changes from the description. If critical context is missing, ask for it.

2. **Validate goal coverage** — Check whether the diff fully implements the stated goal. Call out missing pieces, partial implementations, or scope drift.

3. **Validate correctness** — Inspect related files outside the diff when needed. Look for regressions, broken assumptions, and compatibility issues with existing patterns.

4. **Review quality** — Evaluate as a senior engineer: functionality, clarity, structure, composition, encapsulation. Flag brittle abstractions, hidden coupling, and confusing ownership.

## Review priorities

Assess findings in this order:
- Functional bugs and regressions
- Security/privacy issues
- Data integrity and state management risks
- Error handling and edge cases
- Maintainability and API clarity
- Test coverage gaps implied by the change

## Rules

- Do not run tests or lint unless explicitly instructed
- Use the entire checked-out branch as context, not just the diff
- Keep suggestions brief and tied to concrete file/line references
- Avoid style-only feedback unless it affects correctness or maintainability

## Output format

1. **Findings** (ordered by severity) — file links with line references, impact, fix direction
2. **Open questions** — only blockers or ambiguities needed to increase confidence
3. **Summary** — one short paragraph after findings

If no findings, state that explicitly and note residual risks or unverified assumptions.
