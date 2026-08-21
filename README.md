# tools

Personal scripts and little tools.

## Contents

### [code-review](./skills/code-review)

Agent skill + Node script for AI-assisted PR code review. Generates a Markdown summary of an open GitHub PR (metadata, description, reviews, comments, diff) and includes a structured review skill for Cursor/Codex.

**Requires:** Node 18+, `gh`, `git`

```bash
cd <your-repo>
node /path/to/skills/code-review/scripts/gen_pr_summary.mjs             # prints to stdout
node /path/to/skills/code-review/scripts/gen_pr_summary.mjs -o out.md   # writes to file
node /path/to/skills/code-review/scripts/gen_pr_summary.mjs --help      # all options
```

### [pr-description](./skills/pr-description)

Agent skill for writing concise, scannable GitHub PR descriptions. Orients reviewers with short bullets, discussion points for non-obvious decisions, and known-issue notes — without re-explaining the diff.

### [verify-your-work](./skills/verify-your-work)

Agent skill that runs maximum local verification before handing work back: deterministic checks (build, lint, typecheck, test), manual testing, and a fresh-context self-review from a second model.

### [mcp-context-measure](./mcp-context-measure)

Node CLI that connects to an MCP (Model Context Protocol) HTTP server and measures how many tokens its tool/prompt/resource definitions consume — useful for understanding AI context overhead.

```bash
cd mcp-context-measure && pnpm install
pnpm run measure -- --config ~/.cursor/mcp.json --server <name>
pnpm run measure -- --url https://mcp.example.com/mcp
```

### [mac_cleanup](./scripts/mac_cleanup.sh)

Interactive macOS disk cleanup. Asks before each step: Library caches, mediaanalysisd, Slack/Android/Xcode caches, Docker prune, `node_modules` under `~/Documents/Code`, Trash, optional reboot.

```bash
bash scripts/mac_cleanup.sh
```

### [notes](./notes)

Misc research notes (skill loading across AI editors, useful links).
