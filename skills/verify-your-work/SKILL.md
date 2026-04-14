---
name: verify-your-work
description: Do maximum possible local verification before finishing a task. Use when you made project-wide changes or when the user asks you to "self-review", "check your work", "work independently", "close the loop", "keep going until fully confident".
---

Before handing work back:

## 1. Run deterministic checks

Find and run every relevant verification command you can discover in `package.json`, `Makefile`, CI config, or similar project files. Prefer repo-native `build`, `lint`, `typecheck`, `test`, and other checks.
Fix any issues you find.

## 2. Test manually

If the repo includes applications, servers, or runnable scripts, run them to manually test your changes from the consumer's POV

  a. For web apps, run and open them in a browser (Chrome DevTools MCP might be best) and test the changed flow end to end.
  b. For servers, start them and send representative requests.
  c. For scripts, run them with realistic test inputs.

Fix any high-confidence issues you find, report back if not sure.

## 3. Self-review and second opinion 

3. Spawn a fresh-context reviewer subagent (of yourself). 
4. Additionally, ask a different model for review. If you are Claude, use the Codex CLI to ask another model for a review. If you are Codex/GPT, use the Claude CLI. If that reviewer tool is unavailable, say so explicitly.
  - Codex from Claude: use `codex exec --full-auto -C "$PWD" -o /tmp/codex-review.txt "Review the current changes with fresh context. Focus on bugs, regressions, missing tests, and verification gaps. Read the repo state yourself before judging the change."`
  - Claude from Codex/GPT: use `claude -p "Review the current changes with fresh context. Focus on bugs, regressions, missing tests, and verification gaps. Read the repo state yourself before judging the change." > /tmp/claude-review.txt`
  - If either CLI needs different permission settings in your environment, adjust them, but keep the prompt focused on review rather than implementation.
    
Fix any high-confidence issues you find.

## 4. Summarize

Report what ran, what failed, what you could not verify, what you fixed, what you didn't fix.
