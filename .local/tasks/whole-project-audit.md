# Whole-project audit: missing systems & corrections

## What & Why
Grudge has grown to ~98 tasks across rendering, animation, combat, AI, editor, content pipeline, lighting, audio, and persistence. The proposed queue (33 items) is mostly small polish tasks, which makes it hard to see whether we're missing foundational systems, doubling up on others, or carrying dead code. This task produces a single written audit that answers three questions:

1. What systems/components is the codebase **supposed** to be using (per the patterns it has already adopted) but isn't, or is using inconsistently?
2. What's **broken, redundant, or dead** that should be cleaned up before more features land?
3. Which currently-proposed tasks are **duplicates, overlapping, or actually one bigger problem** that should be re-scoped?

The output is a report only. After review, a follow-up batch of concrete fix tasks will be proposed for approval.

## Done looks like
- A markdown report at `docs/audits/2026-05-project-audit.md` with these sections:
  - **Executive summary** (one screen, top 5–10 findings ranked by impact)
  - **System-by-system review** — for each major system (rendering, animation, combat, AI/navigation, editor, content/asset pipeline, lighting, audio, persistence, UI/accessibility, dev tooling), list: what's there, what's mature, what's stubbed, what's missing, what's inconsistent
  - **Cross-cutting issues** — duplicate folders (`controller/` vs `controllers/`), mockup-sandbox vs main client overlap, stubbed accessibility toggles, asset-manifest health, validate-model-manifest results, TODO/FIXME inventory, dead files/unused exports, broken asset references (textures/models referenced in code but missing on disk)
  - **Proposed-task triage** — group the 33 PROPOSED tasks into: keep as-is, merge with another, re-scope/rewrite, drop. For each grouping, name the underlying system gap it's pointing at (e.g. "tasks #44, #45, #47, #48, #50, #51 all point at a missing unified layered-animation/IK pose-blending system")
  - **Recommended fix plan** — prioritized list of follow-up tasks I should create, each with a one-line rationale and rough size (S/M/L). Grouped by theme so we can approve a batch at a time.
- All findings backed by file paths and line numbers, not vibes. Anything I claim is missing/broken is verifiable from a path in the report.
- A short "won't fix / out of scope" list so we don't keep rediscovering the same non-issues.

## Out of scope
- Writing or changing any game code, shaders, assets, or configs.
- Creating the follow-up fix tasks themselves — those come in a second round after you've reviewed the report.
- Performance profiling under load (would need a runtime harness; call out as a recommendation if warranted).
- Multiplayer/networking design — game is single-player by intent; only flagged if persistence/save code already half-assumes a server model.
- Security/threat modeling of the Express backend — separate concern.

## Steps
1. **Inventory pass** — walk `client/src/game/`, `client/src/lib/`, `client/src/admin/`, `server/`, `shared/`, `scripts/`, and the `Models/` + `client/public/{models,textures,sounds,maps,editor}/` asset trees. Produce a system-by-system inventory of what exists, with representative file paths.
2. **Run the existing health checks** — execute `validate-model-manifest.ts` (and any sibling validation scripts under `scripts/`) read-only, capture results, and grep for `TODO|FIXME|XXX|HACK|stub|mockup` across `client/src` and `server/` to build the issue list.
3. **Cross-reference assets** — for each asset path referenced in code, confirm the file exists on disk. List orphan assets (on disk but unreferenced) and broken references (referenced but missing).
4. **Identify duplicate/dead code** — confirm and characterize the `controller/` vs `controllers/` split, check whether `artifacts/mockup-sandbox` shares or duplicates code with `client/src`, look for unused exports, and flag anything that smells like two competing implementations of the same system.
5. **Map systems against the proposed-task queue** — for each of the 33 PROPOSED tasks, identify which system it touches and whether it's a symptom of a deeper missing component (e.g. several layered-animation tasks → missing pose-blending layer; several editor preset tasks → missing import/diff UX). Group accordingly.
6. **Identify missing components the codebase already implies** — when code references a system that's only half-built (e.g. `useCharacterModel` climb stubs, accessibility toggles marked no-op, `EnemyBehaviorTree` coverage gaps for monsters vs humanoids), call those out as concrete gaps with the file evidence.
7. **Write the report** to `docs/audits/2026-05-project-audit.md` following the structure in *Done looks like*. Keep the executive summary skimmable; put detail in the per-system sections.
8. **Draft the recommended fix plan** at the end of the report — a prioritized list of follow-up tasks with rationale and rough size, ready to be turned into project tasks in a second round once you approve.

## Relevant files
- `client/src/game`
- `client/src/game/controller`
- `client/src/game/controllers`
- `client/src/game/systems`
- `client/src/game/components`
- `client/src/game/dungeon`
- `client/src/game/islands`
- `client/src/lib/stores`
- `client/src/admin`
- `client/src/hooks/useCharacterModel.ts`
- `client/src/components`
- `client/src/pages`
- `client/public/models`
- `client/public/textures`
- `client/public/sounds`
- `client/public/editor`
- `Models/models`
- `server`
- `shared`
- `scripts`
- `scripts/lib`
- `artifacts/mockup-sandbox`
- `replit.md`
- `docs`
- `package.json`
