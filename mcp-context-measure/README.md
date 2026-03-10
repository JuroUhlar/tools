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
mcp-context-measure --url <url> [--header <key:value> ...] [--raw-output <path>]
```

## Examples

```bash
pnpm run measure -- --config ~/.cursor/mcp.json --server fingerprint
pnpm run measure -- --url https://mcp.example.com/mcp --header 'Authorization: Bearer x'
pnpm run measure -- --url https://mcp.example.com/mcp   # no auth required
pnpm run measure -- --config mcp.json --server fingerprint --raw-output dump.json
```

`--raw-output` writes the full tools/prompts/resources JSON to a file.

## E2E tests

Run the end-to-end suite with:

```bash
CONTEXT7_API_KEY=<your-key> pnpm run test:e2e
```

Tests are skipped when `CONTEXT7_API_KEY` is not set. Copy `test/e2e/mcp.json.example` to `test/e2e/mcp.json` if you prefer to supply credentials via file instead (that file is gitignored).

Note: Cursor `auth`-based MCP entries are not replayable by this CLI. If a server in `~/.cursor/mcp.json` uses an `auth` block instead of static `headers`, the measurement will fail with a clear error.
