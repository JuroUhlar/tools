#!/usr/bin/env bash
set -euo pipefail

INCLUDE_COMMENTS=false
PR_ID=""
OUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--include-comments) INCLUDE_COMMENTS=true ;;
    -p|--pr) PR_ID="${2:?'--pr requires a value'}"; shift ;;
    -p=*|--pr=*) PR_ID="${1#*=}" ;;
    -o|--out) OUT_FILE="${2:?'--out requires a value'}"; shift ;;
    -o=*|--out=*) OUT_FILE="${1#*=}" ;;
    -h|--help)
      echo "Usage: $(basename "$0") [-p <number|url>] [-c] [-o <file>]"
      echo
      echo "  Generates a markdown summary of the current PR (diff + metadata)."
      echo "  Outputs to stdout by default."
      echo
      echo "Options:"
      echo "  -p, --pr <number|url>   PR number or URL (default: auto-detect from current branch)"
      echo "  -c, --include-comments  Also include reviews and comments"
      echo "  -o, --out <file>        Write output to file instead of stdout"
      echo "  -h, --help              Show this help"
      echo
      echo "Examples:"
      echo "  $(basename "$0")                   # print to stdout"
      echo "  $(basename "$0") > diff.md         # redirect to file"
      echo "  $(basename "$0") --out diff.md     # write to file"
      echo "  $(basename "$0") --pr 123          # specific PR"
      echo "  $(basename "$0") -p 123 -c -o diff.md"
      exit 0
      ;;
    -*) echo "Error: unknown flag '$1'" >&2; exit 1 ;;
    *) echo "Error: unexpected argument '$1'. Use --out to specify an output file." >&2; exit 1 ;;
  esac
  shift
done

# Preconditions
for cmd in gh git jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: $cmd is not installed." >&2
    exit 1
  fi
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# All data comes from GitHub API so local branch state doesn't matter.
PR_ARGS=(${PR_ID:+"$PR_ID"})

if ! PR_JSON="$(gh pr view "${PR_ARGS[@]}" --json number,title,url,baseRefName,headRefName,author,body 2>/dev/null)"; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
  echo "Error: no open PR found for branch '${BRANCH}'." >&2
  echo "If multiple PRs exist for this branch, use: $(basename "$0") --pr <number|url>" >&2
  exit 1
fi

PR_NUMBER="$(echo "${PR_JSON}" | jq -r .number)"
PR_TITLE="$(echo "${PR_JSON}"  | jq -r .title)"
PR_URL="$(echo "${PR_JSON}"    | jq -r .url)"
BASE_BRANCH="$(echo "${PR_JSON}" | jq -r .baseRefName)"
HEAD_BRANCH="$(echo "${PR_JSON}" | jq -r .headRefName)"
PR_AUTHOR="$(echo "${PR_JSON}"  | jq -r .author.login)"
PR_BODY="$(echo "${PR_JSON}"    | jq -r .body)"

DIFF="$(gh pr diff "${PR_ARGS[@]}" 2>/dev/null || echo "")"

if [[ "$INCLUDE_COMMENTS" == true ]]; then
  PR_COMMENTS="$(gh pr view "${PR_ARGS[@]}" --comments 2>/dev/null || echo "")"
  PR_REVIEWS="$(gh pr view "${PR_ARGS[@]}" --json reviews --template \
'{{- range .reviews -}}
- [{{.state}}] @{{.author.login}} ({{.submittedAt}}){{ if .body }}:
  {{ .body | indent 2 }}
{{ end }}
{{- end -}}
' 2>/dev/null || echo "")"
fi

REPO="$(gh repo view --json name --jq .name 2>/dev/null || basename "$(git rev-parse --show-toplevel)")"
NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

{
  echo "# PR Changes"
  echo
  echo "**Repo:** ${REPO}"
  echo "**PR:** #${PR_NUMBER} — ${PR_TITLE}"
  echo "**URL:** ${PR_URL}"
  echo "**Author:** @${PR_AUTHOR}"
  echo "**Head:** ${HEAD_BRANCH}"
  echo "**Base:** ${BASE_BRANCH}"
  echo "**Generated:** ${NOW_UTC}"
  echo
  echo "## Description"
  echo
  if [[ -n "${PR_BODY}" && "${PR_BODY}" != "null" ]]; then
    echo "${PR_BODY}"
  else
    echo "_No description_"
  fi
  echo
  if [[ "$INCLUDE_COMMENTS" == true ]]; then
    echo "## Reviews"
    echo
    if [[ -n "${PR_REVIEWS}" ]]; then
      echo "${PR_REVIEWS}"
    else
      echo "_No reviews_"
    fi
    echo
    echo "## Comments"
    echo
    if [[ -n "${PR_COMMENTS}" ]]; then
      echo '```'
      echo "${PR_COMMENTS}"
      echo '```'
    else
      echo "_No comments_"
    fi
    echo
  fi
  echo "## Diff vs ${BASE_BRANCH}"
  echo
  if [[ -n "${DIFF}" ]]; then
    echo '```diff'
    echo "${DIFF}"
    echo '```'
  else
    echo "_No diff_"
  fi
} | if [[ -n "$OUT_FILE" ]]; then
  tee "$OUT_FILE" > /dev/null
  echo "Wrote ${OUT_FILE}" >&2
else
  cat
fi
