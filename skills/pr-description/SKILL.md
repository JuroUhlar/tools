---
name: pr-description
description: Write concise GitHub PR descriptions in the user's preferred style. Use when drafting, editing, or rewriting a PR description — including `gh pr create --body` and `gh pr edit --body`.
---

# PR Description

Write brief, scannable PR descriptions. Reviewers read the diff; the description is there to orient them and explain the intent and non-obvious decisions — not to re-explain the code.

## Structure

1. **Opening bullets** — short list of what changed. One line each. No heading above them.
2. **`### Discussion point: ...` sections** — one h3 per non-obvious decision where reviewer input is genuinely useful. 1–3 sentences each.
3. **`### ...` notes for known issues** — failing CI checks, deferred work, follow-ups. 1–2 sentences plus the resolution.

Use h3 (`###`) for every subsection. Never h2.

## Rules

- **Be brief.** If a section runs longer than 3 sentences, cut it. Link to code rather than paraphrasing it.
- **Link to code for context and/or evidence**. Whenever useful, link to the relevant code either in the current branch/PR or when referencing implementation details in another repository.
- **Prefer clickable GitHub links as references.** Instead of `react/src/use-visitor-data.ts:60-65`, write `[React SDK](https://github.com/org/repo/blob/main/path/to/file.ts#L60-L65)`.  Use `main` for live references; pin to a SHA only when linking to historical state.
- **Flag open questions explicitly.** If a discussion point invites pushback, say so in one sentence so reviewers know to engage.

## Writing the `gh` command

When using `gh pr create --body` or `gh pr edit --body`, always use a quoted heredoc (`<<'EOF'`) so shell doesn't expand backticks or `$` inside the body. Do **not** escape backticks inside a quoted heredoc — they're already literal, and `\`` ends up rendered verbatim on GitHub.

```sh
gh pr edit 88 --body "$(cat <<'EOF'
- bullet one
- bullet two

### Discussion point: ...

Body with `inline code` and [links](https://...).
EOF
)"
```

## Include JIRA reference, if available

If you can include a JIRA ticket number in PR title and link to the ticket in the description, do so.

* The user might have provided the JIRA ticket.
* If not and you have access to JIRA MCP or CLI, use it to find the ticket number (check in progress tasks assigned to me, find the right one).

## Include Slack reference, if available

* If you know a Slack conversation prompted the PR, include a link to the conversation in the description.