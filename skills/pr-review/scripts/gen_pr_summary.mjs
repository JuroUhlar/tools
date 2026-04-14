#!/usr/bin/env node
//
// Generates a markdown summary of a GitHub PR (metadata + diff)
//
// Usage:
//   node gen_pr_summary.mjs [options]
//
// Requires execute permission: chmod +x gen_pr_summary.mjs
// Can be symlinked into bin like: ln -sf "$PWD/skills/pr-review/scripts/gen_pr_summary.mjs" /usr/local/bin/get-pr-summary
// Then you can: get-pr-summary [options]
//
// Examples:
//   get-pr-summary > diff.md
//   get-pr-summary --out diff.md
//   get-pr-summary --pr 123 -c -o diff.md
//
// Dependencies (must be installed and on PATH):
//   node  v18+  https://nodejs.org  (parseArgs requires Node 18)
//   gh          https://cli.github.com  (GitHub CLI, must be authenticated via `gh auth login`)
//   git         https://git-scm.com
//
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

function run(cmd, args = []) {
  const { stdout, stderr, status, error } = spawnSync(cmd, args, {
    encoding: "utf8",
  });
  if (error) throw error;
  if (status !== 0) throw new Error(stderr || `${cmd} failed`);
  return stdout.trim();
}

function tryRun(cmd, args = []) {
  try {
    return run(cmd, args);
  } catch {
    return "";
  }
}

/** Check exit code only, suppress all output. */
function check(cmd, args = []) {
  const { status, error } = spawnSync(cmd, args, { stdio: "ignore" });
  return !error && status === 0;
}

const { values: opts } = parseArgs({
  options: {
    pr: { type: "string", short: "p" },
    "include-comments": { type: "boolean", short: "c" },
    "include-lockfile": { type: "boolean", short: "l" },
    out: { type: "string", short: "o" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (opts.help) {
  process.stdout.write(`\
Usage: gen-pr-summary [-p <number|url>] [-c] [-o <file>]

  Generates a markdown summary of the current PR (diff + metadata).

Options:
  -p, --pr <number|url>   PR number or URL (default: auto-detect from current branch)
  -c, --include-comments  Also include reviews and comments
  -l, --include-lockfile  Include lockfile changes (package-lock.json, pnpm-lock.yaml, yarn.lock)
  -o, --out <file>        Write output to file instead of stdout
  -h, --help              Show this help

Examples:
  gen-pr-summary
  gen-pr-summary --out diff.md
  gen-pr-summary --pr 123
  gen-pr-summary -p 123 -c -o diff.md\n`);
  process.exit(0);
}

const prArgs = opts.pr ? [opts.pr] : [];

// Preconditions
if (!check("git", ["rev-parse", "--is-inside-work-tree"])) {
  console.error("Error: not inside a git repository.");
  process.exit(1);
}
if (!check("gh", ["auth", "status"])) {
  console.error("Error: gh is not authenticated. Run: gh auth login");
  process.exit(1);
}

// Fetch PR metadata
let pr;
try {
  pr = JSON.parse(
    run("gh", [
      "pr",
      "view",
      ...prArgs,
      "--json",
      "number,title,url,baseRefName,headRefName,author,body",
    ]),
  );
} catch {
  const branch =
    tryRun("git", ["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
  console.error(`Error: no open PR found for branch '${branch}'.`);
  process.exit(1);
}

const {
  number: prNumber,
  title,
  url,
  baseRefName: baseBranch,
  headRefName: headBranch,
  author,
  body,
} = pr;

const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];

let diff = tryRun("gh", ["pr", "diff", ...prArgs]);
if (diff && !opts["include-lockfile"]) {
  diff = diff
    .split(/^(?=diff --git )/m)
    .filter((section) => !LOCKFILES.some((lf) => section.startsWith(`diff --git a/${lf} b/${lf}`)))
    .join("");
}

let reviews = "",
  comments = "";
if (opts["include-comments"]) {
  comments = tryRun("gh", ["pr", "view", ...prArgs, "--comments"]);
  const reviewsRaw = tryRun("gh", [
    "pr",
    "view",
    ...prArgs,
    "--json",
    "reviews",
  ]);
  if (reviewsRaw) {
    reviews = JSON.parse(reviewsRaw)
      .reviews.map((r) => {
        const header = `- [${r.state}] @${r.author.login} (${r.submittedAt})`;
        return r.body
          ? `${header}:\n  ${r.body.replace(/\n/g, "\n  ")}`
          : header;
      })
      .join("\n");
  }
}

const repo =
  tryRun("gh", ["repo", "view", "--json", "name", "--jq", ".name"]) ||
  tryRun("git", ["rev-parse", "--show-toplevel"]).split("/").at(-1) ||
  "unknown";

const nowUtc = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const lines = [
  `# PR Changes\n`,
  `**Repo:** ${repo}`,
  `**PR:** #${prNumber} — ${title}`,
  `**URL:** ${url}`,
  `**Author:** @${author.login}`,
  `**Head:** ${headBranch}`,
  `**Base:** ${baseBranch}`,
  `**Generated:** ${nowUtc}\n`,
  `## Description\n`,
  body || "_No description_",
  "",
];

if (opts["include-comments"]) {
  lines.push(`## Reviews\n`, reviews || "_No reviews_", "");
  lines.push(
    `## Comments\n`,
    comments ? `\`\`\`\n${comments}\n\`\`\`` : "_No comments_",
    "",
  );
}

lines.push(
  `## Diff vs ${baseBranch}\n`,
  diff ? `\`\`\`diff\n${diff}\n\`\`\`` : "_No diff_",
);

const output = lines.join("\n") + "\n";

if (opts.out) {
  mkdirSync(dirname(opts.out), { recursive: true });
  writeFileSync(opts.out, output);
  console.error(`Wrote ${opts.out}`);
} else {
  process.stdout.write(output);
}
