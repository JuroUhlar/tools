## Where agents load skills / instructions from?

### One folder for user-level `SKILL.md` skills (symlinks)

Use a single canonical tree: **`~/.agents/skills/<skill-name>/SKILL.md`** (matches the [Agent Skills](https://agentskills.io/) layout and Codex’s documented user path).

**Symlink these to that folder** (only if they don’t already contain skills you care about—back up or merge first):

- `~/.cursor/skills` → `~/.agents/skills`
- `~/.claude/skills` → `~/.agents/skills`

Do **not** also symlink `~/.config/opencode/skills` to the same place unless you confirm your OpenCode build dedupes by real path; it already loads `~/.agents/skills` natively, so an extra symlink is redundant and can duplicate listings.

```bash
mkdir -p ~/.agents/skills
ln -sfn ~/.agents/skills ~/.cursor/skills
ln -sfn ~/.agents/skills ~/.claude/skills
```

**Who picks up that one folder**

- ✓ **OpenAI Codex** — reads `~/.agents/skills` by default
- ✓ **OpenCode** — reads `~/.agents/skills` by default
- ✓ **Cursor** — via symlink `~/.cursor/skills` → `~/.agents/skills`
- ✓ **Claude Code** — via symlink `~/.claude/skills` → `~/.agents/skills`
- ✗ **VS Code + GitHub Copilot** — uses instructions (`*.md` rules), not `skills/*/SKILL.md`; same folder does not apply

**Repo-local skills** still need per-tool/project dirs (e.g. `.cursor/skills`, `.agents/skills`, `.claude/skills`, `.opencode/skills`) if you want team-scoped skills checked into git—this recipe is **user-level only**.

---

### Codex (Agent Skills + AGENTS.md)

Skills follow the [Agent Skills](https://agentskills.io/) layout (`SKILL.md` + optional `scripts/`, etc.).

- **Repo**
  - `.agents/skills` under cwd, parent folders, and `$REPO_ROOT` — scanned upward from where you launch Codex
  - Details: [Where to save skills](https://developers.openai.com/codex/skills)
- **User**
  - `$HOME/.agents/skills` — personal skills in any repo ([Customization](https://developers.openai.com/codex/concepts/customization))
- **Toggle / overrides**
  - `[[skills.config]]` in `~/.codex/config.toml` (e.g. disable a skill by path) — [Agent Skills](https://developers.openai.com/codex/skills)
- **Distribution**
  - [Plugins](https://developers.openai.com/codex/plugins/build); local adds via `$skill-installer`
- **Persistent prose (not skills)**
  - Repo `AGENTS.md` (incl. nested), global `~/.codex/AGENTS.md` — [Customization](https://developers.openai.com/codex/concepts/customization)

### Claude Code (skills + commands)

- **Project**
  - `.claude/skills/<skill-name>/SKILL.md`
  - Nested packages, e.g. `packages/foo/.claude/skills/`
- **User**
  - `~/.claude/skills/<skill-name>/SKILL.md`
- **Precedence when names clash**
  - Enterprise → personal → project (plugins: `plugin-name:skill-name`)
- **Docs**
  - [Extend Claude with skills](https://code.claude.com/docs/en/skills)

### Cursor (Agent Skills)

- **Project**
  - `.cursor/skills/<skill-name>/` — folder with `SKILL.md`
- **User (all workspaces)**
  - `~/.cursor/skills/<skill-name>/`
- **Docs**
  - [Agent Skills](https://cursor.com/docs/skills)
  - [Skill directories](https://cursor.com/docs/skills#skill-directories)

### OpenCode (Agent Skills)

Skills use the usual `skills/<name>/SKILL.md` layout and load on demand via OpenCode’s `skill` tool. Project dirs are discovered by walking up from the cwd to the git worktree.

- **Project**
  - `.opencode/skills/*/SKILL.md`
  - `.claude/skills/*/SKILL.md` (Claude-compatible)
  - `.agents/skills/*/SKILL.md` (agent-standard compatible)
- **Global**
  - `~/.config/opencode/skills/*/SKILL.md`
  - `~/.claude/skills/*/SKILL.md`
  - `~/.agents/skills/*/SKILL.md`
- **Permissions** (`opencode.json`, pattern keys like `internal-*`)
  - `allow` — skill loads immediately
  - `deny` — hidden from the agent
  - `ask` — prompt before load
- **Docs**
  - [Agent Skills](https://open-code.ai/docs/en/skills)
  - [Config](https://open-code.ai/docs/en/config)


