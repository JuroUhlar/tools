#!/usr/bin/env bash
set -euo pipefail

# Config
OUT_FILE="${1:-pr_changes}"   # you can pass a different output filename as an arg

# Preconditions
if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh (GitHub CLI) is not installed." >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is not installed." >&2
  exit 1
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi

# Ensure gh is authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# Figure out current branch (HEAD can be detached on CI; handle that)
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
if [[ -z "${CURRENT_BRANCH}" || "${CURRENT_BRANCH}" == "HEAD" ]]; then
  echo "Error: could not resolve current branch (detached HEAD?)." >&2
  exit 1
fi

# Make sure we have latest refs for safety
git fetch --all --quiet

# Verify there is an open PR for this branch; `gh pr view` without args uses current branch
if ! gh pr view >/dev/null 2>&1; then
  # If that failed, check if multiple PRs exist for head branch
  PRS_JSON="$(gh pr list --state all --head "${CURRENT_BRANCH}" --json number,url 2>/dev/null || echo "[]")"
  if [[ "${PRS_JSON}" == "[]" ]]; then
    echo "Error: no PR found for branch '${CURRENT_BRANCH}'." >&2
    exit 1
  else
    echo "Error: Could not auto-detect a single PR for '${CURRENT_BRANCH}'. Try: gh pr view <PR-URL/NUMBER>" >&2
    echo "Found candidates: ${PRS_JSON}" >&2
    exit 1
  fi
fi

# Pull core PR info via JSON/JQ built into gh
PR_NUMBER="$(gh pr view --json number --jq .number)"
PR_TITLE="$(gh pr view --json title --jq .title)"
PR_URL="$(gh pr view --json url --jq .url)"
BASE_BRANCH="$(gh pr view --json baseRefName --jq .baseRefName)"
HEAD_BRANCH="$(gh pr view --json headRefName --jq .headRefName)"
PR_AUTHOR="$(gh pr view --json author --jq .author.login)"
PR_BODY="$(gh pr view --json body --jq .body)"

# Fetch latest base from origin
git fetch origin "${BASE_BRANCH}" --quiet

# Generate a diff of what this PR changes vs the latest origin/<base>.
# Using triple-dot (...) to diff from merge-base(origin/base, HEAD) to HEAD.
# --no-color for plain text; --binary if you want patches to include binary deltas.
DIFF=$(git diff --no-color --patch origin/"${BASE_BRANCH}"...HEAD || true)

# Gather comments & reviews in a readable text block
# `gh pr view --comments` prints description + comments; we only want the commentary.
# We'll still include that output in its own section for completeness.
PR_COMMENTS=$(gh pr view --comments 2>/dev/null || echo "")

# Optional: include review summaries (state, author, time, body)
PR_REVIEWS=$(gh pr view --json reviews --template \
'{{- range .reviews -}}
- [{{.state}}] @{{.author.login}} ({{.submittedAt}}){{ if .body }}:
  {{ .body | indent 2 }}
{{ end }}
{{- end -}}
' 2>/dev/null || echo "")

# Timestamp (UTC)
NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Write output
{
  echo "# PR Changes"
  echo
  echo "**Repo:** $(basename "$(git rev-parse --show-toplevel)")"
  echo "**PR:** #${PR_NUMBER} — ${PR_TITLE}"
  echo "**URL:** ${PR_URL}"
  echo "**Author:** @${PR_AUTHOR}"
  echo "**Head (current):** ${HEAD_BRANCH}"
  echo "**Base (target):** ${BASE_BRANCH}"
  echo "**Generated:** ${NOW_UTC}"
  echo
  echo "## Description"
  echo
  # Preserve newlines in body
  if [[ -n "${PR_BODY}" && "${PR_BODY}" != "null" ]]; then
    echo "${PR_BODY}"
  else
    echo "_No description_"
  fi
  echo
  echo "## Reviews (summary)"
  echo
  if [[ -n "${PR_REVIEWS}" ]]; then
    echo "${PR_REVIEWS}"
  else
    echo "_No reviews_"
  fi
  echo
  echo "## Comments & Review Threads (raw)"
  echo
  if [[ -n "${PR_COMMENTS}" ]]; then
    echo '```'
    echo "${PR_COMMENTS}"
    echo '```'
  else
    echo "_No comments_"
  fi
  echo
  echo "## Diff vs origin/${BASE_BRANCH}"
  echo "_Diff of changes introduced by ${HEAD_BRANCH} relative to the latest origin/${BASE_BRANCH} (merge-base to HEAD)._"
  echo
  if [[ -n "${DIFF}" ]]; then
    echo '```diff'
    echo "${DIFF}"
    echo '```'
  else
    echo "_No diff (branch may be up-to-date)._"
  fi
} > "${OUT_FILE}"

echo "Wrote ${OUT_FILE}"