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
- **Module 02 — platform-architecture**: Phase 1 (Requirements) drafted. Phase 2 (Design + Exported Interfaces) drafted. Design covers runtime topology (Section 2.9), SpacetimeDB game runtime (2.10), Convex platform runtime (2.11), Centaur Server runtime (2.12), Centaur Server library (2.13), shared engine codebase (2.14), human client topology (2.15), and Game Platform / Centaur Server boundary (2.16). Exported interfaces define runtime kinds, game record lifecycle types, data ownership boundaries, SpacetimeDB instance lifecycle contract, shared engine codebase contract, extension surface, security enforcement model, client connection topology, and web application boundary. REVIEW state: 2 open items (006 replay retrieval pattern, 007 spectator visibility semantics); 5 resolved (001–005 from Phase 1).
- **Module 03 — auth-and-identity**: Phase 1 (Requirements) drafted. Phase 2 (Design + Exported Interfaces) drafted. **Major OIDC auth redesign applied**: replaced HMAC admission tickets + `register` reducer with Convex-as-OIDC-issuer + `client_connected` lifecycle callback. SpacetimeDB access tokens are RS256-signed JWTs with `sub` claims (`centaur:{centaurTeamId}`, `operator:{operatorId}`, `spectator:{operatorId}`) and `aud` = gameId, validated by SpacetimeDB via OIDC discovery against Convex's platform-wide RSA public key. No per-instance secrets. Design covers identity model implementation (3.13), Google OAuth integration (3.14), per-Centaur-Team game credential as Ed25519-signed JWT via Convex Auth customJwt provider (3.15), game-start invitation protocol (3.16), Convex-as-OIDC-issuer for SpacetimeDB access tokens (3.17), in-game authorization via `client_connected` with JWT claim parsing and Agent derivation (3.18), admin role via environment variable (3.19), read-access principle and trust model (3.20), API key system with SHA-256 hash storage (3.21), and identity mapping / credential management (3.22). Exported interfaces define identity types, game credential claims, SpacetimeDB access token format, `parseSubClaim`/`deriveAgentFromSubClaim` contract, admin role check, API key validation, game-start invitation types, roster freeze contract, and credential independence invariant. DOWNSTREAM IMPACT notes flag constraints on [04] (`client_connected` implementation, `aud`/`sub` validation, role-based capabilities), [05] (credential issuance, OIDC endpoints, roster freeze, invitation orchestration), [06] (game credential scope verification), and [08] (invitation endpoint). REVIEW state: 1 open item (011 operatorId allocation strategy); 1 partially resolved (010 Convex-to-SpacetimeDB auth — client auth resolved via OIDC, privileged ops still deferred); 9 resolved (001–009 from Phase 1).
- **Module 04 — stdb-engine**: Phase 1 (Requirements) drafted. Requirements amended for OIDC auth redesign: 04-REQ-013 (no HMAC secret, receives gameId instead), 04-REQ-014 (game_config stores gameId for aud validation), 04-REQ-018–023 (register reducer → `client_connected` callback with JWT claim validation), 04-REQ-070 (JWT sub claim, not ticket role). REVIEW items 015/016 resolved as obsolete (no per-instance secrets). REVIEW item 011 decision updated (connection time via `client_connected`, not register reducer time).
- **Module 05 — convex-platform**: Phase 1 (Requirements) drafted. Requirements amended for OIDC auth redesign: 05-REQ-030 (operators obtain access tokens, not admission tickets), 05-REQ-032 step 5 (gameId instead of HMAC secret), 05-REQ-034 (platform-wide RSA key pair, not per-instance HMAC), 05-REQ-034a (new: OIDC discovery endpoints), 05-REQ-035 (access token issuance, not admission ticket issuance), 05-REQ-048 (access tokens, not admission tickets). REVIEW item 001 resolved as obsolete (no per-game secret to store).
- **Module 06 — centaur-state**: Phase 1 (Requirements) drafted.
- **Module 07 — bot-framework**: Phase 1 (Requirements) drafted. Terminology updated for OIDC auth redesign (admission ticket → access token in REVIEW items).
- **Module 08 — centaur-server-app**: Phase 1 (Requirements) drafted. Requirements amended for OIDC auth redesign: 08-REQ-003 (OIDC-validated access token), 08-REQ-009/009a (access token terminology), 08-REQ-081/086/089 (spectator access token, not admission ticket).
- **Module 09 — platform-ui**: Phase 1 (Requirements) drafted.
- **Module 02 — platform-architecture** was also amended for the OIDC auth redesign: connection models updated (RS256-signed JWT via OIDC), `hmacSecret` removed from `Game` interface and `initialize_game` params, security enforcement model updated, all "admission ticket" references replaced with "SpacetimeDB access token" terminology.
- Modules 01, 02, and 03 have completed Phase 2. Module 06 is next in the recommended Phase 2 authoring order (06 before 04 and 05, per SPEC-INSTRUCTIONS.md).

Update this list as modules advance.
