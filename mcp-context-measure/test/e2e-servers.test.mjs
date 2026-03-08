import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const testDir = dirname(fileURLToPath(import.meta.url));
const projectDir = dirname(testDir);
const cliPath = join(projectDir, "cli.mjs");
const defaultCursorConfigPath = expandHome("~/.cursor/mcp.json");

function expandHome(path) {
  if (!path.startsWith("~/")) {
    return path;
  }

  const home = process.env.HOME;
  assert.ok(home, "HOME is required to expand ~ in config paths");
  return join(home, path.slice(2));
}

function getConfigServer(configPath, serverName) {
  if (!existsSync(configPath)) {
    return null;
  }

  const file = JSON.parse(readFileSync(configPath, "utf8"));
  return file.mcpServers?.[serverName] ?? null;
}

function getServerTarget(prefix, defaultServerName) {
  const configPath = process.env[`${prefix}_MCP_CONFIG`];
  const serverName = process.env[`${prefix}_MCP_SERVER`];

  if (configPath && serverName) {
    const expandedConfigPath = expandHome(configPath);
    const serverConfig = getConfigServer(expandedConfigPath, serverName);
    if (serverConfig?.auth && !serverConfig.headers) {
      return {
        skipReason: `${serverName} in ${expandedConfigPath} uses auth-based MCP configuration, which this CLI cannot replay yet`,
      };
    }

    return {
      displayName: serverName,
      args: ["--config", expandedConfigPath, "--server", serverName],
    };
  }

  const url = process.env[`${prefix}_MCP_URL`];
  const headersJson = process.env[`${prefix}_MCP_HEADERS_JSON`];

  if (url && headersJson) {
    const headers = JSON.parse(headersJson);
    assert.equal(typeof headers, "object", `${prefix}_MCP_HEADERS_JSON must decode to an object`);
    assert.ok(headers && !Array.isArray(headers), `${prefix}_MCP_HEADERS_JSON must decode to an object`);

    /** @type {string[]} */
    const args = ["--url", url];
    for (const [key, value] of Object.entries(headers)) {
      assert.equal(typeof value, "string", `Header ${key} for ${prefix} must be a string`);
      args.push("--header", `${key}: ${value}`);
    }

    return {
      displayName: url,
      args,
    };
  }

  const defaultServer = getConfigServer(defaultCursorConfigPath, defaultServerName);
  if (defaultServer?.url) {
    if (defaultServer.auth && !defaultServer.headers) {
      return {
        skipReason: `${defaultServerName} in ${defaultCursorConfigPath} uses auth-based MCP configuration, which this CLI cannot replay yet`,
      };
    }

    return {
      displayName: defaultServerName,
      args: ["--config", defaultCursorConfigPath, "--server", defaultServerName],
    };
  }

  return null;
}

async function runMeasurement(prefix, defaultServerName) {
  const target = getServerTarget(prefix, defaultServerName);
  if (!target) {
    return null;
  }
  if ("skipReason" in target) {
    return target;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "mcp-context-measure-"));
  const rawOutputPath = join(tempDir, `${prefix.toLowerCase()}-raw.json`);

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cliPath, ...target.args, "--raw-output", rawOutputPath],
      {
        cwd: projectDir,
        env: process.env,
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const raw = JSON.parse(await readFile(rawOutputPath, "utf8"));
    return { raw, stdout, stderr, target };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function assertMeasurementShape(result) {
  assert.match(result.stdout, /MCP context consumption/u);
  assert.equal(result.stderr, "");

  assert.equal(typeof result.raw.server, "string");
  assert.ok(Array.isArray(result.raw.tools));
  assert.ok(Array.isArray(result.raw.prompts));
  assert.ok(Array.isArray(result.raw.resources));

  for (const key of [
    "toolsChars",
    "promptsChars",
    "resourcesChars",
    "toolsTokens",
    "promptsTokens",
    "resourcesTokens",
  ]) {
    assert.equal(typeof result.raw[key], "number", `${key} should be numeric`);
    assert.ok(result.raw[key] >= 0, `${key} should be non-negative`);
  }
}

test("Slack MCP can be measured end-to-end", async (t) => {
  const result = await runMeasurement("SLACK", "slack");
  if (!result) {
    t.skip(
      "Add slack to ~/.cursor/mcp.json, set SLACK_MCP_CONFIG + SLACK_MCP_SERVER, or set SLACK_MCP_URL + SLACK_MCP_HEADERS_JSON to run this test"
    );
    return;
  }
  if ("skipReason" in result) {
    t.skip(result.skipReason);
    return;
  }

  assertMeasurementShape(result);
});

test("Notion MCP can be measured end-to-end", async (t) => {
  const result = await runMeasurement("NOTION", "notion");
  if (!result) {
    t.skip(
      "Add notion to ~/.cursor/mcp.json, set NOTION_MCP_CONFIG + NOTION_MCP_SERVER, or set NOTION_MCP_URL + NOTION_MCP_HEADERS_JSON to run this test"
    );
    return;
  }
  if ("skipReason" in result) {
    t.skip(result.skipReason);
    return;
  }

  assertMeasurementShape(result);
});
