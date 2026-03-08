#!/usr/bin/env node
/**
 * Measures MCP server context consumption on connection.
 *
 * Usage:
 *   mcp-context-measure --config <path> --server <name> [--raw-output <path>]
 *   mcp-context-measure --url <url> --header <key:value> [--header ...] [--raw-output <path>]
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * @typedef {Object} McpServerConfig
 * @property {string} url
 * @property {Record<string, string>} [headers]
 */

/**
 * @typedef {Object} RawOutput
 * @property {string} server
 * @property {unknown[]} tools
 * @property {unknown[]} prompts
 * @property {unknown[]} resources
 * @property {number} toolsChars
 * @property {number} promptsChars
 * @property {number} resourcesChars
 * @property {number} toolsTokens
 * @property {number} promptsTokens
 * @property {number} resourcesTokens
 */

/**
 * @typedef {Object} ParsedArgs
 * @property {string} [config]
 * @property {string} [server]
 * @property {string} [url]
 * @property {string[]} headers
 * @property {string} [rawOutput]
 * @property {boolean} help
 */

/**
 * @returns {ParsedArgs}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  /** @type {ParsedArgs} */
  const result = { headers: [], help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--config" && args[i + 1]) {
      result.config = args[++i];
    } else if (arg === "--server" && args[i + 1]) {
      result.server = args[++i];
    } else if (arg === "--url" && args[i + 1]) {
      result.url = args[++i];
    } else if (arg === "--header" && args[i + 1]) {
      result.headers.push(args[++i]);
    } else if (arg === "--raw-output" && args[i + 1]) {
      result.rawOutput = args[++i];
    } else if (arg === "-h" || arg === "--help") {
      result.help = true;
    }
  }
  return result;
}

/**
 * @param {string[]} headerStrings
 * @returns {Headers}
 */
function parseHeaders(headerStrings) {
  const headers = new Headers();
  for (const h of headerStrings) {
    const colon = h.indexOf(":");
    if (colon === -1) {
      throw new Error(`Invalid header format: ${h}. Use "Key: value"`);
    }
    headers.set(h.slice(0, colon).trim(), h.slice(colon + 1).trim());
  }
  return headers;
}

/**
 * @param {ParsedArgs} args
 * @returns {{ config: McpServerConfig; serverName: string }}
 */
function getServerConfig(args) {
  if (args.config && args.server) {
    const expanded = args.config.replace(/^~/, process.env.HOME ?? "");
    const configPath = expanded.startsWith("/")
      ? expanded
      : join(process.cwd(), expanded);
    const file = JSON.parse(readFileSync(configPath, "utf-8"));
    const serverConfig = file.mcpServers?.[args.server];
    if (!serverConfig?.url) {
      throw new Error(`Server "${args.server}" not found or missing url in ${configPath}`);
    }
    if (serverConfig.auth && !serverConfig.headers) {
      throw new Error(
        `Server "${args.server}" in ${configPath} uses auth-based MCP configuration. ` +
          "This script currently supports direct URLs with headers or config entries with static headers."
      );
    }
    const headers = serverConfig.headers
      ? new Headers(serverConfig.headers)
      : new Headers();
    return {
      config: { url: serverConfig.url, headers: Object.fromEntries(headers.entries()) },
      serverName: args.server,
    };
  }

  if (args.url && args.headers.length > 0) {
    const headers = parseHeaders(args.headers);
    return {
      config: { url: args.url, headers: Object.fromEntries(headers.entries()) },
      serverName: "direct",
    };
  }

  throw new Error(
    "Provide either (--config <path> --server <name>) or (--url <url> --header <key:value> ...)"
  );
}

/**
 * @param {RawOutput} raw
 */
function printSummary(raw) {
  const totalTokens = raw.toolsTokens + raw.promptsTokens + raw.resourcesTokens;
  process.stdout.write(
    [
      `MCP context consumption (${raw.server}):`,
      "",
      `  Tools:      ${raw.tools.length} tools, ${raw.toolsChars.toLocaleString()} chars, ~${raw.toolsTokens.toLocaleString()} tokens`,
      `  Prompts:    ${raw.prompts.length} prompts, ${raw.promptsChars.toLocaleString()} chars, ~${raw.promptsTokens.toLocaleString()} tokens`,
      `  Resources:  ${raw.resources.length} resources, ${raw.resourcesChars.toLocaleString()} chars, ~${raw.resourcesTokens.toLocaleString()} tokens`,
      `  Total:     ~${totalTokens.toLocaleString()} tokens`,
      "",
      `  Tool names: ${raw.tools.map((t) => /** @type {{ name?: string }} */ (t).name ?? "?").join(", ")}`,
      `  Prompt names: ${raw.prompts.map((p) => /** @type {{ name?: string }} */ (p).name ?? "?").join(", ")}`,
      "",
    ].join("\n")
  );
}

function printHelp() {
  process.stdout.write(
    [
      "mcp-context-measure - Measure MCP server context consumption on connection",
      "",
      "Usage:",
      "  mcp-context-measure --config <path> --server <name> [options]",
      "  mcp-context-measure --url <url> --header <key:value> [--header ...] [options]",
      "",
      "Options:",
      "  --config <path>     Path to mcp.json",
      "  --server <name>     Server key from config (e.g. fingerprint)",
      "  --url <url>         MCP server URL (direct mode)",
      "  --header <key:val>  Header in Key: value format (repeatable, direct mode)",
      "  --raw-output <path> Dump raw tools/prompts/resources JSON to file",
      "  -h, --help          Show this help",
      "",
      "Examples:",
      "  mcp-context-measure --config ~/.cursor/mcp.json --server fingerprint",
      "  mcp-context-measure --url https://mcp.example.com/mcp --header 'Authorization: Bearer x'",
      "  mcp-context-measure --config mcp.json --server fingerprint --raw-output dump.json > summary.txt",
      "",
    ].join("\n")
  );
}

/**
 * @param {McpServerConfig} config
 * @returns {Promise<RawOutput>}
 */
async function measure(config) {
  const headers = new Headers(config.headers);
  const client = new Client({ name: "mcp-context-measure", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: { headers },
  });

  await client.connect(transport);

  const { tools } = await client.listTools();
  const toolsJson = JSON.stringify(tools, null, 2);
  const toolsChars = toolsJson.length;
  const toolsTokens = Math.ceil(toolsChars / 4);

  /** @type {unknown[]} */
  let prompts = [];
  try {
    const result = await client.listPrompts();
    prompts = result.prompts;
  } catch {
    // Prompts may not be supported
  }
  const promptsJson = JSON.stringify(prompts, null, 2);
  const promptsChars = promptsJson.length;
  const promptsTokens = Math.ceil(promptsChars / 4);

  /** @type {unknown[]} */
  let resources = [];
  try {
    const result = await client.listResources();
    resources = result.resources;
  } catch {
    // Resources may not be supported
  }
  const resourcesJson = JSON.stringify(resources, null, 2);
  const resourcesChars = resourcesJson.length;
  const resourcesTokens = Math.ceil(resourcesChars / 4);

  client.close();

  return {
    server: config.url,
    tools,
    prompts,
    resources,
    toolsChars,
    promptsChars,
    resourcesChars,
    toolsTokens,
    promptsTokens,
    resourcesTokens,
  };
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  try {
    const { config, serverName } = getServerConfig(args);
    const raw = await measure(config);
    raw.server = serverName;

    if (args.rawOutput) {
      const outputPath = args.rawOutput.startsWith("/")
        ? args.rawOutput
        : join(process.cwd(), args.rawOutput);
      writeFileSync(outputPath, JSON.stringify(raw, null, 2), "utf-8");
    }

    printSummary(raw);
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

main();
