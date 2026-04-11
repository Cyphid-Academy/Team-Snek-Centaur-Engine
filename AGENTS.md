# Agent Context — Team Snek Centaur Platform

All AI agent context lives in this file. Both Claude and Replit Agent should read and modify this file for project context. Do not fragment context into tool-specific files.

> **Essential reading:** Before doing any spec work in this repo, read **[`SPEC-INSTRUCTIONS.md`](SPEC-INSTRUCTIONS.md)** in full. It defines the modular authoring process, phase gates, review protocol, and module dependency graph that govern all specification work. Every conversation that touches spec content must follow those rules.

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

- **Module 01 — game-rules**: Phase 1 (Requirements) approved, then substantially revised post-approval via 01-REVIEW-014 (frozen → start-of-turn wording), 01-REVIEW-015 (stacking removed, symmetric buff/debuff state model with ≤1-per-family invariant, derived `invulnerabilityLevel`/`isVisible` functions, team-wide family-scoped cancellation), and 01-REVIEW-016 (invisibility collector remains visible — correcting a formal-spec-only mistake that didn't match user intent). Phase 2 (Design + Exported Interfaces) drafted and updated to reflect all three rewrites. REVIEW state: 2 open items (012 game-config ranges, 013 `GameState` aggregate shape) awaiting human resolution; 5 resolved (010 source-attribution dissolved by 015, 011 module-local `Agent`, 014 frozen wording, 015 stacking/state-model redesign, 016 invisibility-collector visibility fix).
- **Module 02 — platform-architecture**: Phase 1 (Requirements) drafted.
- **Module 03 — auth-and-identity**: Phase 1 (Requirements) drafted.
- **Module 04 — stdb-engine**: Phase 1 (Requirements) drafted.
- **Module 05 — convex-platform**: Phase 1 (Requirements) drafted.
- **Module 06 — centaur-state**: Phase 1 (Requirements) drafted.
- **Module 07 — bot-framework**: Phase 1 (Requirements) drafted.
- **Module 08 — centaur-server-app**: Phase 1 (Requirements) drafted.
- **Module 09 — platform-ui**: Phase 1 (Requirements) drafted.
- Module 01 is the only module in Phase 2 so far.

Update this list as modules advance.
