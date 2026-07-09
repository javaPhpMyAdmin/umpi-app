# Skill Registry — umpi-app

Generated: 2026-07-09 by sdd-init

## Project Skills

No project-level skills are available on disk.
The `.agents/skills/` directory is empty. The `skills-lock.json` references skills from
GitHub sources (expo/skills, supabase/agent-skills, vercel-labs/agent-skills) but those
SKILL.md files are not present locally. Run `skill-registry` after fetching them to index.

## User Skills (opencode)

| Name | Description | Path | Scope |
|------|-------------|------|-------|
| branch-pr | Create Gentle AI pull requests with issue-first checks. Trigger: creating, opening, or preparing PRs for review. | `~/.config/opencode/skills/branch-pr/SKILL.md` | user |
| chained-pr | Trigger: PRs over 400 lines, stacked PRs, review slices. Split oversized changes into chained PRs that protect review focus. | `~/.config/opencode/skills/chained-pr/SKILL.md` | user |
| cognitive-doc-design | Design docs that reduce cognitive load. Trigger: writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs. | `~/.config/opencode/skills/cognitive-doc-design/SKILL.md` | user |
| comment-writer | Write warm, direct collaboration comments. Trigger: PR feedback, issue replies, reviews, Slack messages, or GitHub comments. | `~/.config/opencode/skills/comment-writer/SKILL.md` | user |
| customize-opencode | Use ONLY when the user is editing or creating opencode's own configuration. | `<built-in>` | user |
| go-testing | Trigger: Go tests, go test coverage, Bubbletea teatest, golden files. Apply focused Go testing patterns. | `~/.config/opencode/skills/go-testing/SKILL.md` | user |
| issue-creation | Create Gentle AI issues with issue-first checks. Trigger: creating GitHub issues, bug reports, or feature requests. | `~/.config/opencode/skills/issue-creation/SKILL.md` | user |
| judgment-day | Trigger: judgment day, dual review, adversarial review, juzgar. Run blind dual review, fix confirmed issues, then re-judge. | `~/.config/opencode/skills/judgment-day/SKILL.md` | user |
| skill-creator | Trigger: new skills, agent instructions, documenting AI usage patterns. Create LLM-first skills with valid frontmatter. | `~/.config/opencode/skills/skill-creator/SKILL.md` | user |
| skill-improver | Trigger: improve skills, audit skills, refactor skills, skill quality. Audit and upgrade existing LLM-first skills. | `~/.config/opencode/skills/skill-improver/SKILL.md` | user |
| work-unit-commits | Plan commits as reviewable work units. Trigger: implementation, commit splitting, chained PRs, or keeping tests and docs with code. | `~/.config/opencode/skills/work-unit-commits/SKILL.md` | user |

## Convention Files

| File | Path |
|------|------|
| AGENTS.md (project) | `AGENTS.md` |
| HANDOFF.md (session state) | `HANDOFF.md` |

## Registry Info

- User skill dirs scanned: `~/.config/opencode/skills/`
- Project skill dirs scanned: `.agents/skills/` (empty)
- Siblings skipped (SDD phases): sdd-apply, sdd-archive, sdd-design, sdd-explore, sdd-init, sdd-onboard, sdd-propose, sdd-spec, sdd-tasks, sdd-verify
- Siblings skipped (other): _shared, skill-registry
