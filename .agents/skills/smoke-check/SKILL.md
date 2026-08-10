---
name: smoke-check
description: Run the critical-path smoke-test gate for this web game, including automated checks, build verification, targeted manual browser checks when needed, and a PASS or FAIL handoff verdict. Use after implementation and before manual QA or release review.
---

# Smoke-check adapter

1. Read `../../CLAUDE-CODEX-COMPAT.md` completely.
2. Read `../../../.claude/skills/smoke-check/SKILL.md` completely.
3. Translate its engine detection to this repository's TypeScript/Vite/Vitest web stack and use
   the current package scripts as the source of truth.
4. Do not claim manual checks passed unless they were actually performed. Write the shared smoke
   report only when requested or included in the QA handoff task.

