# mcp-context-measure

Measures MCP server context consumption on connection (tools + prompts + resources token estimate).

## Install

```bash
pnpm install
```

## Usage

**From config file:**
```bash
mcp-context-measure --config <path> --server <name> [--raw-output <path>]
```

**Direct URL:**
```bash
mcp-context-measure --url <url> --header <key:value> [--header ...] [--raw-output <path>]
```

## Examples

```bash
pnpm run measure -- --config ~/.cursor/mcp.json --server fingerprint
pnpm run measure -- --url https://mcp.example.com/mcp --header 'Authorization: Bearer x'
pnpm run measure -- --config mcp.json --server fingerprint --raw-output dump.json
```

`--raw-output` writes the full tools/prompts/resources JSON to a file.

## E2E tests

Run the end-to-end suite with:

```bash
pnpm run test:e2e
```

The Slack and Notion tests first try to use `slack` and `notion` from `~/.cursor/mcp.json`. If those entries are not present, they fall back to env vars.

Provide one of these env var pairs for each server when you want to override the default config:

```bash
SLACK_MCP_CONFIG=~/.cursor/mcp.json
SLACK_MCP_SERVER=slack

NOTION_MCP_CONFIG=~/.cursor/mcp.json
NOTION_MCP_SERVER=notion
```

Or provide a direct URL plus headers as JSON:

```bash
SLACK_MCP_URL=https://mcp.example.com/mcp
SLACK_MCP_HEADERS_JSON='{"Authorization":"Bearer ..."}'

NOTION_MCP_URL=https://mcp.example.com/mcp
NOTION_MCP_HEADERS_JSON='{"Authorization":"Bearer ..."}'
```

Note: Cursor `auth`-based MCP entries are not yet replayable by this CLI. If a server in `~/.cursor/mcp.json` uses an `auth` block instead of static `headers`, the e2e test will skip with a clear reason.
