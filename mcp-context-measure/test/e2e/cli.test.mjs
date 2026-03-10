/**
 * E2E tests for the mcp-context-measure CLI.
 *
 * Uses the bundled test/e2e/mcp.json fixture (context7 server).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const MCP_CONFIG = fileURLToPath(new URL("./mcp.json", import.meta.url));
const CLI = fileURLToPath(new URL("../../cli.mjs", import.meta.url));

/**
 * @param {string} server
 * @returns {Promise<{ stdout: string; stderr: string; exitCode: number }>}
 */
async function runCli(server) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI, "--config", MCP_CONFIG, "--server", server],
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

test("context7: measures an HTTP MCP server and prints a summary", async (t) => {
  const { stdout, stderr, exitCode } = await runCli("context7");

  assert.equal(exitCode, 0, `CLI exited with ${exitCode}. stderr: ${stderr}`);
  assert.match(stdout, /MCP context consumption \(context7\):/);
  assert.match(stdout, /Tools:\s+\d+ tools/);
  assert.match(stdout, /Total:\s+[\d,]+ tokens/);

  t.diagnostic(stdout.trim());
});

