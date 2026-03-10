# tools

Personal scripts and little tools.

## Contents

### [generate-pr-summary](./generate-pr-summary)

Bash script that generates a Markdown document summarising an open GitHub PR — metadata, description, reviews, comments, and the full diff — ready to paste into an AI for code review.

**Requires:** `gh`, `git`

```bash
cd <your-repo>
bash /path/to/gen_pr_summary.sh          # writes pr_changes.md
bash /path/to/gen_pr_summary.sh my.md   # custom output path
```

### [mcp-context-measure](./mcp-context-measure)

Node.js CLI that connects to an MCP (Model Context Protocol) HTTP server and measures how many tokens its tool/prompt/resource definitions consume — useful for understanding AI context overhead from MCP integrations.

```bash
cd mcp-context-measure && pnpm install
pnpm run measure -- --config ~/.cursor/mcp.json --server <name>
pnpm run measure -- --url https://mcp.example.com/mcp
```
