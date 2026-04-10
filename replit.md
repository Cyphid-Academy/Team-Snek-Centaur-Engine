# Team Snek Centaur Platform

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
CLAUDE.md                  # Authoring instructions and spec status
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
