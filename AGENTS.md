# Agent Context — Team Snek Centaur Platform

All AI agent context lives in this file. Both Claude and Replit Agent should read and modify this file for project context. Do not fragment context into tool-specific files.

> **Essential reading:** Before doing any spec work in this repo, read **[`SPEC-INSTRUCTIONS.md`](SPEC-INSTRUCTIONS.md)** in full. It defines the modular authoring process, phase gates, review protocol, and module dependency graph that govern all specification work. Every conversation that touches spec content must follow those rules.

## Spec Body vs REVIEW Items — No Journey Narration

The Requirements, Design, and Exported Interfaces sections of every spec module describe **only the current correct behaviour of the system**. They must not include the *semantic content* of states the spec used to be in: what an earlier draft said, what mechanism was considered and dropped, what field a removed type used to carry, what option among several was rejected. Inlining that content bloats the spec and — more importantly — primes readers (human or AI) with directions that are no longer the plan, fraying focus and inviting accidental regression to settled-and-rejected calls. The body must read as if the current text were the first and only version ever written.

Journey content — prior drafts, removed mechanisms, "we changed this because…" rationale, and the option-space behind a decision — belongs strictly in **resolved REVIEW items**, whose `Context` / `Question` / `Options` / `Decision` / `Rationale` format (see `SPEC-INSTRUCTIONS.md` §REVIEW Item Format / Resolution) exists precisely to carry it. Resolved REVIEW items will eventually be migrated out of the module files entirely so that they likewise do not pollute attention unless deliberately retrieved.

**Opaque pointers into resolved REVIEW items are allowed and valuable.** A trailing `(see resolved [MODULE-ID]-REVIEW-NNN)` or `See resolved [MODULE-ID]-REVIEW-NNN.` next to the current rule it settles is good practice: the pointer is a stable, low-attention reference that lets a curious reader fetch the journey on demand without forcing it into every reader's working memory. The rule is **the pointer is fine; the prior content the pointer would otherwise replace is not**. A clause that only *names* a resolved REVIEW item is allowed; a clause that *summarises* what the rejected option was, what the earlier draft said, or why the change was made is not (the REVIEW item itself carries that).

Concrete anti-patterns the agent must refuse to write into a module body:

- **Retired-with-explanation requirements**: `*(Retired — the original X rule no longer applies because Y was removed in favour of Z. ID not reused.)*`. Use `*(Retired. ID not reused. See resolved [MODULE-ID]-REVIEW-NNN.)*` and let the REVIEW item carry the substance.
- **Earlier-draft framing inside body text**: phrases of the form *"earlier drafts of …"*, *"previously …"*, *"formerly …"*, *"no longer needed"*, *"has been refined"*, *"is now exported"*, *"is now …"*, *"this replaces what we had before"*, *"originally we …"* — all narrate change rather than state current behaviour.
- **Narration of removed mechanisms**: paragraphs explaining what an abandoned field, type, structure, or phase used to do and why it is gone (e.g. "the reason per-source attribution is no longer needed is …"). The current rule stands on its own; the absence needs no obituary.
- **Anti-explanations**: `"There is no stacking …"`, `"No Phase 9d. … there are no cached fields to recompute"`, `"This is not a snapshot"`. State what *is*; do not enumerate what *isn't* in order to head off a misreading rooted in a prior draft.
- **In-body enumeration of rejected alternatives**: paragraphs of the form *"Alternative considered: X. Rejected because Y."* or *"Option A would have done X; we chose B instead."* — option-space narration belongs in the REVIEW item's `Options` and `Rationale` fields. An opaque pointer to the REVIEW item replaces the in-body enumeration cleanly.
- **Justifications inside requirements/design that belong in a REVIEW item's Rationale**: tail clauses of the form *"… because of X consideration that motivated the choice"*, *"… so that future editors don't think Y"*, *"… this is the right level of complexity"`. If the rationale is the journey of the decision, it belongs in the REVIEW item.

Pure forward-looking constraints on future editors (e.g. "any future phase that needs to mutate effect state mid-turn must either … or …") and present-tense justifications that are load-bearing for regression prevention (e.g. "`ceil` rather than `floor` so that `D = 1` still yields one fertile cell") are **not** journey narration and are appropriate in the body. The test is whether the clause describes the current/future contract or recounts the *content* of how the past contract differed.

## Project Overview

This repository contains the **formal specification** for the Team Snek Centaur Platform — a team-based multiplayer snake game designed for Cyphid Academy's Battle Bunker educational program. Players collaborate with an AI "Centaur Server" that controls their team's snakes by default, with human operators selectively overriding individual snakes.

This is a documentation-only repository. A simple Node.js/Express server renders the markdown specs as a navigable web application.

## Architecture

Three-runtime topology (specified, not yet implemented):
- **SpacetimeDB** (per-game): authoritative game logic in TypeScript
- **Convex** (global): user accounts, rooms, replays, bot state
- **Centaur Servers** (per-team): bot computation + operator UI

## Project Structure

```
README.md                  # Project overview
AGENTS.md                  # Canonical agent context (this file)
CLAUDE.md                  # Pointer → AGENTS.md + Claude Cowork specifics
replit.md                  # Pointer → AGENTS.md
SPEC-INSTRUCTIONS.md       # Modular spec authoring process and rules
informal-spec/             # Source informal specification documents
specs/                     # 9 formal specification modules (Phase 1 drafted)
  01-game-rules.md
  02-platform-architecture.md
  03-auth-and-identity.md
  04-stdb-engine.md
  05-convex-platform.md
  06-centaur-state.md
  07-bot-framework.md
  08-centaur-server-app.md
  09-platform-ui.md
server.js                  # Express server that renders specs as HTML
```

## Running the App

```bash
node server.js
```

Serves on port 5000. All markdown files are rendered with syntax highlighting and a dark-themed sidebar navigation.

## Tech Stack

- **Runtime**: Node.js 20
- **Server**: Express
- **Markdown rendering**: marked
- **Port**: 5000

## Deployment

Configured for autoscale deployment. Run command: `node server.js`

## Spec Authoring Status

Progress on the modular spec (see `SPEC-INSTRUCTIONS.md` for the phase/module framework):

- **Module 01 — game-rules**: Phase 2 complete. 0 REVIEW items open.
- **Module 02 — platform-architecture**: Phase 2 complete. 2 REVIEW items open (006, 007).
- **Module 03 — auth-and-identity**: Phase 2 complete. 1 REVIEW item open (011).
- **Module 04 — stdb-engine**: Phase 2 complete (including no-journey-narration sweep). 2 REVIEW items open (018, 020).
- **Module 05 — convex-platform**: Phase 2 complete. 0 REVIEW items open. (Spec body vs REVIEW items sweep applied.)
- **Module 06 — centaur-state**: Phase 2 complete. 0 REVIEW items open. (Spec body vs REVIEW items sweep applied.)
- **Module 07 — bot-framework**: Phase 2 complete. 0 REVIEW items open. (Spec body vs REVIEW items sweep applied.)
- **Module 08 — centaur-server-app**: Phase 2 complete. 2 REVIEW items open (022, 023).
- **Module 09 — platform-ui**: Phase 1 (Requirements) drafted. (Module absorbed into Module 08; retained as a redirect stub.)

Update this list as modules advance. Keep each entry to a single line — phase status and REVIEW count only. Detail about resolved items, cascades, and rationale belongs in the module files (in the resolved REVIEW item bodies), not here.
