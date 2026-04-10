# Team Snek Centaur Platform

Team Snek is a team-based multiplayer snake game and the first title on Cyphid Academy's **Battle Bunker educational program** — a system designed to train players to collaborate with one another and AI. Each team is assigned a **Centaur Server**: a bot that controls all the team's snakes by default, with human operators selectively overriding individual snakes when their judgment adds value. There are no purely human teams.

## Architecture

The platform has three runtime layers:

- **SpacetimeDB** (per-game, transient): runs authoritative game logic as a TypeScript module. Turn resolution is simultaneous and ACID-transactional. A chess-timer system drives turn advancement. Real-time state sync to all clients happens via subscription queries; row-level security enforces snake invisibility.
- **Convex** (global, persistent): manages user accounts, rooms, game history, replays, Centaur Server registration, and per-team bot state (snake config, drives, heuristic parameters, interaction logs).
- **Centaur Servers** (per-team): subscribe to live game state, run bot computation, stage moves, and serve the operator UI to human teammates. Teams implement custom AI behaviour by plugging in **Drives** (goal weights) and **Preferences** into a provided bot framework.

The game engine (turn resolution, move validation, game state types) is a single TypeScript codebase shared across SpacetimeDB, Centaur Server, and web client.

## This Repository

This repo contains the **formal specification** for the platform, developed in a modular authoring process. Nine specification modules (in `specs/`) cover game rules, platform architecture, authentication, the SpacetimeDB engine, Convex platform, Centaur state, the bot framework, the Centaur Server web app, and the platform UI. The informal source spec lives in `informal-spec/`. See `SPEC-INSTRUCTIONS.md` for the authoring process and module dependency graph.

