# Module 02: Platform Architecture

## Requirements

### 2.1 Runtime Topology

**02-REQ-001**: The platform shall comprise exactly three runtime kinds: a **SpacetimeDB game runtime**, a **Convex platform runtime**, and **Snek Centaur Server runtimes**.

**02-REQ-002**: There shall be exactly one Convex deployment for the entire platform. All persistent platform state lives within this single deployment.

**02-REQ-003**: There shall be exactly one SpacetimeDB instance per started game. A SpacetimeDB instance is transient: it is provisioned when the game is launched from its Convex game record and torn down after the game ends. Unstarted game records (games in the pre-launch configuration phase) shall not have an associated SpacetimeDB instance.

**02-REQ-004**: SpacetimeDB instances shall be isolated from one another. No SpacetimeDB instance shall have read or write access to the state of any other SpacetimeDB instance.

**02-REQ-005**: A Centaur Team's captain shall nominate a Snek Centaur Server domain in the Centaur Team's platform configuration. No acceptance from the server is required — the captain unilaterally declares trust. A Centaur Team may change its nominated server domain at any time, subject to the existing mid-game freeze on team parameters (no changes while the team is participating in a game with `status = "playing"`).

**02-REQ-006**: Every Centaur Team that joins a game shall have a nominated Snek Centaur Server domain. The platform shall not support pure-human teams.

**02-REQ-052**: The relationship between Centaur Teams and Snek Centaur Servers shall be many-to-many over time: teams may switch servers between games, and multiple teams may nominate the same server. During any given game, each team plays from exactly one nominated server.

**02-REQ-053**: A single Snek Centaur Server shall be capable of hosting multiple Centaur Teams simultaneously during a game. Two Centaur Teams hosted on the same server MAY play in the same game. The platform specification shall explicitly state the trust implication: the server operator has full access to both teams' bot strategies and state during the game; players trusting a shared server accept this.

**02-REQ-054**: The reference Snek Centaur Server implementation shall enforce robust application-level tenant isolation for bot computation between Centaur Teams. Each team's bot compute shall not be able to read or interfere with another team's bot compute at the application level, even though the server operator could bypass this isolation.

---

### 2.2 Snek Centaur Server Lifecycle

**02-REQ-055**: Outside of active games, a Snek Centaur Server shall be a static web host. It shall serve the Snek Centaur Server web application to users. It shall hold no Convex credentials, no SpacetimeDB connections, and no active subscriptions of its own. All data displayed to users outside of active games shall come from the user's own direct Convex client connection, authenticated by the user's Google identity.

**02-REQ-056**: During a game, a Snek Centaur Server shall additionally run bot computation for each Centaur Team it has been invited to host. It shall use per-Centaur-Team game credentials (received from Convex at game start per [03]) to write to Convex (centaur subsystem state updates, action log entries) and connect to SpacetimeDB (move staging) on behalf of each hosted Centaur Team.

**02-REQ-057**: After a game ends, the per-Centaur-Team game credentials shall expire. The Snek Centaur Server shall return to being a static web host with no active backend connections of its own.

---

### 2.3 SpacetimeDB Game Runtime Responsibilities

**02-REQ-007**: The SpacetimeDB game runtime shall be the sole authoritative executor of game logic as defined by [01]. No other runtime shall execute turn resolution authoritatively.

**02-REQ-008**: Turn resolution within the SpacetimeDB runtime shall execute as a single atomic transaction per turn. Either all phases of [01-REQ-041] complete and are observable, or none are.

**02-REQ-009**: The SpacetimeDB runtime shall provide real-time state synchronization to connected clients without requiring per-turn polling. Clients shall observe state changes as they are committed.

**02-REQ-010**: The SpacetimeDB runtime shall filter invisible snakes ([01-REQ-023], [01-REQ-024]) from connections belonging to opponent teams such that opponent connections cannot observe their existence, position, or any derived state.

**02-REQ-011**: The SpacetimeDB runtime shall accept staged moves from authorized writers and shall apply last-write-wins semantics: the most recently written staged move for a given snake supersedes any earlier staged move for that snake within the same turn.

**02-REQ-012**: At the moment turn resolution fires, the SpacetimeDB runtime shall consume the current set of staged moves and clear them as part of the same atomic transaction that produces the new turn's state.

**02-REQ-013**: The complete record of game state across all turns shall be retained within the SpacetimeDB runtime for the lifetime of the game, in a form sufficient to reconstruct any prior turn's board without consulting any external system.

**02-REQ-014**: The SpacetimeDB runtime shall not require per-turn posting of game state to any external system during gameplay. Replay export occurs once at game end ([02-REQ-022]).

---

### 2.4 Convex Platform Runtime Responsibilities

**02-REQ-015**: The single Convex deployment shall be the sole persistent home of all platform state that must outlive any individual game, including but not limited to user accounts, Centaur Team records, room records, game records, replays, game configuration, and per-team Centaur subsystem state. (Specific table schemas are owned by [05] and [06].)

**02-REQ-016**: Convex shall host all identity and credential infrastructure for the platform. (The mechanisms — OAuth, game-start invitation, SpacetimeDB access token issuance via OIDC — are owned by [03].)

**02-REQ-017**: Convex shall be the sole authority for intra-team coordination state, including the mapping between human operators and the snakes they have selected, manual-mode flags, and per-snake operator state. The SpacetimeDB runtime shall have no concept of which human within a team is acting on which snake; SpacetimeDB authorization is at the team level only.

**02-REQ-018**: The system shall enforce that at most one human operator is the current selector of any given snake, and at most one snake is currently selected by any given operator. Enforcement is the responsibility of the runtime that owns selection state (Convex, per [02-REQ-017]).

**02-REQ-019**: Convex shall orchestrate the provisioning of a fresh SpacetimeDB instance at the moment a game is launched, and its teardown after the game ends. (The reducer signatures and provisioning API mechanics are owned by [03], [04], and [05].)

**02-REQ-020**: A SpacetimeDB instance shall not be reused across distinct games. Each launched game shall be served by its own freshly provisioned SpacetimeDB instance. This rule shall apply uniformly to every game-creation path — including the first game in a room, successor games auto-created after a previous game ends, and every round of a tournament — with no special-case exceptions.

**02-REQ-021**: A SpacetimeDB instance's lifetime shall be bounded to the lifetime of its game. After the game ends and replay data has been persisted ([02-REQ-022]), the instance shall be torn down.

**02-REQ-022**: At game end, Convex shall persist the complete game record by obtaining the complete game state log from the SpacetimeDB instance. Retrieval may follow any pattern permitted by [04-REQ-061] — Convex-pull, runtime-push, or bundling the record into the game-end notification of [04-REQ-061a] — at Design's discretion; 02 requires only that retrieval and persistence complete before SpacetimeDB instance teardown ([02-REQ-021]).

**02-REQ-022a**: Convex shall learn of a game's terminal state via a runtime-pushed notification delivered by the SpacetimeDB instance to Convex ([04-REQ-061a]). Convex shall not hold a live gameplay subscription to any SpacetimeDB instance; live gameplay state is consumed only by clients of the SpacetimeDB instance (Snek Centaur Servers per [02-REQ-056], human operators per [02-REQ-038], spectators per [02-REQ-041]). The specific notification mechanism is owned by [04]; Convex-side handling is owned by [05] per [05-REQ-038].

**02-REQ-050**: Prior to launch, a game's configuration shall exist as a mutable record in Convex and may be edited by permitted users. At launch, the configuration shall be frozen. Board generation parameters from the frozen config are consumed by Convex during board generation (see §2.14); only the dynamic gameplay parameters and the pre-computed initial game state are supplied to the newly provisioned SpacetimeDB instance. After launch, the game's configuration shall not be mutable.

**02-REQ-051**: Auto-creation of a successor game after a prior game ends is a Convex-level event. It shall produce a new unstarted, mutable Convex game record inheriting configuration from its predecessor. No SpacetimeDB instance shall be provisioned as part of successor auto-creation; a SpacetimeDB instance is provisioned only when the successor is subsequently launched ([02-REQ-019]). This behavior is uniform across tournament and non-tournament paths.

---

### 2.5 Snek Centaur Server Runtime Responsibilities

**02-REQ-023**: During a game, a Snek Centaur Server shall hold a live WebSocket subscription to the game's SpacetimeDB instance for each Centaur Team it hosts, observing game state in real time. A server hosting multiple Centaur Teams in the same game shall maintain separate SpacetimeDB WebSocket connections per team, each authenticated with that team's SpacetimeDB access token.

**02-REQ-024**: During a game, a Snek Centaur Server shall use per-Centaur-Team game credentials (received at game start per [03]) to write Centaur subsystem state to Convex for each hosted team, including snake configuration, active Drives, and bot parameters.

**02-REQ-025**: A Snek Centaur Server shall run bot computation for every snake belonging to each Centaur Team it hosts that is not currently controlled by a human operator.

**02-REQ-026**: A Snek Centaur Server shall stage bot-computed moves into the game's SpacetimeDB instance via the staged-moves mechanism ([02-REQ-011]), using the appropriate per-team SpacetimeDB connection.

**02-REQ-027**: A Snek Centaur Server shall write Centaur subsystem state updates (including snake state map updates, worst-case-world annotations, heuristic outputs) and action log entries to Convex using per-Centaur-Team game credentials.

**02-REQ-028**: A Snek Centaur Server shall serve the unified Snek Centaur Server web application over HTTP to authenticated users. The web application covers both platform-level concerns (rooms, lobbies, team management, spectating, leaderboards, profiles) and team-internal concerns (heuristic configuration, bot parameters, live operator interface, replays).

**02-REQ-029**: A Snek Centaur Server shall expose a healthcheck endpoint that the platform can call to verify availability. The platform shall call this endpoint when displaying server health status in the lobby for each Centaur Team's nominated server, and for pre-game readiness checks.

---

### 2.6 Snek Centaur Server Library

**02-REQ-030**: The platform shall provide a Snek Centaur Server library that packages the bot framework ([07]), the game invitation handler ([03]), the healthcheck endpoint contract, the Convex schema bindings, and data-layer APIs. The library does not include the web application itself; the web application is delivered as a separate forkable reference implementation repository (see 02-REQ-032a).

**02-REQ-031**: The Snek Centaur Server library is the architecturally assumed implementation path for teams. The platform's design and documentation shall treat library-based Snek Centaur Servers as the supported case and shall not be obligated to accommodate teams that build a server without the library.

**02-REQ-032**: The Snek Centaur Server library shall expose a bounded extension surface limited to: (a) custom Drive implementations and (b) custom Preference implementations. No other library-mediated extension points are sanctioned. The web application is not an extension point of the library.

**02-REQ-032a**: The platform shall maintain a Snek Centaur Server reference implementation repository containing the full web application (all Svelte components covering both platform and team-internal pages), example Drives, example Preferences, and team Convex schema. Teams obtain and customise the web application by forking this repository and modifying their fork directly — full source ownership, not a bounded extension point. Correctness is enforced by Convex function contracts ([06]) and security enforcement points external to the library (02-REQ-033).

**02-REQ-033** *(negative)*: The platform shall not rely on teams' use of the Snek Centaur Server library for any security or correctness invariant. All invariants that bound what a Snek Centaur Server may do shall be enforced by mechanisms external to the library — specifically by SpacetimeDB authorization rules (OIDC-validated JWT + `client_connected` checks), Convex function contracts, and SpacetimeDB access token validation ([03]) — and shall hold equally against a Snek Centaur Server that bypasses the library entirely.

---

### 2.7 Shared Engine Codebase

**02-REQ-034**: The platform shall provide a single shared TypeScript codebase that exports the domain type vocabulary defined by [01] (Section 1.1) and a turn-resolution implementation conforming to the eleven-phase pipeline of [01-REQ-041] through [01-REQ-052].

**02-REQ-035**: The SpacetimeDB game runtime shall consume the shared engine codebase to perform authoritative turn resolution. It shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

**02-REQ-036**: The Snek Centaur Server library shall consume the shared engine codebase to perform game-state simulation and world-tree exploration ([07]). It shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

**02-REQ-037**: Web clients (the Snek Centaur Server web application) shall consume the shared engine codebase for pre-validation, simulation, and rendering of board state. They shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

---

### 2.8 Human Client Topology

**02-REQ-038**: Human operators shall connect directly to their game's SpacetimeDB instance via WebSocket for purposes of (a) observing game state subject to invisibility filtering ([02-REQ-010]) and (b) staging direct moves for human-controlled snakes.

**02-REQ-039**: Human operators shall additionally connect to Convex via the standard Convex client to read and write Centaur subsystem state, Drive assignments, and selection state.

**02-REQ-040**: The operator interface shall be served to a team's human members from the Snek Centaur Server that the team has nominated.

**02-REQ-041**: Human spectators shall connect directly to a game's SpacetimeDB instance via WebSocket using a spectator SpacetimeDB access token ([03]). Spectator connections shall be subject to invisibility filtering ([02-REQ-010]): because spectators are affiliated with no team, they are treated as opponents of every team for RLS purposes and shall not see any team's invisible snakes.

---

### 2.9 Unified Snek Centaur Server Web Application

**02-REQ-058**: The Snek Centaur Server web application shall be the single web application for all platform interactions. There is no separate Game Platform Server or Game Platform Client. Every Snek Centaur Server serves the same web application, backed by the same Convex backend, and a user sees the same platform data regardless of which server they visit (subject to the read-access principle in [03]).

**02-REQ-059**: The Snek Centaur Server web application scope shall include both platform-level concerns (home and navigation, Centaur Team management, room browsing and creation, room lobbies and game configuration, live spectating, replay viewing, player profiles, team profiles, leaderboards) and team-internal competitive concerns (heuristic configuration, bot parameter configuration, live operator interface, team-perspective replay viewing with sub-turn timeline resolution). (Detailed feature requirements are owned by [08].)

**02-REQ-043**: The Centaur Team management page shall be limited to team identity, server nomination, member management, and timekeeper assignment. It shall not expose any team-internal competitive configuration such as bot parameters, heuristic parameters, or Drive management.

**02-REQ-060**: The reference Snek Centaur Server deployment (e.g., snek-centaur.cyphid.org) shall be the socially canonical entry point operated by Cyphid, but it shall have no special technical privileges. It shall use the same Convex APIs as any other Snek Centaur Server.

**02-REQ-061**: The platform code shall be open source. Other communities may run their own Convex deployments with their own canonical Snek Centaur Servers.

---

### 2.10 Read-Access Principle

**02-REQ-062**: A user's read access to Convex data shall be determined entirely by their Google identity, with no conditioning on which Snek Centaur Server they are visiting. Any Snek Centaur Server serves the same platform UI and the user sees the same data regardless of server.

**02-REQ-063**: The platform specification shall explicitly state the trust implication: a malicious Snek Centaur Server could inject client-side code that exfiltrates the user's Convex-readable data. This is an accepted trust trade-off — users should only log into servers they trust, similar to any web application.

---

### 2.11 Replay Unification

**02-REQ-064**: Replays shall be presented through a unified viewer interface, not separate "platform replay" and "team replay" viewers.

**02-REQ-065**: By default, the replay viewer shall provide access to every Centaur Team's within-turn actions (action log entries, stateMap snapshots, etc.).

**02-REQ-066**: If a game is marked as private, viewers shall only see within-turn events of Centaur Teams they belonged to during that game.

**02-REQ-067**: Admin users (as defined by [03]) shall see all within-turn events regardless of privacy settings.

---

## Design

### 2.12 Runtime Topology and Data Ownership

Satisfies 02-REQ-001, 02-REQ-002, 02-REQ-003, 02-REQ-004, 02-REQ-005, 02-REQ-006, 02-REQ-052, 02-REQ-053, 02-REQ-054, 02-REQ-055, 02-REQ-056, 02-REQ-057.

The platform is composed of exactly three runtime kinds, each with a distinct lifecycle and data ownership scope:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Convex (Single Deployment)                      │
│  Persistent state: users, teams, rooms, games, replays, centaur state  │
│  Identity & credential infrastructure (owned by [03])                  │
│  Game lifecycle orchestration                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌─────────────────────────────────────────────────┐
│ SpacetimeDB Instance│  │ Snek Centaur Server                             │
│ (per started game)  │  │ (any number; each serves the unified web app)   │
│                     │  │                                                 │
│ Transient game state│  │ Outside games: static web host only             │
│ Authoritative rules │  │ During games: bot compute for hosted teams      │
│ Append-only log     │  │ Serves the unified web application to users     │
└─────────────────────┘  └──────────────────────┬──────────────────────────┘
                                          serves│
                               ┌────────────────▼───────────────────┐
                               │ Snek Centaur Server Web Application│
                               │ (platform + team-internal pages)   │
                               └────────────────────────────────────┘
```

**Runtime connections:**

| From | To | Protocol | Purpose | Lifecycle |
|------|-----|----------|---------|-----------|
| SpacetimeDB | Convex | HTTP (discrete) | Game-end notification, replay export | Per-game |
| Snek Centaur Server | Convex | Convex client (per-team game credential) | Centaur subsystem state (write) | Game-time only |
| Snek Centaur Server | SpacetimeDB | WebSocket (per hosted team) | Game state subscription, move staging | Game-time only |
| Web Client (operator) | SpacetimeDB | WebSocket | Game state subscription, move staging, turn declaration | Per-game session |
| Web Client (operator) | Convex | Convex client (Google OAuth) | Centaur subsystem state (selection, drives, action log) | Persistent user session |
| Web Client (spectator) | SpacetimeDB | WebSocket (read-only) | Game state subscription (spectating) | Per-game session |
| Web Client (any) | Convex | Convex client (Google OAuth) | Platform state (reactive game/room/profile updates) | Persistent user session |

**Data ownership boundaries**:

| Runtime | Owns | Lifetime |
|---------|------|----------|
| **Convex** | All persistent platform state: user accounts, Centaur Team records, room records, game records, replays, game configuration, per-team Centaur subsystem state (snake config, drives, bot params, action log) | Permanent (single deployment) |
| **SpacetimeDB instance** | Transient game state: board, snake states, items, staged moves, time budgets, turn events — all as an append-only log sufficient for full game reconstruction | Bounded to a single game: provisioned at launch, torn down after game end + replay persist |
| **Snek Centaur Server** | No persistent state of its own. Outside games: serves static web app only, holds no credentials or subscriptions. During games: holds per-Centaur-Team game credentials, reads game state from SpacetimeDB, reads/writes Centaur subsystem state to Convex. Compute state (game tree cache, bot working memory) is ephemeral and per-team-isolated | Operated by anyone; active bot compute only during games |

**Instance isolation** (02-REQ-004). Each SpacetimeDB instance is deployed as an independent module instance with its own database. No cross-instance data access exists at the SpacetimeDB platform level. This isolation is load-bearing for security: a compromised server authenticated to game X cannot read or write game Y's state.

**Centaur Team server nomination** (02-REQ-005, 02-REQ-006, 02-REQ-052). A Centaur Team's captain nominates a Snek Centaur Server domain in the team's platform configuration. No acceptance from the server is required — the captain unilaterally declares trust. The relationship is many-to-many over time: teams can switch servers between games, and multiple teams can nominate the same server. During any given game, each team plays from exactly one nominated server. The platform enforces that a team cannot join a game without a nominated server domain.

**Multi-tenancy** (02-REQ-053, 02-REQ-054). A single Snek Centaur Server can host multiple Centaur Teams simultaneously during a game. Two teams hosted on the same server may play in the same game. The trust implication is explicit: the server operator has full access to both teams' bot strategies and state during the game. The reference implementation enforces application-level tenant isolation — each team's bot compute context is isolated so that one team's code cannot read or interfere with another team's state at the application level. However, this isolation is a best-effort application-level boundary; the server operator could bypass it.

**Snek Centaur Server lifecycle** (02-REQ-055, 02-REQ-056, 02-REQ-057). A Snek Centaur Server has two modes:

1. **Static host mode** (outside games): Serves the web application to users. The server itself holds no Convex credentials, no SpacetimeDB connections, and no active subscriptions. All data displayed to users comes from the user's own direct Convex client connection authenticated by their Google identity. The server is a pure web host in this mode.

2. **Game-time mode** (during games): In addition to serving the web application, the server runs bot computation for each Centaur Team it has been invited to host. It uses per-Centaur-Team game credentials (pushed to it by Convex at game start) to write to Convex and connect to SpacetimeDB on behalf of each hosted team. When the game ends, the credentials expire and the server returns to static host mode.

### 2.13 SpacetimeDB Game Runtime Design

Satisfies 02-REQ-007 through 02-REQ-014.

**Authoritative turn resolution** (02-REQ-007, 02-REQ-008). The SpacetimeDB module imports the shared engine codebase ([02-REQ-035]) and invokes `resolveTurn()` (from Module 01's exported interface, Section 3.8) inside a `resolve_turn` reducer. Because SpacetimeDB reducers execute as single ACID transactions, the entire eleven-phase pipeline either completes and commits or is rolled back entirely. No other runtime calls `resolveTurn()` authoritatively — the Snek Centaur Server library uses it for simulation only (02-REQ-036), and web clients use it for pre-validation and rendering only (02-REQ-037). The SpacetimeDB module does **not** call `generateBoardAndInitialState()` — board generation is performed by Convex before the STDB instance is provisioned (see §2.14).

**Real-time synchronization** (02-REQ-009). SpacetimeDB provides automatic real-time state synchronization to connected clients via subscription queries. When a reducer commits new rows (e.g., new `snake_states` entries after turn resolution), all subscribers whose subscription queries match the new data receive updates without polling. This is a platform-provided capability of SpacetimeDB, not custom application code.

**Invisibility filtering** (02-REQ-010). Row-Level Security (RLS) on the snake state data filters rows where the snake's derived `visible` value (per [01-REQ-023]) is `false` from connections belonging to opponent teams. The RLS rule cross-references the querying connection's team membership (established during registration) against the snake's `centaurTeamId`. Same-team connections see all snakes regardless of visibility. The RLS mechanism is owned by [04]; this module specifies the architectural requirement that filtering occurs at the data access layer within SpacetimeDB, not at the application layer in clients. This ensures that even a Snek Centaur Server that bypasses the library cannot observe invisible opponent snakes, satisfying 02-REQ-033's security model.

**Staged moves and last-write-wins** (02-REQ-011, 02-REQ-012). A mutable `staged_moves` table keyed by `snakeId` holds at most one staged move per snake. Any authorized writer (Snek Centaur Server or human operator for the snake's team) can upsert into this table; the most recent write wins. At turn resolution, the `resolve_turn` reducer reads all staged moves, passes them to `resolveTurn()` as `stagedMoves: ReadonlyMap<SnakeId, StagedMove>`, and clears the table — all within the same ACID transaction (02-REQ-008). The `StagedMove.stagedBy` field (from Module 01's exported `Agent` type) is captured before clearing, for inclusion in `snake_moved` turn events (per [01-REQ-052]).

**Append-only game log** (02-REQ-013, 02-REQ-014). The SpacetimeDB schema is organized as an append-only log: turn-keyed tables (`snake_states`, `turn_events`, `item_lifetimes`, `time_budget_states`, `turns`) append new rows each turn without mutating prior rows. Static tables (`game_config`, `board`, `centaur_team_permissions`) are written once at initialization. This structure enables any prior turn's board state to be reconstructed directly via a turn-number query, without consulting Convex or any external system. At game end, the complete log is exported to Convex for persistent replay storage (02-REQ-022); no per-turn posting is needed during gameplay. The specific table schemas and query patterns are owned by [04].

### 2.14 Convex Platform Runtime Design

Satisfies 02-REQ-015 through 02-REQ-022a, 02-REQ-050, 02-REQ-051.

**Persistent state home** (02-REQ-015). All state that must outlive a game lives in the single Convex deployment. The Convex schema is partitioned between platform-wide tables (owned by [05]) and Centaur-subsystem tables (owned by [06]). Both table sets live in the same Convex schema namespace and share a single transactional boundary, which is why the "exactly one Convex deployment" constraint (02-REQ-002) is load-bearing — downstream modules rely on cross-table transactional consistency (e.g., enforcing selection invariants across `snake_config` rows atomically).

**Identity infrastructure** (02-REQ-016). Convex hosts all authentication mechanisms: Google OAuth for humans, game-start invitation flow for Snek Centaur Servers, and SpacetimeDB access token issuance with RS256 signing validated via OIDC discovery. The specific mechanisms are owned by [03]; module 02 establishes that Convex is the sole host.

**Selection discipline** (02-REQ-017, 02-REQ-018). The mapping of human operators to snakes (selection state) is owned by Convex, not SpacetimeDB. SpacetimeDB authorizes at the team level only — any connection authenticated as a member of team T can stage moves for any snake belonging to T. The at-most-one-operator-per-snake and at-most-one-snake-per-operator invariants (02-REQ-018) are enforced by Convex function contracts in the Centaur subsystem (owned by [06]). This separation means SpacetimeDB's authorization model is simple (team-scoped), while fine-grained operator coordination is handled by Convex where the Centaur subsystem state already lives.

**Game record lifecycle** (02-REQ-050, 02-REQ-051). A game record in Convex progresses through three states:

```typescript
type GameStatus = 'not-started' | 'playing' | 'finished'
```

1. **`not-started`**: The game record exists in Convex with a mutable configuration. Permitted users may edit configuration parameters. No SpacetimeDB instance exists. This is the state after room creation, after successor auto-creation (02-REQ-051), and before launch.

2. **`playing`**: At launch, the configuration is frozen (becomes immutable), the board is generated by Convex (or a previously locked-in board preview is used), a fresh SpacetimeDB instance is provisioned (02-REQ-019), and the pre-computed initial game state plus dynamic gameplay parameters are supplied to the `initialize_game` reducer. The game record stores the SpacetimeDB instance URL for client connection. The transition from `not-started` to `playing` is irreversible.

3. **`finished`**: The game has ended. The SpacetimeDB instance has pushed a game-end notification to Convex (02-REQ-022a). Convex has obtained the complete game log and persisted it as replay data (02-REQ-022). The SpacetimeDB instance is torn down (02-REQ-021).

**SpacetimeDB instance provisioning** (02-REQ-019, 02-REQ-020). At game launch, Convex:

1. Freezes the game configuration (02-REQ-050).
2. Generates the board: if the room owner has locked in a board preview, uses that exact board; otherwise, runs `generateBoardAndInitialState()` from the shared engine codebase ([02-REQ-035]) as pure TypeScript directly within a Convex mutation to produce a fresh initial game state. Bounded-retry feasibility logic ([01-REQ-061]) runs within this Convex mutation; failure produces a structured error surfaced reactively to the room owner, and provisioning does not proceed.
3. Provisions a fresh SpacetimeDB instance by submitting the pre-compiled WASM module binary (retrieved from Convex file storage) to the self-hosted SpacetimeDB management API (`POST /v1/database` with the WASM binary in the request body), authenticated per [03-REQ-048]. This single operation creates the database and deploys the module.
4. Calls the `initialize_game` reducer with the pre-computed initial game state (cell terrain, snake starting positions, initial items), the game seed, the dynamic gameplay parameters (potion/food spawn rates, hazard damage, timer budgets, turn caps, etc.), the game-end notification callback URL, and team membership. No per-instance secret is seeded — SpacetimeDB validates client connections via OIDC discovery against the Convex platform's public key. Convex calls the STDB reducer via SpacetimeDB's HTTP API (`POST /v1/database/{name}/call/{reducer_name}` with JSON body and bearer token auth) from a Convex HTTP action.
5. Sends game invitations to each participating Centaur Team's nominated server domain (per [03]).
6. Upon acceptance by all servers, updates the game record with the instance URL and transitions status to `playing`.

Each game gets its own freshly provisioned instance (02-REQ-020). This applies uniformly to all game-creation paths: first game in a room, successor games, tournament rounds. The provisioning API mechanics and reducer signatures are owned by [04] and [05].

**Parameter split**. Game configuration parameters divide into two categories based on where they are consumed:

| Category | Examples | Consumed by | Passed to STDB? |
|----------|----------|-------------|-----------------|
| Board generation parameters | Board dimensions, hazard %, fertile ground density/clustering, snake count per team, parity | Convex, as inputs to `generateBoardAndInitialState()` | No — their output (a concrete initial game state) is what STDB receives |
| Dynamic gameplay parameters | Food spawn rate, potion spawn rates, hazard damage, max health, timer budgets, max turns, turn caps | STDB, as runtime configuration during gameplay | Yes — passed alongside the pre-computed initial game state at init time |

Board generation parameters are consumed entirely by Convex during board generation and never reach STDB. Dynamic gameplay parameters are forwarded to STDB at init time alongside the pre-computed initial game state.

**Convex→STDB reducer calling mechanism**. SpacetimeDB exposes an HTTP REST API: `POST /v1/database/{name}/call/{reducer_name}` with a JSON array body and bearer token authentication. A Convex HTTP action can call STDB reducers directly — no WebSocket connection, no intermediary service needed. This mechanism is used for Convex's privileged STDB interactions: game initialization ([05-REQ-032]), replay export retrieval ([04-REQ-061]), and game-end notification subscription ([04-REQ-061a]).

**Game-end notification and replay persistence** (02-REQ-022, 02-REQ-022a). Convex does not hold a live subscription to any SpacetimeDB instance during gameplay. Instead, when the SpacetimeDB instance detects a terminal game state (via Phase 10 of turn resolution), it pushes a notification to Convex via a mechanism owned by [04]. Upon receiving the notification, Convex:

1. Obtains the complete append-only game log from the SpacetimeDB instance.
2. Persists the log as replay data in the `replays` table.
3. Updates the game record with final scores and transitions status to `finished`.
4. Triggers SpacetimeDB instance teardown (02-REQ-021).
5. Auto-creates a successor game if applicable (02-REQ-051).

The retrieval pattern (Convex-pull vs. runtime-push vs. bundled in notification) is at [04]/[05]'s discretion per the requirement.

**Successor game auto-creation** (02-REQ-051). After a game ends, Convex creates a new `not-started` game record in the same room, inheriting configuration from the predecessor. No SpacetimeDB instance is provisioned — the successor remains in the `not-started` state until explicitly launched. This is uniform across tournament and non-tournament paths; tournament mode simply chains launches automatically after the configured interlude, rather than waiting for manual launch.

### 2.15 Snek Centaur Server Runtime Design

Satisfies 02-REQ-023 through 02-REQ-029, 02-REQ-053, 02-REQ-054, 02-REQ-055, 02-REQ-056, 02-REQ-057.

**Lifecycle modes**. A Snek Centaur Server operates in two modes:

1. **Static host mode** (02-REQ-055, 02-REQ-057): The server serves the unified web application (HTML, JS, CSS) over HTTP. It holds no Convex credentials, no SpacetimeDB connections, and no active subscriptions. Users who visit the server authenticate directly with Convex using their Google identity; all platform data is fetched via the user's own Convex client connection in the browser.

2. **Game-time mode** (02-REQ-056): When Convex invites the server to host a Centaur Team for a game (via the game-start invitation flow defined in [03]), the server activates bot computation for that team. It maintains per-team state:

| Per-Team Resource | Purpose |
|-------------------|---------|
| Game credential (from invitation) | Authenticates Convex writes for this team's centaur subsystem |
| SpacetimeDB WebSocket connection | Game state subscription and move staging for this team |
| Bot computation context | Game tree cache, working memory, anytime pipeline for this team's snakes |

**Multi-tenant per-team subscription model** (02-REQ-023, 02-REQ-024). During a game, the server maintains separate subscriptions per hosted Centaur Team:

- **SpacetimeDB**: One WebSocket connection per hosted team, each authenticated with that team's SpacetimeDB access token (RS256-signed JWT obtained via the game credential per [03], validated by SpacetimeDB via OIDC). Each connection subscribes to game state tables filtered by RLS and stages bot-computed moves via the `stage_move` reducer.

- **Convex**: Writes to the team's Centaur subsystem state using the per-team game credential received in the invitation. The server writes state updates (snake state maps, worst-case worlds, annotations, heuristic outputs) and action log entries.

**Bot computation** (02-REQ-025). The Snek Centaur Server runs the bot framework ([07]) for every snake belonging to each hosted Centaur Team that is not currently in manual mode with a human operator's staged move taking precedence. Bot computation for each team runs in an isolated context (02-REQ-054). Compute scheduling prioritizes automatic-mode snakes, then selected-manual snakes, then unselected-manual snakes (owned by [07]).

**Tenant isolation** (02-REQ-054). The reference implementation isolates each hosted Centaur Team's bot computation such that:
- Each team's game tree cache, working memory, and subscription data are held in separate data structures.
- No application-level code path allows one team's bot context to read another team's state.
- Each team's SpacetimeDB connection and Convex credential are independently managed.

This is application-level isolation. The server operator has access to the process and could bypass it; the explicit trust model (02-REQ-053) acknowledges this.

**Web application serving** (02-REQ-028). The server serves the unified Snek Centaur Server web application to all authenticated users, regardless of whether a game is in progress. The web application covers both platform pages and team-internal pages (02-REQ-058, 02-REQ-059).

**Healthcheck** (02-REQ-029). The Snek Centaur Server exposes a `GET /healthcheck` endpoint. The platform calls this endpoint to display server health status in the lobby for each Centaur Team's nominated server domain, and for pre-game readiness checks.

**Game invitation handling**. The server exposes a well-known endpoint for receiving game invitations from Convex (per [03]). The reference implementation auto-accepts all invitations by default. A server-side configuration file allows whitelisting by player email or Centaur Team ID. The default config has no restrictions (accept all). If no whitelist is configured, any team that nominates the server and initiates a game will consume its compute resources.

### 2.16 Snek Centaur Server Library Design

Satisfies 02-REQ-030 through 02-REQ-033.

**Library composition** (02-REQ-030). The Snek Centaur Server library is a TypeScript package that bundles:

| Component | Source Module | Purpose |
|-----------|--------------|---------|
| Bot framework | [07] | Drive/Preference evaluation, game tree cache, anytime submission pipeline, softmax decision |
| Game invitation handler | [03] | `POST /.well-known/snek-game-invite` endpoint, credential management, invitation acceptance/rejection |
| Healthcheck handler | [02] | `GET /healthcheck` endpoint implementation |
| Convex schema bindings | [05], [06] | Typed client for reading/writing Centaur subsystem state |
| Data-layer APIs | [05], [06], [08] | Stable interface for reading game, Centaur, and operator state; consumed by the web app |
| Shared engine codebase | [01] via [02-REQ-034] | Domain types and turn-resolution for simulation |
| Multi-tenant runtime | [02] | Per-team credential management, connection lifecycle, tenant isolation |

The web application is **not** bundled in the library. It is delivered as a separate forkable reference implementation repository (02-REQ-032a).

**Supported implementation path** (02-REQ-031). The Snek Centaur Server library is the architecturally assumed way to build a Snek Centaur Server. Platform documentation, example code, and support workflows treat library-based servers as the standard case. Teams that bypass the library and implement a server from scratch must handle game invitations, healthcheck, Convex state management, multi-tenant bot computation, and SpacetimeDB connection management independently. The platform is not obligated to accommodate non-library implementations — bugs or integration issues arising from bypassing the library are the team's responsibility. This does not affect security invariants, which are enforced externally regardless of library use (02-REQ-033).

**Extension surface** (02-REQ-032). The library exposes exactly two extension points:

```typescript
interface CentaurServerConfig {
  readonly drives: ReadonlyArray<DriveRegistration>
  readonly preferences: ReadonlyArray<PreferenceRegistration>
}
```

- **(a) Custom Drive implementations**: Teams register `Drive<T>` implementations conforming to [07]'s exported interface. Each Drive has a target type (`Snake` or `Cell`), scoring function, and eligible-targets predicate.
- **(b) Custom Preference implementations**: Teams register `Preference` implementations conforming to [07]'s exported interface. Preferences are directionless heuristics (no target).

No other extension points exist. The library does not expose hooks for overriding game invitation handling, healthcheck, bot scheduling, or the anytime submission pipeline.

**Web application: forkable reference implementation** (02-REQ-032a). The web application is maintained as a separate reference implementation repository, not as part of the library. The reference implementation is built with Svelte 5 and uses shadcn-svelte as its component library. Teams fork this repository to obtain the full unified web application (both platform pages and team-internal pages), example Drives and Preferences, and team Convex schema. Customisation is unbounded — teams have full source ownership over their fork. The stable interface between the library and the web application is the data-layer API surface (see [08-REQ-076]); correctness is enforced externally by Convex function contracts ([06]) and security enforcement points (02-REQ-033).

**Security independence** (02-REQ-033). The platform's security invariants are enforced entirely outside the library:

| Invariant | Enforcement point |
|-----------|-------------------|
| Move staging restricted to team's snakes | SpacetimeDB `stage_move` reducer validates team membership via `centaur_team_permissions` table |
| Invisible snakes hidden from opponents | SpacetimeDB RLS filters at the data layer |
| Connection authentication | SpacetimeDB validates RS256-signed JWT via OIDC; `client_connected` checks `aud` and `sub` claims |
| Selection discipline (≤1 operator per snake) | Convex function contracts in [06] |
| Game credential scope (per-team, per-game) | Convex validates credential scope on every write |

A Snek Centaur Server that bypasses the library entirely and speaks the raw SpacetimeDB WebSocket protocol + Convex HTTP API is bound by the same invariants. The library provides convenience, not security.

### 2.16a Repository and Package Topology

Satisfies 02-REQ-030, 02-REQ-032, 02-REQ-032a, 02-REQ-034.

**Platform monorepo.** The platform is developed in a single monorepo that contains:

- The **shared game engine** package (e.g., `@snek-centaur/engine`) — domain types and turn-resolution logic consumed by all runtimes (02-REQ-034).
- The **Snek Centaur Server library** package (e.g., `@snek-centaur/server-lib`) — bot framework, game invitation handler, healthcheck, Convex bindings, multi-tenant runtime, and data-layer APIs (02-REQ-030).
- Platform infrastructure code (Convex functions, SpacetimeDB modules) that is not published as npm packages.

Both the shared engine and the Snek Centaur Server library are published to npm from this monorepo.

**Reference implementation repository.** A separate repository (e.g., `snek-centaur-server`) contains:

- The complete unified web application — all Svelte components implementing [08], covering both platform-level and team-internal pages.
- Example Drive and Preference implementations demonstrating the library's extension surface.
- Team Convex schema and configuration scaffolding.
- Server-side configuration for game invitation whitelisting.
- A dependency on the published `@snek-centaur/server-lib` and `@snek-centaur/engine` packages.

This repository is maintained by the platform team and serves as the canonical starting point for Snek Centaur Server operators.

**Fork-based onboarding.** Teams and server operators obtain the web application by forking the reference implementation repository. Within their fork, they have full source ownership: they may modify, replace, or extend any Svelte component, add pages, change layouts, or restructure the UI as they see fit. The library's data-layer API surface ([08-REQ-076]) is the stable interface between `@snek-centaur/server-lib` and the web app. Correctness invariants are enforced externally by Convex function contracts ([06]) and security enforcement points (02-REQ-033), not by the UI layer.

### 2.16b SpacetimeDB Module WASM Compilation Target

Satisfies 02-REQ-035.

The SpacetimeDB game module ([04]) is authored as TypeScript source within the platform monorepo. It imports the shared engine codebase (`@snek-centaur/engine`) for domain types and `resolveTurn()`, and uses SpacetimeDB's TypeScript module SDK for table definitions, reducer declarations, and lifecycle callbacks.

**WASM compilation.** The module is compiled to a WebAssembly binary using SpacetimeDB's build toolchain (e.g., `spacetime build`). The WASM binary encapsulates the complete game engine module: all table schemas, all reducers, all lifecycle callbacks, and the embedded shared engine codebase. The resulting binary is the sole deployment artifact for game instance provisioning — there is no separate "deploy module" step after instance creation.

**Build pipeline.** The platform build pipeline (used in both development and production) performs the following steps:

1. Compiles the SpacetimeDB TypeScript module source to a WASM binary using SpacetimeDB's build toolchain.
2. Uploads the resulting WASM binary to the target Convex deployment's file storage, making it available for game provisioning by [05].

In development, the target Convex instance corresponds to the current development branch's deployment. In production, it corresponds to the production Convex deployment. The upload uses a Convex HTTP action or internal mutation authenticated as the platform build system.

The WASM binary is versioned implicitly by the build pipeline — each build produces a new binary that replaces the previous one in Convex file storage. At game-creation time, [05] retrieves the current binary from file storage and includes it in the single-step `POST /v1/database` provisioning request (§2.14 step 3).

### 2.17 Shared Engine Codebase Design

Satisfies 02-REQ-034 through 02-REQ-037.

**Codebase structure**. The shared engine is a single TypeScript package (e.g., `@snek-centaur/engine`) that re-exports Module 01's domain types and entry points:

```typescript
export {
  Direction, CellType, ItemType, BoardSize, EffectFamily, EffectState,
  Cell, SnakeId, CentaurTeamId, ItemId, TurnNumber, CentaurTeamDocId, OperatorId,
  Agent, BOARD_DIMENSIONS, invulnerabilityLevel, isVisible,
  PotionEffect, SnakeState, ItemState, Board, CentaurTeamClockState,
  GameConfig, GameOutcome, TurnEvent, DeathCause,
  BoardGenerationFailure, StagedMove, Rng, rngFromSeed, subSeed,
  generateBoardAndInitialState, resolveTurn,
} from './game-rules'
```

**Consumer contexts**. The codebase runs in three distinct environments:

| Consumer | Runtime Context | Usage | Authority |
|----------|----------------|-------|-----------|
| SpacetimeDB game module | SpacetimeDB TypeScript module runtime | `resolveTurn()` inside `resolve_turn` reducer | **Authoritative for turn resolution** — only execution whose `resolveTurn()` output becomes committed game state |
| Convex platform runtime | Convex mutation runtime | `generateBoardAndInitialState()` executed as pure TypeScript within a Convex mutation for authoritative pre-game board generation — no external calls, no delegation to any other system | **Authoritative for board generation** — output becomes the initial game state passed to STDB |
| Snek Centaur Server library | Node.js (or Deno/Bun) server | `resolveTurn()` for simulation/world-tree exploration; domain types for state interpretation | **Simulation only** — output used for bot decisions, never committed directly |
| Web clients (Snek Centaur Server web app) | Browser | Domain types for rendering; `resolveTurn()` for pre-validation and animation prediction; `invulnerabilityLevel()` / `isVisible()` for display logic | **Display only** — output used for rendering, never committed |

**Compatibility constraint**. Because the codebase executes in three different JavaScript runtimes, it must:
- Use only ECMAScript standard library APIs (no Node.js-specific APIs, no browser-specific APIs).
- Export pure functions with no side effects beyond the `Rng` state parameter.
- Use the specified BLAKE3 implementation for `subSeed()` (per Module 01 DOWNSTREAM IMPACT note 4), which must be available as a dependency in all three environments.
- Use the flat `ReadonlyArray<CellType>` board encoding with `y * width + x` indexing (per Module 01 DOWNSTREAM IMPACT note 3).

**Rationale for single codebase vs. separate implementations**. A single codebase eliminates the class of bugs where the authoritative server and simulation clients disagree on game rules. Given that SpacetimeDB's TypeScript module support runs standard ECMAScript, there is no technical barrier to sharing. The alternative — separate implementations in each consumer — would require continuous parity testing and triple the maintenance surface for any rule change.

### 2.18 Human Client Topology Design

Satisfies 02-REQ-038 through 02-REQ-041.

**Operator dual-connection model** (02-REQ-038, 02-REQ-039, 02-REQ-040). The Snek Centaur Server web application is served by the team's nominated Snek Centaur Server. Each human operator's browser client maintains two simultaneous connections during gameplay:

```
Operator Browser
├── WebSocket → SpacetimeDB instance
│   ├── Subscribe: game state (filtered by RLS)
│   ├── Call: stage_move(snakeId, direction)
│   └── Call: declare_turn_over(centaurTeamId)
│
└── Convex client → Convex deployment
    ├── Subscribe: Centaur subsystem state (selection, drives, bot params, heuristics)
    ├── Mutate: selection state (select/deselect snake, toggle manual mode)
    ├── Mutate: Drive assignments (add, remove, reweight)
    └── Mutate: action log (append action entries)
```

The SpacetimeDB connection provides low-latency game state and real-time move staging. The Convex connection provides Centaur subsystem state (which is not in SpacetimeDB) and supports the operator coordination features (selection, Drive management, action logging). Both connections authenticate independently: the SpacetimeDB connection uses an RS256-signed JWT issued by Convex and validated via OIDC ([03]), and the Convex connection uses the operator's Google OAuth session.

**Spectator connection model** (02-REQ-041). When spectating a game, the browser client connects to:

```
Spectator Browser
├── WebSocket → SpacetimeDB instance (read-only)
│   └── Subscribe: game state (filtered by RLS, no reducer calls)
│
└── Convex client → Convex deployment
    └── Subscribe: platform state (game record, room state)
```

The SpacetimeDB connection uses a spectator access token ([03]) — an RS256-signed JWT with `sub: "spectator:{operatorId}"` (where `operatorId` is the Convex `users._id` string) — that authorizes subscription queries but does not authorize any reducer calls (no `stage_move`, no `declare_turn_over`). Spectating connections are subject to the same RLS invisibility filtering as opponent team connections — spectators cannot see invisible snakes of any team (02-REQ-010). The Convex connection provides reactive platform state updates (game record status, room state). Outside of spectating, the web client uses only its Convex client connection for platform features (rooms, profiles, leaderboards).

**Operator web app serving** (02-REQ-040). The operator interface is served by the team's nominated Snek Centaur Server. The server serves static assets (HTML, JS, CSS) over HTTP and the browser client establishes the dual connections described above. Since every Snek Centaur Server serves the same unified web application, a user can visit any server for platform pages; the operator interface for a specific team is accessed via the server that team has nominated.

### 2.19 Unified Web Application Design

Satisfies 02-REQ-058, 02-REQ-059, 02-REQ-043, 02-REQ-060, 02-REQ-061, 02-REQ-062, 02-REQ-063, 02-REQ-064 through 02-REQ-067.

**Single unified application**. There is no separate Game Platform Server or Game Platform Client. Every Snek Centaur Server serves the same unified web application built with Svelte 5 and shadcn-svelte. The application covers:

| Scope | Pages |
|-------|-------|
| **Platform-level** | Home/navigation, Centaur Team management (identity, server nomination, member management, timekeeper assignment), room browsing/creation, room lobby/game config, live spectating, unified replay viewer, player profiles, team profiles, leaderboards |
| **Team-internal** | Heuristic config, bot parameter config, live operator interface, game history |

All platform data is accessed via the user's own Convex client connection, authenticated by their Google identity. The read-access principle (02-REQ-062) ensures users see the same data regardless of which Snek Centaur Server they visit.

**Replay unification** (02-REQ-064 through 02-REQ-067). The replay viewer is a single interface providing:
- Turn-level board state and event log for all viewers.
- Within-turn action timeline (action log entries, stateMap snapshots) for each Centaur Team.
- Privacy gating: for private games, viewers only see within-turn events of teams they belonged to during that game.
- Admin override: admin users see all within-turn events regardless of privacy.

**Team management boundary** (02-REQ-043). The Centaur Team management page exposes only identity, server nomination, member management, and timekeeper assignment. Bot parameters, heuristic configuration, and Drive management are team-internal pages accessible only to team members through the operator interface.

**Reference deployment** (02-REQ-060). The reference Snek Centaur Server deployment (e.g., snek-centaur.cyphid.org) is the socially canonical entry point but has no special technical privileges. It uses the same Convex APIs as any other Snek Centaur Server.

**Open source** (02-REQ-061). The platform code is open source. Other communities may run their own Convex deployments with their own canonical Snek Centaur Servers.

**Shared UI stack rationale**. The Svelte 5 + shadcn-svelte choice applies to the reference implementation — teams that fork the app (02-REQ-032a) have full source ownership and may replace the UI framework entirely.

---

## Exported Interfaces

This section is the minimal contract module 02 exposes to downstream modules (03, 04, 05, 06). Any type or concept not listed here is a module-internal detail and may change without impacting downstream modules.

### 3.1 Runtime Kind Enumeration

Motivated by 02-REQ-001.

```typescript
export const enum RuntimeKind {
  SpacetimeDB = 'spacetimedb',
  Convex = 'convex',
  SnekCentaurServer = 'snek_centaur_server',
}
```

### 3.2 Game Record Lifecycle Types

Motivated by 02-REQ-003, 02-REQ-019, 02-REQ-020, 02-REQ-021, 02-REQ-050, 02-REQ-051.

```typescript
export type GameStatus = 'not-started' | 'playing' | 'finished'

export interface GameRecordLifecycle {
  readonly status: GameStatus
  readonly spacetimeDbUrl: string | null
}
```

Downstream modules ([05]) use `GameStatus` to model the game record's state machine in Convex. The `spacetimeDbUrl` is `null` when `status === 'not-started'`, populated when `status === 'playing'`, and retained for reference when `status === 'finished'` (until teardown completes).

**State transitions** (exported as an architectural constraint, not a runtime type):

```
not-started ──[launch + invitations accepted]──► playing ──[game-end + replay persist]──► finished
```

- `not-started → playing`: Config is frozen (02-REQ-050), board generated by Convex (or locked-in preview used), fresh SpacetimeDB instance provisioned (02-REQ-019, 02-REQ-020) and initialised with pre-computed initial game state plus dynamic gameplay parameters, game invitations sent to nominated servers and accepted.
- `playing → finished`: Game-end notification received from SpacetimeDB (02-REQ-022a), replay persisted (02-REQ-022), instance torn down (02-REQ-021).
- No backward transitions. `not-started → finished` is not valid (a game must be launched before it can end).

### 3.3 Data Ownership Boundaries

Motivated by 02-REQ-002, 02-REQ-013, 02-REQ-015, 02-REQ-017, 02-REQ-055, 02-REQ-056.

Exported as architectural constraints that downstream modules must respect:

| Data Category | Owner | Constraint |
|---------------|-------|------------|
| All persistent platform state | Convex (single deployment, 02-REQ-002) | Downstream modules [05], [06] define schemas within the single Convex namespace |
| Transient game state (board, snakes, items, moves, clock, events) | SpacetimeDB instance (per game, 02-REQ-003) | [04] defines the schema; data does not outlive the instance except via replay export |
| Game state log for replay | SpacetimeDB during gameplay → Convex after game end | [04] defines the append-only schema; [05] defines the Convex `replays` table |
| Selection state (operator↔snake mapping) | Convex (02-REQ-017) | [06] enforces the at-most-one invariant (02-REQ-018); SpacetimeDB has no concept of selection |
| Identity & credentials | Convex (02-REQ-016) | [03] defines mechanisms; all auth flows terminate at Convex |
| Snek Centaur Server persistent state | None (02-REQ-055) | Servers hold no persistent credentials or state; game credentials are ephemeral and per-team-per-game |

### 3.4 SpacetimeDB Instance Lifecycle Contract

Motivated by 02-REQ-003, 02-REQ-019, 02-REQ-020, 02-REQ-021, 02-REQ-022.

```typescript
export interface SpacetimeDbInstanceLifecycle {
  readonly provision: {
    readonly trigger: 'game-launch'
    readonly freshPerGame: true
    readonly wasmModuleBinary: 'pre-compiled WASM binary retrieved from Convex file storage'
    readonly inputFromConvex: {
      readonly preComputedInitialState: {
        readonly board: Board
        readonly snakes: ReadonlyArray<SnakeState>
        readonly items: ReadonlyArray<ItemState>
      }
      readonly dynamicGameplayParams: DynamicGameplayParams
      readonly centaurTeamMembership: ReadonlyArray<CentaurTeamMembershipRecord>
      readonly gameId: string
      readonly gameSeed: Uint8Array
      readonly gameEndCallbackUrl: string
    }
  }
  readonly teardown: {
    readonly trigger: 'replay-persisted'
    readonly precondition: 'game-ended AND replay data obtained by Convex'
  }
}

export interface CentaurTeamMembershipRecord {
  readonly centaurTeamId: CentaurTeamId
  readonly members: ReadonlyArray<{ readonly identity: string; readonly role: 'human' | 'bot' }>
}
```

`Board`, `SnakeState`, and `ItemState` are re-exported from Module 01 (Section 3.2). `DynamicGameplayParams` is the subset of `GameConfig` (Module 01 Section 3.3) that affects runtime gameplay behaviour — food spawn rate, potion spawn rates, hazard damage, max health, timer budgets, max turns, turn caps — as opposed to board generation parameters. `CentaurTeamId` is re-exported from Module 01 (Section 3.1). The pre-computed initial state is produced by Convex running `generateBoardAndInitialState()` from the shared engine codebase; STDB does not call that function.

**DOWNSTREAM IMPACT**: [04] must implement the `initialize_game` reducer to accept a pre-computed initial game state (board, snakes, items) plus dynamic gameplay parameters, game seed, and game-end callback URL — not the full `GameConfig` and not a game seed for generation purposes (the seed is forwarded for turn-resolution randomness and replay export, not for board generation). [05] must implement the provisioning orchestration that supplies them, including running `generateBoardAndInitialState()` within a Convex mutation, retrieving the pre-compiled WASM binary from Convex file storage and including it in the `POST /v1/database` provisioning request, the game-start invitation flow to nominated servers, and the HTTP action that calls the STDB init reducer. [05] must store the current WASM module binary in Convex file storage, uploaded by the platform build pipeline at build/deploy time. [03] must define the game credential generation and the SpacetimeDB access token format validated via OIDC.

### 3.5 Shared Engine Codebase Contract

Motivated by 02-REQ-034, 02-REQ-035, 02-REQ-036, 02-REQ-037.

The shared engine codebase re-exports all of Module 01's exported interfaces (Section 3 of `01-game-rules.md`). The authoritative list of exports:

```typescript
export {
  // Enums and branded types (01 §3.1)
  Direction, CellType, ItemType, BoardSize, EffectFamily, EffectState,
  Cell, SnakeId, CentaurTeamId, ItemId, TurnNumber, CentaurTeamDocId, OperatorId, Agent,
  BOARD_DIMENSIONS, invulnerabilityLevel, isVisible,

  // State shapes (01 §3.2)
  PotionEffect, SnakeState, ItemState, Board, CentaurTeamClockState,

  // Game configuration (01 §3.3)
  GameConfig,

  // Game outcome (01 §3.4)
  GameOutcome,

  // Turn event schema (01 §3.5)
  TurnEvent, DeathCause,

  // Board generation failure (01 §3.6)
  BoardGenerationFailure,

  // Randomness primitives (01 §3.7)
  Rng, rngFromSeed, subSeed,

  // Entry points (01 §3.8)
  StagedMove, generateBoardAndInitialState, resolveTurn,
}
```

**Consumer contract**:

| Consumer | Module | What it imports | Authority level |
|----------|--------|-----------------|-----------------|
| SpacetimeDB game module | [04] | Full export set; `resolveTurn()` for authoritative turn resolution | Authoritative (turn resolution) |
| Convex platform runtime | [05] | Full export set; `generateBoardAndInitialState()` for authoritative pre-game board generation executed as pure TypeScript within a Convex mutation | Authoritative (board generation) |
| Snek Centaur Server library | [07], [08] | Full export set; `resolveTurn()` for simulation | Simulation only |
| Snek Centaur Server web app | [08] | Domain types for rendering; `resolveTurn()` for pre-validation | Display only |

**DOWNSTREAM IMPACT**: The shared engine codebase must use only ECMAScript standard library APIs (no runtime-specific APIs) because it runs in SpacetimeDB's TypeScript runtime, Node.js/Deno/Bun (Snek Centaur Servers), and browsers. The BLAKE3 dependency for `subSeed()` (per Module 01 DOWNSTREAM IMPACT note 4) must be available in all three environments.

### 3.6 Snek Centaur Server Extension Surface

Motivated by 02-REQ-030, 02-REQ-032, 02-REQ-032a.

```typescript
export interface CentaurServerExtensionSurface {
  readonly drives: 'custom Drive<T> implementations per [07] interface'
  readonly preferences: 'custom Preference implementations per [07] interface'
}
```

The extension surface is intentionally described by reference to downstream module interfaces rather than defining concrete types here, because the `Drive<T>` and `Preference` type signatures are owned by [07]. Module 02 exports only the *architectural fact* that exactly these two extension points exist and no others.

The web application is not an extension point of the library. Teams customise the web application by modifying their fork of the reference implementation repository (02-REQ-032a). The stable interface between the library and the web application is the data-layer API surface exported by `@snek-centaur/server-lib` (see [08-REQ-076]).

**DOWNSTREAM IMPACT**: [07] must export `Drive<T>` and `Preference` type signatures that teams program against. [08] defines the reference web application delivered in the forkable repository; it does not export a customisation interface. The stable team-facing interface is the data-layer API surface exported by the server library. No additional library extension points may be added without revising 02-REQ-032.

### 3.7 Security Enforcement Points

Motivated by 02-REQ-033.

Exported as architectural constraints specifying where each security invariant is enforced:

```typescript
export interface SecurityEnforcementModel {
  readonly moveStagingAuthorization: {
    readonly enforcedBy: 'SpacetimeDB stage_move reducer'
    readonly scope: 'team-level (any team member can stage for any team snake)'
    readonly mechanism: 'centaur_team_permissions table lookup against connection Identity'
  }
  readonly invisibilityFiltering: {
    readonly enforcedBy: 'SpacetimeDB RLS'
    readonly mechanism: 'Row filter on snake visibility flag × connection team membership'
  }
  readonly connectionAuthentication: {
    readonly enforcedBy: 'SpacetimeDB OIDC validation + client_connected callback'
    readonly mechanism: 'RS256 JWT signature verified via OIDC discovery; aud/sub claims checked in client_connected'
  }
  readonly selectionInvariants: {
    readonly enforcedBy: 'Convex function contracts'
    readonly scope: 'at-most-one-operator-per-snake, at-most-one-snake-per-operator'
  }
  readonly gameCredentialScope: {
    readonly enforcedBy: 'Convex credential validation'
    readonly mechanism: 'Per-Centaur-Team, per-game credential with bounded lifetime'
  }
}
```

**DOWNSTREAM IMPACT**: [03] must implement game-start invitation and credential issuance such that credentials are per-team and per-game scoped. [04] must implement `stage_move` authorization and RLS filtering. [05]/[06] must implement selection invariant enforcement in Convex function contracts. None of these invariants may depend on the Snek Centaur Server library being used — they must hold against any client that speaks the raw protocol.

### 3.8 Client Connection Topology

Motivated by 02-REQ-038, 02-REQ-039, 02-REQ-041, 02-REQ-055, 02-REQ-056.

```typescript
export interface OperatorConnectionModel {
  readonly spacetimeDb: {
    readonly transport: 'WebSocket'
    readonly authMechanism: 'RS256-signed JWT validated via OIDC (sub: operator:{operatorId})'
    readonly capabilities: readonly ['subscribe_game_state', 'stage_move', 'declare_turn_over']
  }
  readonly convex: {
    readonly transport: 'Convex client (HTTP/WebSocket)'
    readonly authMechanism: 'Google OAuth session'
    readonly capabilities: readonly ['subscribe_centaur_state', 'mutate_selection', 'mutate_drives', 'append_action_log']
  }
}

export interface SpectatorConnectionModel {
  readonly spacetimeDb: {
    readonly transport: 'WebSocket'
    readonly authMechanism: 'RS256-signed JWT validated via OIDC (sub: spectator:{operatorId})'
    readonly capabilities: readonly ['subscribe_game_state']
  } | null
  readonly convex: {
    readonly transport: 'Convex client (HTTP/WebSocket)'
    readonly authMechanism: 'Google OAuth session'
    readonly capabilities: readonly ['subscribe_platform_state']
  }
}

export interface SnekCentaurServerConnectionModel {
  readonly spacetimeDb: {
    readonly transport: 'WebSocket (one per hosted Centaur Team)'
    readonly authMechanism: 'RS256-signed JWT validated via OIDC (sub: centaur:{centaurTeamDocId})'
    readonly capabilities: readonly ['subscribe_game_state', 'stage_move', 'declare_turn_over']
  }
  readonly convex: {
    readonly transport: 'Convex client (per-team game credential)'
    readonly authMechanism: 'Per-Centaur-Team game credential (received via game invitation)'
    readonly capabilities: readonly ['mutate_snake_config', 'append_action_log']
  }
  readonly lifecycle: {
    readonly outsideGames: 'No active connections; static web host only'
    readonly duringGames: 'Per-team connections as described above'
  }
}
```

**DOWNSTREAM IMPACT**: [03] must issue distinct SpacetimeDB access tokens for operators (`sub: "operator:{users._id}"`), bot participants (`sub: "centaur:{centaur_teams._id}"`), and spectators (`sub: "spectator:{users._id}"`). [04] must enforce capability restrictions based on the `sub` prefix — spectators cannot call `stage_move` or `declare_turn_over`. [08] must implement the operator dual-connection flow, the spectator connection flow, and the multi-tenant server connection management.

### 3.9 Snek Centaur Server Lifecycle Contract

Motivated by 02-REQ-055, 02-REQ-056, 02-REQ-057, 02-REQ-052, 02-REQ-053.

```typescript
export interface SnekCentaurServerLifecycle {
  readonly outsideGames: {
    readonly role: 'static web host'
    readonly convexCredentials: null
    readonly spacetimeDbConnections: null
    readonly subscriptions: null
  }
  readonly duringGames: {
    readonly role: 'static web host + bot computation host'
    readonly perTeam: {
      readonly gameCredential: 'per-Centaur-Team, per-game, bounded lifetime'
      readonly spacetimeDbConnection: 'WebSocket, authenticated per-team RS256-signed JWT via OIDC'
      readonly convexWrites: 'centaur subsystem state via game credential'
    }
    readonly multiTenancy: {
      readonly maxTeams: 'unbounded (limited by compute capacity)'
      readonly sameGameTeams: 'permitted (explicit trust model)'
      readonly tenantIsolation: 'application-level in reference implementation'
    }
  }
}

export interface ServerNominationModel {
  readonly nominatedBy: 'Centaur Team captain'
  readonly acceptance: 'not required (unilateral declaration of trust)'
  readonly relationship: 'many-to-many over time, one-to-one per team per game'
  readonly mutability: 'changeable except during playing status'
}
```

**DOWNSTREAM IMPACT**: [03] must define the game-start invitation flow that delivers per-team game credentials to nominated server domains. [05] must store `nominatedServerDomain` as a field on the Centaur Team record (not a separate server registry table). The `centaur_servers` table is eliminated — server identity is not a platform concept.

### 3.10 Unified Web Application Boundary

Motivated by 02-REQ-058, 02-REQ-059, 02-REQ-043, 02-REQ-064 through 02-REQ-067.

```typescript
export interface UnifiedWebApplicationScope {
  readonly platformPages: readonly [
    'home_navigation', 'centaur_team_management', 'server_nomination',
    'member_management', 'timekeeper_assignment', 'room_browsing', 'room_creation',
    'room_lobby', 'game_configuration', 'live_spectating', 'unified_replay_viewer',
    'player_profiles', 'centaur_team_profiles', 'leaderboards'
  ]
  readonly centaurTeamInternalPages: readonly [
    'heuristic_configuration', 'bot_parameter_configuration',
    'live_operator_interface', 'game_history'
  ]
  readonly centaurTeamManagementExcludes: readonly [
    'bot_parameters', 'heuristic_configuration', 'drive_management'
  ]
  readonly replayUnification: {
    readonly defaultAccess: 'all teams within-turn actions visible'
    readonly privateGames: 'only own team within-turn actions visible'
    readonly adminOverride: 'all within-turn actions visible regardless of privacy'
  }
}
```

**DOWNSTREAM IMPACT**: [08] must implement the unified web application covering both platform-level and team-internal pages. The `centaur_team_management` page must not expose bot parameters, heuristic configuration, or Drive management. The replay viewer must implement privacy gating and admin override for within-turn action access.

### 3.11 DOWNSTREAM IMPACT Notes

1. **Single Convex namespace.** Modules [05] and [06] both define Convex tables within the same single deployment (02-REQ-002). They must coordinate to avoid naming collisions. Per SPEC-INSTRUCTIONS.md §Cross-Cutting Concerns, [05] should load [06]'s exported interfaces when authoring its schema.

2. **SpacetimeDB instance isolation is a hard invariant.** Module [04] must design its authentication and subscription system such that no connection can access data from a different game's SpacetimeDB instance (02-REQ-004). This precludes any shared-state patterns across instances.

3. **Config freeze at launch is irreversible.** Module [05]'s game configuration mutations must enforce that no configuration write succeeds when `GameStatus === 'playing'` or `GameStatus === 'finished'` (02-REQ-050). The frozen config is consumed by Convex for board generation and by STDB (via dynamic gameplay parameters) for runtime rules — together they are the sole source of truth for the game's rules.

4. **Successor auto-creation produces an unstarted game record only.** Module [05]'s game-end handler must create the successor record with `status: 'not-started'` and must NOT provision a SpacetimeDB instance as part of successor creation (02-REQ-051). Provisioning occurs only on subsequent explicit launch.

5. **Selection state lives in Convex, not SpacetimeDB.** Module [04] must not include operator-to-snake mapping in its schema. Module [06] owns the selection tables and invariant enforcement. SpacetimeDB authorization is team-scoped only (02-REQ-017).

6. **Shared engine codebase must be ECMAScript-portable.** The codebase consumed by [04] (SpacetimeDB), [07]/[08] (Snek Centaur Server), must not use runtime-specific APIs. The BLAKE3 dependency must be available in all three environments. Flat board encoding (`y * width + x`) is mandated by Module 01 DOWNSTREAM IMPACT note 3.

7. **WebSocket is the transport between clients and SpacetimeDB.** Modules [04] and [08] must design their client connection code around WebSocket. HTTP fallback or alternative transports are not supported by SpacetimeDB's client protocol.

8. **Game-end notification is runtime-pushed, not Convex-polled.** Module [04] must implement a mechanism to push game-end notifications to Convex (02-REQ-022a). Convex does not poll or subscribe to SpacetimeDB during gameplay. Module [05] must implement a handler for receiving this notification.

9. **Security invariants are enforced at infrastructure boundaries, not in the library.** Modules [03], [04], [05], and [06] must implement their respective security enforcement points (Section 3.7) independently of the Snek Centaur Server library. No security guarantee may assume the library is being used (02-REQ-033).

10. **Snek Centaur Server holds no persistent credentials.** Outside active games, a Snek Centaur Server has no Convex credentials, no SpacetimeDB connections, and no active subscriptions (02-REQ-055). Game credentials are ephemeral, per-team, per-game, and expire when the game ends (02-REQ-057). Modules [03] and [05] must design credential issuance accordingly.

11. **No separate server registry table.** The `centaur_servers` table is eliminated. Server identity is not a platform concept. A Centaur Team's nominated server is stored as a string field (`nominatedServerDomain`) on the Centaur Team record. Module [05] must reflect this in its schema.

## REVIEW Items

### 02-REVIEW-001: Informal spec version drift — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: `SPEC-INSTRUCTIONS.md` references `team-snek-centaur-platform-spec-v2_1.md` as the informal source of truth, but the file present in the project root is `team-snek-centaur-platform-spec-v2.2.md`. This module's requirements were extracted from v2.2 on the assumption that v2.2 supersedes v2.1.
**Question**: Confirm v2.2 is the current source of truth and that `SPEC-INSTRUCTIONS.md` is stale on the filename. If a v2.1 file existed previously and was updated, are there any v2.1-only requirements that should be carried forward independently?
**Options**:
- A: v2.2 is canonical; instructions doc filename is stale; no carry-forward.
- B: Both versions matter; needs reconciliation pass before module 02 is considered complete.
**Informal spec reference**: N/A (meta-question).

**Decision**: A — v2.2 is canonical; no carry-forward from v2.1.
**Rationale**: The v2.2 file is the current informal spec. `SPEC-INSTRUCTIONS.md`'s filename reference is stale and should be updated separately as an instructions-doc edit; it does not invalidate any module authoring done against v2.2.
**Affected requirements/design elements**: None. This is a meta-question about source material; all of module 02's requirements were extracted from v2.2 and remain as drafted.

---

### 02-REVIEW-002: "Single Convex deployment" — hard constraint or current implementation? — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: The informal spec (§2, "Convex (Unified Platform)") states "A single Convex instance manages all persistent state." 02-REQ-002 elevates this to a testable architectural requirement. It is unclear whether this is a binding architectural constraint (e.g., precludes future sharding of Convex by region) or a description of the current single-instance deployment.
**Question**: Should the requirement remain "exactly one" or be relaxed to "all persistent state lives within the Convex platform" without quantifying the deployment count?
**Options**:
- A: Hard "exactly one" constraint, as currently written.
- B: Relax to "Convex is the persistent platform substrate" with no deployment-count claim.
**Informal spec reference**: §2, "Convex (Unified Platform)".

**Decision**: A — hard "exactly one Convex deployment" constraint.
**Rationale**: Single-deployment is a load-bearing architectural commitment, not merely a description of current state. Downstream modules (especially [05] for platform-wide tables and [06] for Centaur state) will rely on a single Convex schema namespace and transactional boundary. If the platform ever needs to shard Convex, that is a breaking architectural change that should go through explicit revision of this requirement, not silent relaxation.
**Affected requirements/design elements**: 02-REQ-002 (unchanged; wording already asserts "exactly one").

---

### 02-REVIEW-003: Auto-created next-game-in-room implicit STDB provisioning — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: §9.4 step 7 says "A new game is auto-created in the room inheriting config" after a game ends. 02-REQ-020 asserts STDB instances are not reused across games and each game gets its own freshly provisioned instance. This implies the auto-created next game also gets a new STDB, but the informal spec does not explicitly state this for the non-tournament case. The same principle is stated only for tournament rounds in §9.4 step 4.
**Question**: Does the "fresh STDB per game" rule apply uniformly to (a) tournament rounds, (b) non-tournament auto-created next games in a persistent room, and (c) any other game-creation path? 02-REQ-020 currently asserts (a) and (b) on the assumption that uniformity is intended.
**Options**:
- A: Uniform — every game-creation path provisions a fresh STDB. (Assumed by current draft.)
- B: Non-uniform — some game-creation paths reuse instances. Identify which.
**Informal spec reference**: §9.4 steps 4 and 7.

**Decision**: A — uniform, with an important clarification that reshapes how game lifecycle is expressed in this module. A SpacetimeDB instance is not provisioned until a game is *started* (launched). Auto-creation of a successor game on Convex produces a new **unstarted, mutable** game record whose configuration is inherited from the predecessor and may be edited further. When that successor is subsequently launched, the Convex config is frozen and passed to a freshly provisioned STDB instance. This entire pattern — pre-launch mutable Convex record, config freeze at launch, fresh STDB per launch — is uniform across tournament and non-tournament paths, and is independent of tournament dynamics.
**Rationale**: Chris clarified that STDB provisioning is tied to *game start*, not to *game record creation*. This invalidates the original draft's implicit conflation of "game" with "STDB instance" at creation time. The corrected model cleanly separates two lifecycles: a Convex game record (mutable while unstarted, frozen on launch, terminal on end) and an STDB instance (provisioned at launch, torn down after end and replay persist). Making this uniform across all game-creation paths removes special cases for tournament vs non-tournament.
**Affected requirements/design elements**: 02-REQ-003 (updated to distinguish started/unstarted games and forbid STDB for unstarted), 02-REQ-019 (updated to say "at the moment a game is launched"), 02-REQ-020 (updated to assert uniformity across all game-creation paths explicitly), 02-REQ-050 (new — pre-launch mutable Convex config, frozen at launch), 02-REQ-051 (new — successor auto-creation is Convex-only and uniform across tournament/non-tournament).

---

### 02-REVIEW-004: STDB instance isolation as proposed addition — **RESOLVED**

**Type**: Proposed Addition
**Phase**: Requirements
**Context**: 02-REQ-004 asserts that SpacetimeDB instances are mutually isolated. This is implicit in the "one per active game" topology but is not stated explicitly anywhere in the informal spec. It is being added as a foundational architectural invariant on the basis that any contrary design would have major security and correctness implications.
**Question**: Confirm this addition is intended.
**Options**:
- A: Add as a hard requirement (current draft).
- B: Drop as redundant with "one per active game" — instance isolation is presumed but not asserted.
**Informal spec reference**: N/A (proposed addition).

**Decision**: A — keep as a hard requirement.
**Rationale**: Instance isolation is load-bearing for security reasoning (a compromised Centaur Server for game X must not be able to affect game Y's state) and is too important to leave implicit. Making it explicit at the architectural level anchors downstream [04] design choices about authentication scope and subscription boundaries.
**Affected requirements/design elements**: 02-REQ-004 (unchanged from initial draft).

---

### 02-REVIEW-005: "Real-time bidirectional channel" vs naming the transport — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: §2 of the informal spec explicitly names WebSocket as the transport between SpacetimeDB and its clients (Centaur Servers, web clients). The spec instructions forbid requirements from referencing implementation artifacts. The current draft uses neutral phrasing ("real-time bidirectional channel") rather than naming WebSocket, on the basis that the choice of transport is an implementation concern of the SpacetimeDB platform itself, not a domain requirement.
**Question**: Is the neutral phrasing correct, or does the platform deliberately constrain itself to WebSocket as a binding architectural choice that should appear in requirements?
**Options**:
- A: Neutral phrasing — transport is implementation detail. (Current draft.)
- B: Name WebSocket as a binding constraint at the requirements level.
**Informal spec reference**: §2, "Infrastructure Topology" diagram and "SpacetimeDB (Game Runtime)".

**Decision**: B — name WebSocket explicitly in client-connection requirements.
**Rationale**: SpacetimeDB itself is a hard architectural choice for the game runtime (not an implementation detail), and the WebSocket client protocol is imposed by SpacetimeDB. Since the platform commits to SpacetimeDB, it inherits the WebSocket constraint, and that constraint should be visible in requirements so that downstream modules ([04], [08]) plan around it rather than presuming transport flexibility that does not exist. The "no implementation artifacts" rule applies to internal implementation choices (libraries, table names), not to the external contract surface of a chosen runtime.
**Affected requirements/design elements**: 02-REQ-023 (Snek Centaur Server → STDB, now "WebSocket subscription"), 02-REQ-038 (operator → STDB, now "via WebSocket"), 02-REQ-041 (spectator → STDB, now "via WebSocket"). 02-REQ-009 was left behavioral ("real-time state synchronization without per-turn polling") because it describes what the runtime delivers, not how a specific client connects.

---

### 02-REVIEW-006: Replay data retrieval pattern — **RESOLVED**

**Type**: Ambiguity
**Phase**: Design
**Context**: 02-REQ-022 allows any retrieval pattern for obtaining the game log from SpacetimeDB at game end — Convex-pull, runtime-push, or bundled in the game-end notification. The design section (2.14) describes the flow abstractly without committing to a specific pattern, because the choice is owned by [04] and [05].
**Question**: Should module 02's design commit to a specific retrieval pattern, or leave it to downstream modules as currently drafted?
**Options**:
- A: Leave to [04]/[05] — module 02 specifies only that retrieval and persistence must complete before teardown.
- B: Commit to Convex-pull (Convex calls a SpacetimeDB HTTP endpoint to fetch the log).
- C: Commit to runtime-push (SpacetimeDB pushes the log to a Convex HTTP action in the game-end notification).
**Informal spec reference**: §9.4 step 8, §13.1.

**Decision**: A — leave the retrieval pattern to [04]/[05]; module 02 specifies only that retrieval and persistence must complete before teardown.
**Rationale**: The existing design text (§2.14) and 02-REQ-022 already defer the retrieval pattern to downstream modules, stating the choice is "at [04]/[05]'s discretion per the requirement." Committing to a specific pattern at the architectural level would over-constrain [04] and [05] without adding value — the correctness invariant that matters to module 02 is that the complete game log is persisted before instance teardown (02-REQ-021), not the mechanism by which it is obtained. Both Convex-pull and runtime-push are viable, and the choice depends on [04]'s notification design and [05]'s action topology, which are not yet finalised. This resolution confirms the current draft stance.
**Affected requirements/design elements**: None — 02-REQ-022 and the §2.14 design text already align with this decision and require no changes.

---

### 02-REVIEW-007: Spectator visibility — no-team vs. opponent-equivalent — **RESOLVED**

**Type**: Ambiguity
**Phase**: Design
**Context**: 02-REQ-041 states spectators are subject to invisibility filtering "on the same terms as opponent team connections." Spectators belong to no team. The RLS rule must determine what a no-team connection sees. Two interpretations: (a) spectators see the union of what all teams see (i.e., all snakes including invisible ones), or (b) spectators see the intersection (i.e., invisible snakes of *every* team are hidden). The requirement text ("on the same terms as opponent team connections") implies (b) — spectators are treated as opponents of all teams.
**Question**: Confirm that spectators cannot see any team's invisible snakes (option B), consistent with the requirement text.
**Options**:
- A: Spectators see all snakes (union). Invisible snakes are hidden only from opponent *team* connections, not from unaffiliated spectators.
- B: Spectators see no invisible snakes (intersection). They are treated as opponents of every team for RLS purposes.
**Informal spec reference**: §8.5 ("Spectators connect with a read-only admission ticket").

**Decision**: B — spectators see no invisible snakes (intersection semantics). Spectators are treated as opponents of every team for RLS purposes.
**Rationale**: Spectators belong to no team. The RLS invisibility rule hides a team's invisible snakes from all connections that are not affiliated with that team. Since a spectator is not affiliated with any team, they are opponents of every team, and every team's invisible snakes are hidden from them. This is the natural reading of 02-REQ-041's "on the same terms as opponent team connections" and produces the most conservative, leak-free visibility policy. The union interpretation (Option A) would grant spectators strictly *more* visibility than any team player — a counterintuitive privilege that would undermine the strategic value of invisibility. The intersection interpretation preserves the competitive integrity of the invisibility mechanic for all observers.
**Affected requirements/design elements**: 02-REQ-041 tightened to explicitly state that spectators see no invisible snakes of any team, removing the ambiguity of the "same terms as opponent team connections" phrasing. §2.18 spectator connection model description already contains explicit language ("spectators cannot see invisible snakes of any team") and requires no changes.
