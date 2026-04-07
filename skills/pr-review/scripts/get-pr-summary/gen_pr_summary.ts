#!/usr/bin/env bun
import { $ } from "bun";
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";

interface Pr {
  number: number;
  title: string;
  url: string;
  baseRefName: string;
  headRefName: string;
  author: { login: string };
  body: string;
}

interface Review {
  state: string;
  author: { login: string };
  submittedAt: string;
  body: string;
}

function abort(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const { values: opts } = parseArgs({
  options: {
    pr: { type: "string", short: "p" },
    "include-comments": { type: "boolean", short: "c" },
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
  -o, --out <file>        Write output to file instead of stdout
  -h, --help              Show this help

Examples:
  gen-pr-summary
  gen-pr-summary --out diff.md
  gen-pr-summary --pr 123
  gen-pr-summary -p 123 -c -o diff.md\n`);
  process.exit(0);
}

const prRef = opts.pr ?? "";

// Preconditions
await $`git rev-parse --is-inside-work-tree`
  .quiet()
  .catch(() => abort("Error: not inside a git repository."));
await $`gh auth status`
  .quiet()
  .catch(() => abort("Error: gh is not authenticated. Run: gh auth login"));

// Fetch PR metadata
const pr: Pr =
  await $`gh pr view ${prRef} --json number,title,url,baseRefName,headRefName,author,body`
    .quiet()
    .json()
    .catch(async () => {
      const branch = await $`git rev-parse --abbrev-ref HEAD`
        .quiet()
        .text()
        .catch(() => "unknown");
      abort(`Error: no open PR found for branch '${branch.trim()}'.`);
    });

const {
  number: prNumber,
  title,
  url,
  baseRefName: baseBranch,
  headRefName: headBranch,
  author,
  body,
} = pr;

const diff = await $`gh pr diff ${prRef}`
  .quiet()
  .text()
  .catch(() => "");

let reviews = "",
  comments = "";
if (opts["include-comments"]) {
  comments = await $`gh pr view ${prRef} --comments`
    .quiet()
    .text()
    .catch(() => "");
  const { reviews: list }: { reviews: Review[] } = await $`gh pr view ${prRef} --json reviews`
    .quiet()
    .json()
    .catch(() => ({ reviews: [] }));
  reviews = list
    .map((r) => {
      const header = `- [${r.state}] @${r.author.login} (${r.submittedAt})`;
      return r.body ? `${header}:\n  ${r.body.replace(/\n/g, "\n  ")}` : header;
    })
    .join("\n");
}

const repo = await $`gh repo view --json name --jq .name`
  .quiet()
  .text()
  .catch(() =>
    $`git rev-parse --show-toplevel`
      .quiet()
      .text()
      .then((p) => p.trim().split("/").at(-1) ?? "unknown")
      .catch(() => "unknown"),
  );

const nowUtc = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const lines = [
  `# PR Changes\n`,
  `**Repo:** ${repo.trim()}`,
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

const outFile = opts.out;
if (outFile) {
  await writeFile(outFile, output);
  console.error(`Wrote ${outFile}`);
} else {
  process.stdout.write(output);
}
