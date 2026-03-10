/**
 * E2E tests for the mcp-context-measure CLI.
 *
 * Requires CONTEXT7_API_KEY env var. Tests are skipped when it is absent.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const CLI = fileURLToPath(new URL("../../cli.mjs", import.meta.url));
const CONTEXT7_API_KEY = process.env.CONTEXT7_API_KEY;

/**
 * @param {string} config
 * @param {string} server
 * @returns {Promise<{ stdout: string; stderr: string; exitCode: number }>}
 */
async function runCli(config, server) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI, "--config", config, "--server", server],
      { timeout: 30_000 },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const error = /** @type {NodeJS.ErrnoException & { stdout: string; stderr: string; code: number }} */ (err);
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: typeof error.code === "number" ? error.code : 1,
    };
  }
}

test(
  "context7: measures an HTTP MCP server and prints a summary",
  { skip: !CONTEXT7_API_KEY ? "CONTEXT7_API_KEY env var not set" : false },
  async (t) => {
    const tmpDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
    const tmpConfig = join(tmpDir, "mcp.json");
    writeFileSync(
      tmpConfig,
      JSON.stringify(
        {
          mcpServers: {
            context7: {
              url: "https://mcp.context7.com/mcp",
              headers: { CONTEXT7_API_KEY },
            },
          },
        },
        null,
        2,
      ),
    );

    const { stdout, stderr, exitCode } = await runCli(tmpConfig, "context7");

    assert.equal(exitCode, 0, `CLI exited with ${exitCode}. stderr: ${stderr}`);
    assert.match(stdout, /MCP context consumption \(context7\):/);
    assert.match(stdout, /Tools:\s+\d+ tools/);
    assert.match(stdout, /Total:\s+[\d,]+ tokens/);

    t.diagnostic(stdout.trim());
  },
);
