---
name: pr-review
description: Expert code review for pull requests, branch diffs, commit ranges, or uncommitted changes. Verifies correctness, risk, tests, security, and production readiness.
---

# PR Review

Find the highest-leverage issues in a code change. Bias toward correctness, safety, and production readiness. Signal over volume — fewer high-confidence findings beat many weak ones.

## Principles

- Review the **diff plus relevant context** (callers, callees, related files).
- Compare against **stated and implied intent**.
- Every finding explains **why it matters** in this codebase.
- Distinguish **must-fix defects** from **nice-to-have improvements**.
- Flag uncertainty: say what you checked and why confidence is limited.
- For PRs, do not run tests or lint unless explicitly asked; assume CI is passing.
- If you do not find a high-confidence issue, say so explicitly.

## Workflow

### 1. Get the diff

If the user hasn't provided one:

- `git diff` / `git diff --staged` / `git diff <base>...HEAD`
- For PRs: `node skills/pr-review/scripts/gen_pr_summary.mjs --out ./.tmp/.pr_summary_<PR>_<TITLE>.md` (`--help` for options); if needed, fall back to `gh pr diff <n>` plus `gh pr view <n>` for metadata

### 2. Establish context

Identify the goal from: user instructions > PR description/issue > spec/plan > commit messages > the diff. Flag disagreements between stated intent and actual implementation.

### 3. Triage risk

Before deep review, note high-risk areas touched by the change: auth/permissions, secrets/crypto, payments, input validation, concurrency/locking, DB writes/migrations, caching, public API contracts, perf-critical paths. Higher risk = stricter evidence bar.

### 4. Review

1. **Goal coverage** — fully implemented? Missing pieces or extra scope that should be a separate PR?
2. **Correctness** — edge cases, failure paths, silent behavior changes, broken invariants. For risky changes, trace data flow end-to-end (entry > validation > auth > transform > persist > output).
3. **Security** — unsafe input crossing boundaries, missing auth checks, leaked secrets in logs/errors.
4. **Data integrity** — partial writes, races, cache coherence, migration reversibility.
5. **Tests** — changed behavior covered? Mocks hiding real risk? Missing regression tests?
6. **Design** — clarity, coupling, responsibility separation. Easier or harder to change next time?

### 5. Check for missing counterparts

When code changes in one layer, check if companion changes are missing: tests, types/schemas, docs, validation, metrics, migrations, client/server contracts.

## Heuristics

- **Regressions first**: what previously-safe behavior could this break?
- **Correctness**: prefer fixing the root problem rather than masking the symptom
- **Simplicity**: prefer simpler solutions that are easier to understand and maintain.
- **Readability**: expect clear and obvious variable names, function names, "why" comments. Flag code you have trouble understanding at first glance.
- **YAGNI**: call out needless scope or complexity created "for the future", "just in case"
- **Strictness**: prefer failing fast and early rather than masking the problem, call out missing input validation, lack of type safety, etc.
- **Push back**: if prior comments or docs seem wrong, explain why with code evidence.


## Severity

- **P0 Blocking** — likely production breakage, data loss, security bug
- **P1 Important** — realistic bug; fix before merge
- **P2 Moderate** — worthwhile but not merge-blocking
- **P3 Minor** — polish or follow-up

Default P1/P2. P0 is rare. Skip pure style nits unless they mask a real problem.

## Output

1. **Findings** by severity — `P<n>: <title>`, best-available refs (file, line, symbol), impact, proposed fix direction
2. **Open questions** — only blockers or ambiguities
3. **Summary** — one paragraph with verdict: approve / approve with follow-ups / request changes

No findings? Say so explicitly; note residual risks or unverified assumptions.
