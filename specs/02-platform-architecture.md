# Module 02: Platform Architecture

## Requirements

### 2.1 Runtime Topology

**02-REQ-001**: The platform shall comprise exactly three runtime kinds: a **SpacetimeDB game runtime**, a **Convex platform runtime**, and **Centaur Server runtimes**.

**02-REQ-002**: There shall be exactly one Convex deployment for the entire platform. All persistent platform state lives within this single deployment.

**02-REQ-003**: There shall be exactly one SpacetimeDB instance per started game. A SpacetimeDB instance is transient: it is provisioned when the game is launched from its Convex game record and torn down after the game ends. Unstarted game records (games in the pre-launch configuration phase) shall not have an associated SpacetimeDB instance.

**02-REQ-004**: SpacetimeDB instances shall be isolated from one another. No SpacetimeDB instance shall have read or write access to the state of any other SpacetimeDB instance.

**02-REQ-005**: There shall be exactly one Centaur Server registered per Centaur Team.

**02-REQ-006**: Every Centaur Team that joins a game shall have a registered Centaur Server. The platform shall not support pure-human teams.

---

### 2.2 SpacetimeDB Game Runtime Responsibilities

**02-REQ-007**: The SpacetimeDB game runtime shall be the sole authoritative executor of game logic as defined by [01]. No other runtime shall execute turn resolution authoritatively.

**02-REQ-008**: Turn resolution within the SpacetimeDB runtime shall execute as a single atomic transaction per turn. Either all phases of [01-REQ-041] complete and are observable, or none are.

**02-REQ-009**: The SpacetimeDB runtime shall provide real-time state synchronization to connected clients without requiring per-turn polling. Clients shall observe state changes as they are committed.

**02-REQ-010**: The SpacetimeDB runtime shall filter invisible snakes ([01-REQ-023], [01-REQ-024]) from connections belonging to opponent teams such that opponent connections cannot observe their existence, position, or any derived state.

**02-REQ-011**: The SpacetimeDB runtime shall accept staged moves from authorized writers and shall apply last-write-wins semantics: the most recently written staged move for a given snake supersedes any earlier staged move for that snake within the same turn.

**02-REQ-012**: At the moment turn resolution fires, the SpacetimeDB runtime shall consume the current set of staged moves and clear them as part of the same atomic transaction that produces the new turn's state.

**02-REQ-013**: The complete record of game state across all turns shall be retained within the SpacetimeDB runtime for the lifetime of the game, in a form sufficient to reconstruct any prior turn's board without consulting any external system.

**02-REQ-014**: The SpacetimeDB runtime shall not require per-turn posting of game state to any external system during gameplay. Replay export occurs once at game end ([02-REQ-022]).

---

### 2.3 Convex Platform Runtime Responsibilities

**02-REQ-015**: The single Convex deployment shall be the sole persistent home of all platform state that must outlive any individual game, including but not limited to user accounts, Centaur Team records, room records, game records, replays, Centaur Server registry entries, game configuration, and per-team Centaur subsystem state. (Specific table schemas are owned by [05] and [06].)

**02-REQ-016**: Convex shall host all identity and credential infrastructure for the platform. (The mechanisms — OAuth, challenge-callback, JWT issuance, JWKS, HMAC — are owned by [03].)

**02-REQ-017**: Convex shall be the sole authority for intra-team coordination state, including the mapping between human operators and the snakes they have selected, manual-mode flags, and per-snake operator state. The SpacetimeDB runtime shall have no concept of which human within a team is acting on which snake; SpacetimeDB authorization is at the team level only.

**02-REQ-018**: The system shall enforce that at most one human operator is the current selector of any given snake, and at most one snake is currently selected by any given operator. Enforcement is the responsibility of the runtime that owns selection state (Convex, per [02-REQ-017]).

**02-REQ-019**: Convex shall orchestrate the provisioning of a fresh SpacetimeDB instance at the moment a game is launched, and its teardown after the game ends. (The reducer signatures and provisioning API mechanics are owned by [03], [04], and [05].)

**02-REQ-020**: A SpacetimeDB instance shall not be reused across distinct games. Each launched game shall be served by its own freshly provisioned SpacetimeDB instance. This rule shall apply uniformly to every game-creation path — including the first game in a room, successor games auto-created after a previous game ends, and every round of a tournament — with no special-case exceptions.

**02-REQ-021**: A SpacetimeDB instance's lifetime shall be bounded to the lifetime of its game. After the game ends and replay data has been persisted ([02-REQ-022]), the instance shall be torn down.

**02-REQ-022**: At game end, Convex shall persist the complete game record by obtaining the complete game state log from the SpacetimeDB instance. Retrieval may follow any pattern permitted by [04-REQ-061] — Convex-pull, runtime-push, or bundling the record into the game-end notification of [04-REQ-061a] — at Design's discretion; 02 requires only that retrieval and persistence complete before SpacetimeDB instance teardown ([02-REQ-021]).

**02-REQ-022a**: Convex shall learn of a game's terminal state via a runtime-pushed notification delivered by the SpacetimeDB instance to Convex ([04-REQ-061a]). Convex shall not hold a live gameplay subscription to any SpacetimeDB instance; live gameplay state is consumed only by clients of the SpacetimeDB instance (Centaur Servers per [02-REQ-023], human operators per [02-REQ-038], spectators per [02-REQ-041]). The specific notification mechanism is owned by [04]; Convex-side handling is owned by [05] per [05-REQ-038].

**02-REQ-050**: Prior to launch, a game's configuration shall exist as a mutable record in Convex and may be edited by permitted users. At launch, the configuration shall be frozen and supplied to the newly provisioned SpacetimeDB instance; after launch, the game's configuration shall not be mutable.

**02-REQ-051**: Auto-creation of a successor game after a prior game ends is a Convex-level event. It shall produce a new unstarted, mutable Convex game record inheriting configuration from its predecessor. No SpacetimeDB instance shall be provisioned as part of successor auto-creation; a SpacetimeDB instance is provisioned only when the successor is subsequently launched ([02-REQ-019]). This behavior is uniform across tournament and non-tournament paths.

---

### 2.4 Centaur Server Runtime Responsibilities

**02-REQ-023**: A Centaur Server shall hold a live WebSocket subscription to its game's SpacetimeDB instance for the duration of any game its team is participating in, observing game state in real time.

**02-REQ-024**: A Centaur Server shall hold a live subscription to Convex for its team's Centaur subsystem state, including snake configuration, active Drives, and bot parameters.

**02-REQ-025**: A Centaur Server shall run bot computation for every snake belonging to its team that is not currently controlled by a human operator.

**02-REQ-026**: A Centaur Server shall stage bot-computed moves into its game's SpacetimeDB instance via the staged-moves mechanism ([02-REQ-011]).

**02-REQ-027**: A Centaur Server shall write Centaur subsystem state updates (including snake state map updates, worst-case-world annotations, heuristic outputs) and action log entries to Convex.

**02-REQ-028**: A Centaur Server shall serve the operator web application over HTTP to authenticated members of its team.

**02-REQ-029**: A Centaur Server shall expose a healthcheck endpoint that the platform can call to verify availability. The platform shall call this endpoint when a Centaur Server is added to a game and on operator-initiated wake-up requests.

---

### 2.5 Centaur Server Library

**02-REQ-030**: The platform shall provide a Centaur Server library that packages the bot framework ([07]), the authentication handler ([03]), the healthcheck endpoint contract, the Convex schema bindings, and data-layer APIs. The library does not include the operator web application itself; the operator app is delivered as a separate forkable reference implementation repository (see 02-REQ-032a).

**02-REQ-031**: The Centaur Server library is the architecturally assumed implementation path for teams. The platform's design and documentation shall treat library-based Centaur Servers as the supported case and shall not be obligated to accommodate teams that build a Centaur Server without the library.

**02-REQ-032**: The Centaur Server library shall expose a bounded extension surface limited to: (a) custom Drive implementations and (b) custom Preference implementations. No other library-mediated extension points are sanctioned. The operator web application is not an extension point of the library.

**02-REQ-032a**: The platform shall maintain a Centaur Server reference implementation repository containing the full operator web application (all Svelte components), example Drives, example Preferences, and team Convex schema. Teams obtain and customise the operator app by forking this repository and modifying their fork directly — full source ownership, not a bounded extension point. Correctness is enforced by Convex function contracts ([06]) and security enforcement points external to the library (02-REQ-033).

**02-REQ-033** *(negative)*: The platform shall not rely on teams' use of the Centaur Server library for any security or correctness invariant. All invariants that bound what a Centaur Server may do shall be enforced by mechanisms external to the library — specifically by SpacetimeDB authorization rules, Convex function contracts, and admission ticket validation ([03]) — and shall hold equally against a Centaur Server that bypasses the library entirely.

---

### 2.6 Shared Engine Codebase

**02-REQ-034**: The platform shall provide a single shared TypeScript codebase that exports the domain type vocabulary defined by [01] (Section 1.1) and a turn-resolution implementation conforming to the eleven-phase pipeline of [01-REQ-041] through [01-REQ-052].

**02-REQ-035**: The SpacetimeDB game runtime shall consume the shared engine codebase to perform authoritative turn resolution. It shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

**02-REQ-036**: The Centaur Server library shall consume the shared engine codebase to perform game-state simulation and world-tree exploration ([07]). It shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

**02-REQ-037**: Web clients (both the operator web application and the Game Platform spectator/replay viewers) shall consume the shared engine codebase for pre-validation, simulation, and rendering of board state. They shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

---

### 2.7 Human Client Topology

**02-REQ-038**: Human operators shall connect directly to their game's SpacetimeDB instance via WebSocket for purposes of (a) observing game state subject to invisibility filtering ([02-REQ-010]) and (b) staging direct moves for human-controlled snakes.

**02-REQ-039**: Human operators shall additionally connect to Convex via the standard Convex client to read and write Centaur subsystem state, Drive assignments, and selection state.

**02-REQ-040**: The operator web application shall be served to a team's human members from that team's Centaur Server, not from the Game Platform.

**02-REQ-041**: Human spectators shall connect directly to a game's SpacetimeDB instance via WebSocket using a read-only admission ticket ([03]). Spectator connections shall be subject to invisibility filtering ([02-REQ-010]) on the same terms as opponent team connections.

**02-REQ-042**: The operator web application (served by a Centaur Server) and the Game Platform web application are two distinct deployed applications. They shall not share a single deployment artifact.

---

### 2.8 Game Platform vs Centaur Server Web Application Boundary

**02-REQ-043**: The **Game Platform** is the cross-team web application provided by the platform. Its scope covers cross-team and platform-level concerns: home and navigation, Centaur Team identity and member management, Centaur Server registration, room browsing and creation, room lobbies and game configuration, live spectating, platform-level replay viewing, player profiles, team profiles, and leaderboards. (Detailed feature requirements are owned by [09].)

**02-REQ-044**: The **Centaur Server web application** is the team-internal operator interface served by each team's Centaur Server. Its scope covers team-internal competitive operation: heuristic configuration, bot parameter configuration, the live operator interface used during gameplay, and team-perspective replay viewing with sub-turn timeline resolution. (Detailed feature requirements are owned by [08].)

**02-REQ-045** *(negative)*: The Game Platform shall not provide user-interface affordances for configuring bot parameters.

**02-REQ-046** *(negative)*: The Game Platform shall not provide user-interface affordances for configuring heuristic parameters or heuristic defaults.

**02-REQ-047** *(negative)*: The Game Platform shall not provide user-interface affordances for managing Drives (creating, editing, retargeting, or weighting).

**02-REQ-048** *(negative)*: The Game Platform's Centaur Team management page shall be limited to identity, Centaur Server registration, member management, and timekeeper assignment. It shall not expose any team-internal competitive configuration.

**02-REQ-049** *(negative)*: The Centaur Server web application shall not provide user-interface affordances for cross-team or platform-level concerns including room creation, room browsing, leaderboards, or platform-wide profiles.

---

## Design

### 2.9 Runtime Topology and Data Ownership

Satisfies 02-REQ-001, 02-REQ-002, 02-REQ-003, 02-REQ-004, 02-REQ-005, 02-REQ-006.

The platform is composed of exactly three runtime kinds, each with a distinct lifecycle and data ownership scope:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Convex (Single Deployment)                      │
│  Persistent state: users, teams, rooms, games, replays, centaur state  │
│  Identity & credential infrastructure (owned by [03])                  │
│  Game lifecycle orchestration                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│ SpacetimeDB Instance│  │ Centaur Server         │  │ Game Platform Server  │
│ (per started game)  │  │ (per team)             │  │                       │
│                     │  │                        │  │ Static / SSR serving  │
│ Transient game state│  │ Bot computation        │  │ Game Platform Client  │
│ Authoritative rules │  │ Serves Operator Client │  │ (SvelteKit, Svelte 5) │
│ Append-only log     │  └───────────┬────────────┘  └───────────┬───────────┘
└─────────────────────┘        serves│                     serves│
                          ┌──────────▼──────────┐    ┌───────────▼───────────┐
                          │ Operator Client      │    │ Game Platform Client  │
                          └─────────────────────┘    └───────────────────────┘
```

**Runtime connections:**

| From | To | Protocol | Purpose |
|------|-----|----------|---------|
| SpacetimeDB | Convex | HTTP (discrete) | Game-end notification, replay export |
| Centaur Server | Convex | Convex client | Centaur subsystem state (subscribe + write) |
| Centaur Server | SpacetimeDB | WebSocket | Game state subscription, move staging |
| Operator Client | SpacetimeDB | WebSocket | Game state subscription, move staging, turn declaration |
| Operator Client | Convex | Convex client | Centaur subsystem state (selection, drives, action log) |
| Game Platform Client | SpacetimeDB | WebSocket (read-only) | Game state subscription (spectating) |
| Game Platform Client | Convex | Convex client | Platform state (reactive game/room updates) |

**Data ownership boundaries**:

| Runtime | Owns | Lifetime |
|---------|------|----------|
| **Convex** | All persistent platform state: user accounts, Centaur Team records, room records, game records, replays, Centaur Server registry, game configuration, per-team Centaur subsystem state (snake config, drives, bot params, action log) | Permanent (single deployment) |
| **SpacetimeDB instance** | Transient game state: board, snake states, items, staged moves, time budgets, turn events — all as an append-only log sufficient for full game reconstruction | Bounded to a single game: provisioned at launch, torn down after game end + replay persist |
| **Centaur Server** | No persistent state of its own. Reads game state from SpacetimeDB, reads/writes Centaur subsystem state to Convex. Compute state (game tree cache, bot working memory) is ephemeral | Operated by each team; active during games |

**Instance isolation** (02-REQ-004). Each SpacetimeDB instance is deployed as an independent module instance with its own database. No cross-instance data access exists at the SpacetimeDB platform level. This isolation is load-bearing for security: a compromised Centaur Server authenticated to game X cannot read or write game Y's state.

**Centaur Team registration** (02-REQ-005, 02-REQ-006). Every Centaur Team has exactly one registered Centaur Server (identified by domain). The platform enforces that a team cannot join a game without a registered server. There are no pure-human teams.

### 2.10 SpacetimeDB Game Runtime Design

Satisfies 02-REQ-007 through 02-REQ-014.

**Authoritative turn resolution** (02-REQ-007, 02-REQ-008). The SpacetimeDB module imports the shared engine codebase ([02-REQ-035]) and invokes `resolveTurn()` (from Module 01's exported interface, Section 3.8) inside a `resolve_turn` reducer. Because SpacetimeDB reducers execute as single ACID transactions, the entire eleven-phase pipeline either completes and commits or is rolled back entirely. No other runtime calls `resolveTurn()` authoritatively — the Centaur Server library uses it for simulation only (02-REQ-036), and web clients use it for pre-validation and rendering only (02-REQ-037).

**Real-time synchronization** (02-REQ-009). SpacetimeDB provides automatic real-time state synchronization to connected clients via subscription queries. When a reducer commits new rows (e.g., new `snake_states` entries after turn resolution), all subscribers whose subscription queries match the new data receive updates without polling. This is a platform-provided capability of SpacetimeDB, not custom application code.

**Invisibility filtering** (02-REQ-010). Row-Level Security (RLS) on the snake state data filters rows where the snake's derived `visible` value (per [01-REQ-023]) is `false` from connections belonging to opponent teams. The RLS rule cross-references the querying connection's team membership (established during registration) against the snake's `teamId`. Same-team connections see all snakes regardless of visibility. The RLS mechanism is owned by [04]; this module specifies the architectural requirement that filtering occurs at the data access layer within SpacetimeDB, not at the application layer in clients. This ensures that even a Centaur Server that bypasses the library cannot observe invisible opponent snakes, satisfying 02-REQ-033's security model.

**Staged moves and last-write-wins** (02-REQ-011, 02-REQ-012). A mutable `staged_moves` table keyed by `snakeId` holds at most one staged move per snake. Any authorized writer (Centaur Server or human operator for the snake's team) can upsert into this table; the most recent write wins. At turn resolution, the `resolve_turn` reducer reads all staged moves, passes them to `resolveTurn()` as `stagedMoves: ReadonlyMap<SnakeId, StagedMove>`, and clears the table — all within the same ACID transaction (02-REQ-008). The `StagedMove.stagedBy` field (from Module 01's exported `Agent` type) is captured before clearing, for inclusion in `snake_moved` turn events (per [01-REQ-052]).

**Append-only game log** (02-REQ-013, 02-REQ-014). The SpacetimeDB schema is organized as an append-only log: turn-keyed tables (`snake_states`, `turn_events`, `item_lifetimes`, `time_budget_states`, `turns`) append new rows each turn without mutating prior rows. Static tables (`game_config`, `board`, `team_permissions`) are written once at initialization. This structure enables any prior turn's board state to be reconstructed directly via a turn-number query, without consulting Convex or any external system. At game end, the complete log is exported to Convex for persistent replay storage (02-REQ-022); no per-turn posting is needed during gameplay. The specific table schemas and query patterns are owned by [04].

### 2.11 Convex Platform Runtime Design

Satisfies 02-REQ-015 through 02-REQ-022a, 02-REQ-050, 02-REQ-051.

**Persistent state home** (02-REQ-015). All state that must outlive a game lives in the single Convex deployment. The Convex schema is partitioned between platform-wide tables (owned by [05]) and Centaur-subsystem tables (owned by [06]). Both table sets live in the same Convex schema namespace and share a single transactional boundary, which is why the "exactly one Convex deployment" constraint (02-REQ-002) is load-bearing — downstream modules rely on cross-table transactional consistency (e.g., enforcing selection invariants across `snake_config` rows atomically).

**Identity infrastructure** (02-REQ-016). Convex hosts all authentication mechanisms: Google OAuth for humans, challenge-callback for Centaur Servers, JWT issuance with HMAC signing for SpacetimeDB admission tickets. The specific mechanisms are owned by [03]; module 02 establishes that Convex is the sole host.

**Selection discipline** (02-REQ-017, 02-REQ-018). The mapping of human operators to snakes (selection state) is owned by Convex, not SpacetimeDB. SpacetimeDB authorizes at the team level only — any connection authenticated as a member of team T can stage moves for any snake belonging to T. The at-most-one-operator-per-snake and at-most-one-snake-per-operator invariants (02-REQ-018) are enforced by Convex function contracts in the Centaur subsystem (owned by [06]). This separation means SpacetimeDB's authorization model is simple (team-scoped), while fine-grained operator coordination is handled by Convex where the Centaur subsystem state already lives.

**Game record lifecycle** (02-REQ-050, 02-REQ-051). A game record in Convex progresses through three states:

```typescript
type GameStatus = 'not-started' | 'playing' | 'finished'
```

1. **`not-started`**: The game record exists in Convex with a mutable configuration. Permitted users may edit configuration parameters. No SpacetimeDB instance exists. This is the state after room creation, after successor auto-creation (02-REQ-051), and before launch.

2. **`playing`**: At launch, the configuration is frozen (becomes immutable), and a fresh SpacetimeDB instance is provisioned (02-REQ-019). The frozen config is supplied to the `initialize_game` reducer. The game record stores the SpacetimeDB instance URL for client connection. The transition from `not-started` to `playing` is irreversible.

3. **`finished`**: The game has ended. The SpacetimeDB instance has pushed a game-end notification to Convex (02-REQ-022a). Convex has obtained the complete game log and persisted it as replay data (02-REQ-022). The SpacetimeDB instance is torn down (02-REQ-021).

**SpacetimeDB instance provisioning** (02-REQ-019, 02-REQ-020). At game launch, Convex:

1. Freezes the game configuration (02-REQ-050).
2. Provisions a fresh SpacetimeDB instance via SpacetimeDB's cloud provisioning API.
3. Deploys the game engine module to the instance.
4. Calls the `initialize_game` reducer with the frozen config, team membership, and HMAC secret.
5. Updates the game record with the instance URL and transitions status to `playing`.

Each game gets its own freshly provisioned instance (02-REQ-020). This applies uniformly to all game-creation paths: first game in a room, successor games, tournament rounds. The provisioning API mechanics and reducer signatures are owned by [04] and [05].

**Game-end notification and replay persistence** (02-REQ-022, 02-REQ-022a). Convex does not hold a live subscription to any SpacetimeDB instance during gameplay. Instead, when the SpacetimeDB instance detects a terminal game state (via Phase 10 of turn resolution), it pushes a notification to Convex via a mechanism owned by [04]. Upon receiving the notification, Convex:

1. Obtains the complete append-only game log from the SpacetimeDB instance.
2. Persists the log as replay data in the `replays` table.
3. Updates the game record with final scores and transitions status to `finished`.
4. Triggers SpacetimeDB instance teardown (02-REQ-021).
5. Auto-creates a successor game if applicable (02-REQ-051).

The retrieval pattern (Convex-pull vs. runtime-push vs. bundled in notification) is at [04]/[05]'s discretion per the requirement.

**Successor game auto-creation** (02-REQ-051). After a game ends, Convex creates a new `not-started` game record in the same room, inheriting configuration from the predecessor. No SpacetimeDB instance is provisioned — the successor remains in the `not-started` state until explicitly launched. This is uniform across tournament and non-tournament paths; tournament mode simply chains launches automatically after the configured interlude, rather than waiting for manual launch.

### 2.12 Centaur Server Runtime Design

Satisfies 02-REQ-023 through 02-REQ-029.

**Dual subscription model**. Each Centaur Server maintains two concurrent subscriptions during gameplay:

1. **SpacetimeDB WebSocket subscription** (02-REQ-023): Connects to the game's SpacetimeDB instance using a Convex-issued admission ticket ([03]). Subscribes to game state tables (snake states, items, time budgets, turn events) filtered by RLS. Receives real-time turn-resolution updates. Stages bot-computed moves via the `stage_move` reducer (02-REQ-026).

2. **Convex subscription** (02-REQ-024): Connects to Convex using a Convex-issued JWT ([03]). Subscribes to the team's Centaur subsystem state — snake configuration, active Drives, heuristic configuration, and bot parameters (specific table schemas owned by [06]). Writes state updates (snake state maps, worst-case worlds, annotations, heuristic outputs) and action log entries to Convex (02-REQ-027).

**Bot computation** (02-REQ-025). The Centaur Server runs the bot framework ([07]) for every snake belonging to its team that is not currently in manual mode with a human operator's staged move taking precedence. The bot framework uses the shared engine codebase ([02-REQ-036]) for game-state simulation and world-tree exploration. Compute scheduling prioritizes automatic-mode snakes, then selected-manual snakes, then unselected-manual snakes (owned by [07]).

**Operator web application** (02-REQ-028). The Centaur Server serves the operator web application over HTTP to authenticated team members. Authentication verifies team membership — only members of the Centaur Server's team may access the operator UI. The operator web app connects to both SpacetimeDB and Convex as described in Section 2.15.

**Healthcheck** (02-REQ-029). The Centaur Server exposes a `GET /healthcheck` endpoint. The platform calls this endpoint:
- When a Centaur Server is registered or its domain is updated.
- When a team joins a game lobby (pre-launch readiness check).
- On operator-initiated wake-up requests (ping button in room lobby UI).

The healthcheck response indicates availability; the platform records health status and last-checked timestamp in the Centaur Server registry (table schema owned by [05]).

### 2.13 Centaur Server Library Design

Satisfies 02-REQ-030 through 02-REQ-033.

**Library composition** (02-REQ-030). The Centaur Server library is a TypeScript package that bundles:

| Component | Source Module | Purpose |
|-----------|--------------|---------|
| Bot framework | [07] | Drive/Preference evaluation, game tree cache, anytime submission pipeline, softmax decision |
| Auth handler | [03] | Challenge-callback endpoint (`/.well-known/centaur-challenge`), JWT refresh loop |
| Healthcheck handler | [02] | `GET /healthcheck` endpoint implementation |
| Convex schema bindings | [05], [06] | Typed client for reading/writing Centaur subsystem state |
| Data-layer APIs | [05], [06], [08] | Stable interface for reading game, Centaur, and operator state; consumed by the operator app |
| Shared engine codebase | [01] via [02-REQ-034] | Domain types and turn-resolution for simulation |

The operator web application is **not** bundled in the library. It is delivered as a separate forkable reference implementation repository (02-REQ-032a).

**Supported implementation path** (02-REQ-031). The Centaur Server library is the architecturally assumed way to build a Centaur Server. Platform documentation, example code, and support workflows treat library-based servers as the standard case. Teams that bypass the library and implement a Centaur Server from scratch must handle authentication, healthcheck, Convex state management, and bot computation independently. The platform is not obligated to accommodate non-library implementations — bugs or integration issues arising from bypassing the library are the team's responsibility. This does not affect security invariants, which are enforced externally regardless of library use (02-REQ-033).

**Extension surface** (02-REQ-032). The library exposes exactly two extension points:

```typescript
interface CentaurServerConfig {
  readonly drives: ReadonlyArray<DriveRegistration>
  readonly preferences: ReadonlyArray<PreferenceRegistration>
}
```

- **(a) Custom Drive implementations**: Teams register `Drive<T>` implementations conforming to [07]'s exported interface. Each Drive has a target type (`Snake` or `Cell`), scoring function, and eligible-targets predicate.
- **(b) Custom Preference implementations**: Teams register `Preference` implementations conforming to [07]'s exported interface. Preferences are directionless heuristics (no target).

No other extension points exist. The library does not expose hooks for overriding authentication, healthcheck, bot scheduling, or the anytime submission pipeline.

**Operator app: forkable reference implementation** (02-REQ-032a). The operator web application is maintained as a separate reference implementation repository, not as part of the library. The reference implementation is built with Svelte 5 and uses shadcn-svelte as its component library. Teams fork this repository to obtain the full Svelte 5 operator UI, example Drives and Preferences, and team Convex schema. Customisation is unbounded — teams have full source ownership over their fork. The stable interface between the library and the operator app is the data-layer API surface (see [08-REQ-076]); correctness is enforced externally by Convex function contracts ([06]) and security enforcement points (02-REQ-033).

**Security independence** (02-REQ-033). The platform's security invariants are enforced entirely outside the library:

| Invariant | Enforcement point |
|-----------|-------------------|
| Move staging restricted to team's snakes | SpacetimeDB `stage_move` reducer validates team membership via `team_permissions` table |
| Invisible snakes hidden from opponents | SpacetimeDB RLS filters at the data layer |
| Admission ticket validity | SpacetimeDB `register` reducer validates HMAC signature |
| Selection discipline (≤1 operator per snake) | Convex function contracts in [06] |
| Centaur Server identity | Challenge-callback protocol in [03] |

A Centaur Server that bypasses the library entirely and speaks the raw SpacetimeDB WebSocket protocol + Convex HTTP API is bound by the same invariants. The library provides convenience, not security.

### 2.13a Repository and Package Topology

Satisfies 02-REQ-030, 02-REQ-032, 02-REQ-032a, 02-REQ-034.

**Platform monorepo.** The platform is developed in a single monorepo that contains:

- The **shared game engine** package (e.g., `@team-snek/engine`) — domain types and turn-resolution logic consumed by all runtimes (02-REQ-034).
- The **Centaur Server library** package (e.g., `@team-snek/centaur-lib`) — bot framework, auth handler, healthcheck, Convex bindings, and data-layer APIs (02-REQ-030).
- Platform infrastructure code (Convex functions, SpacetimeDB modules, Game Platform Client) that is not published as npm packages.

Both the shared engine and the Centaur Server library are published to npm from this monorepo.

**Reference implementation repository.** A separate repository (e.g., `team-snek/centaur-server-ref`) contains:

- The complete operator web application — all Svelte components implementing [08].
- Example Drive and Preference implementations demonstrating the library's extension surface.
- Team Convex schema and configuration scaffolding.
- A dependency on the published `@team-snek/centaur-lib` and `@team-snek/engine` packages.

This repository is maintained by the platform team and serves as the canonical starting point for teams.

**Fork-based team onboarding.** Teams obtain the operator app by forking the reference implementation repository. Within their fork, teams have full source ownership: they may modify, replace, or extend any Svelte component, add pages, change layouts, or restructure the UI as they see fit. The library's data-layer API surface ([08-REQ-076]) is the stable interface between `@team-snek/centaur-lib` and the operator app. Correctness invariants are enforced externally by Convex function contracts ([06]) and security enforcement points (02-REQ-033), not by the UI layer.

### 2.14 Shared Engine Codebase Design

Satisfies 02-REQ-034 through 02-REQ-037.

**Codebase structure**. The shared engine is a single TypeScript package (e.g., `@team-snek/engine`) that re-exports Module 01's domain types and entry points:

```typescript
export {
  Direction, CellType, ItemType, BoardSize, EffectFamily, EffectState,
  Cell, SnakeId, TeamId, ItemId, TurnNumber, CentaurId, OperatorId,
  Agent, BOARD_DIMENSIONS, invulnerabilityLevel, isVisible,
  PotionEffect, SnakeState, ItemState, Board, TeamClockState,
  GameConfig, GameOutcome, TurnEvent, DeathCause,
  BoardGenerationFailure, StagedMove, Rng, rngFromSeed, subSeed,
  generateBoardAndInitialState, resolveTurn,
} from './game-rules'
```

**Consumer contexts**. The codebase runs in three distinct environments:

| Consumer | Runtime Context | Usage | Authority |
|----------|----------------|-------|-----------|
| SpacetimeDB game module | SpacetimeDB TypeScript module runtime | `resolveTurn()` inside `resolve_turn` reducer; `generateBoardAndInitialState()` inside `initialize_game` reducer | **Authoritative** — only execution whose output becomes committed game state |
| Centaur Server library | Node.js (or Deno/Bun) server | `resolveTurn()` for simulation/world-tree exploration; domain types for state interpretation | **Simulation only** — output used for bot decisions, never committed directly |
| Web clients (Operator Client + Game Platform Client) | Browser | Domain types for rendering; `resolveTurn()` for pre-validation and animation prediction; `invulnerabilityLevel()` / `isVisible()` for display logic | **Display only** — output used for rendering, never committed |

**Compatibility constraint**. Because the codebase executes in three different JavaScript runtimes, it must:
- Use only ECMAScript standard library APIs (no Node.js-specific APIs, no browser-specific APIs).
- Export pure functions with no side effects beyond the `Rng` state parameter.
- Use the specified BLAKE3 implementation for `subSeed()` (per Module 01 DOWNSTREAM IMPACT note 4), which must be available as a dependency in all three environments.
- Use the flat `ReadonlyArray<CellType>` board encoding with `y * width + x` indexing (per Module 01 DOWNSTREAM IMPACT note 3).

**Rationale for single codebase vs. separate implementations**. A single codebase eliminates the class of bugs where the authoritative server and simulation clients disagree on game rules. Given that SpacetimeDB's TypeScript module support runs standard ECMAScript, there is no technical barrier to sharing. The alternative — separate implementations in each consumer — would require continuous parity testing and triple the maintenance surface for any rule change.

### 2.15 Human Client Topology Design

Satisfies 02-REQ-038 through 02-REQ-042.

**Operator dual-connection model** (02-REQ-038, 02-REQ-039, 02-REQ-040). The operator web application is served by the team's Centaur Server. Each human operator's browser client maintains two simultaneous connections:

```
Operator Browser
├── WebSocket → SpacetimeDB instance
│   ├── Subscribe: game state (filtered by RLS)
│   ├── Call: stage_move(snakeId, direction)
│   └── Call: declare_turn_over(teamId)
│
└── Convex client → Convex deployment
    ├── Subscribe: Centaur subsystem state (selection, drives, bot params, heuristics)
    ├── Mutate: selection state (select/deselect snake, toggle manual mode)
    ├── Mutate: Drive assignments (add, remove, reweight)
    └── Mutate: action log (append action entries)
```

The SpacetimeDB connection provides low-latency game state and real-time move staging. The Convex connection provides Centaur subsystem state (which is not in SpacetimeDB) and supports the operator coordination features (selection, Drive management, action logging). Both connections authenticate independently: the SpacetimeDB connection uses an HMAC-signed admission ticket ([03]), and the Convex connection uses the operator's Google OAuth session.

**Game Platform Client dual-connection model** (02-REQ-041). The Game Platform Client is a SvelteKit (Svelte 5) web application using shadcn-svelte as its component library, served by the Game Platform Server (static assets, with optional SSR for indexable pages such as profiles and leaderboards). The Game Platform Server itself does not maintain a Convex client connection — all reactive Convex subscriptions live in the Game Platform Client (browser). This parallels the Centaur Server / Operator Client split, with one difference: the Centaur Server maintains its own server-side Convex client because bots need reactive access to Centaur subsystem state, whereas the Game Platform Server has no such need.

The Game Platform Client handles all cross-team and platform-level UI, including live spectating. When spectating a game, the Game Platform Client maintains two simultaneous connections:

```
Game Platform Client (spectating)
├── WebSocket → SpacetimeDB instance (read-only)
│   └── Subscribe: game state (filtered by RLS, no reducer calls)
│
└── Convex client → Convex deployment
    └── Subscribe: platform state (game record, room state)
```

The SpacetimeDB connection uses a read-only admission ticket ([03]) that authorizes subscription queries but does not authorize any reducer calls (no `stage_move`, no `declare_turn_over`). Spectating connections are subject to the same RLS invisibility filtering as opponent team connections — spectators cannot see invisible snakes of any team (02-REQ-010). The Convex connection provides reactive platform state updates (game record status, room state). The Game Platform Client has no access to Centaur subsystem state — its Convex queries are restricted to platform-wide tables. Outside of spectating, the Game Platform Client uses only its Convex client connection for platform features (rooms, profiles, leaderboards).

**Operator web app serving** (02-REQ-040, 02-REQ-042). The Operator Client is served by the team's Centaur Server, not by the Game Platform Server — the two are distinct deployed applications. The Centaur Server serves static assets (HTML, JS, CSS) over HTTP and the Operator Client establishes the dual connections described above.

### 2.16 Game Platform vs. Centaur Server Boundary Design

Satisfies 02-REQ-043 through 02-REQ-049.

**Two distinct applications**. The platform comprises two web applications with non-overlapping UI scope:

| Server | Client | Technology | Scope |
|--------|--------|------------|-------|
| **Game Platform Server** (platform infrastructure, e.g. Vercel/Cloudflare; static + optional SSR) | **Game Platform Client** | SvelteKit (Svelte 5) + shadcn-svelte ([09]) | Cross-team: home, team identity management, Centaur Server registration, member management, timekeeper assignment, room browsing/creation, room lobby/game config, live spectating, platform replay viewer, player profiles, team profiles, leaderboards |
| **Centaur Server** (per team) | **Operator Client** | Svelte 5 + shadcn-svelte (reference implementation) ([08]) | Team-internal: heuristic config, bot parameter config, live operator interface, team-perspective replay viewer with sub-turn timeline |

**Negative boundary constraints**. The following are architectural constraints, not just UI omissions — they reflect the data ownership model:

- The Game Platform Client has no access to bot parameters, heuristic configuration, or Drive state (02-REQ-045, 02-REQ-046, 02-REQ-047). These are Centaur subsystem concerns written and read through the Centaur Server's Convex subscription. The Game Platform Client's Convex queries should not read Centaur subsystem data.
- The Game Platform Client's team management page exposes only identity, server registration, member management, and timekeeper assignment (02-REQ-048). It does not expose per-snake configuration, Drive portfolios, or temperature settings.
- The Operator Client does not provide room creation, room browsing, leaderboards, or platform-wide profiles (02-REQ-049). It has no concept of "rooms" or "the platform" — it operates within the scope of a single team's games.

**Rationale**. This boundary cleanly separates concerns: the Game Platform Client handles everything visible to all users (public/cross-team), while the Operator Client handles everything that is competitive-sensitive and team-internal. This separation means a team's bot strategy configuration is never exposed through the Game Platform Client's Convex queries, even accidentally. It also allows teams to customize their Operator Client UI (02-REQ-032c) without affecting the platform-wide experience.

**Shared UI stack rationale**. Both web clients use Svelte 5 with shadcn-svelte as the component library. This shared stack provides a common component vocabulary across the Game Platform Client and the Operator Client reference implementation, reduces context-switching for developers who work across both applications, and delivers a consistent look-and-feel where the two applications share similar interaction patterns (e.g. game board rendering, connection status indicators). The Svelte 5 + shadcn-svelte choice for the Operator Client applies to the reference implementation only — teams that fork the operator app (02-REQ-032c) have full source ownership and may replace the UI framework entirely.

---

## Exported Interfaces

This section is the minimal contract module 02 exposes to downstream modules (03, 04, 05, 06). Any type or concept not listed here is a module-internal detail and may change without impacting downstream modules.

### 3.1 Runtime Kind Enumeration

Motivated by 02-REQ-001.

```typescript
export const enum RuntimeKind {
  SpacetimeDB = 'spacetimedb',
  Convex = 'convex',
  CentaurServer = 'centaur_server',
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
not-started ──[launch]──► playing ──[game-end + replay persist]──► finished
```

- `not-started → playing`: Config is frozen (02-REQ-050), fresh SpacetimeDB instance provisioned (02-REQ-019, 02-REQ-020).
- `playing → finished`: Game-end notification received from SpacetimeDB (02-REQ-022a), replay persisted (02-REQ-022), instance torn down (02-REQ-021).
- No backward transitions. `not-started → finished` is not valid (a game must be launched before it can end).

### 3.3 Data Ownership Boundaries

Motivated by 02-REQ-002, 02-REQ-013, 02-REQ-015, 02-REQ-017.

Exported as architectural constraints that downstream modules must respect:

| Data Category | Owner | Constraint |
|---------------|-------|------------|
| All persistent platform state | Convex (single deployment, 02-REQ-002) | Downstream modules [05], [06] define schemas within the single Convex namespace |
| Transient game state (board, snakes, items, moves, clock, events) | SpacetimeDB instance (per game, 02-REQ-003) | [04] defines the schema; data does not outlive the instance except via replay export |
| Game state log for replay | SpacetimeDB during gameplay → Convex after game end | [04] defines the append-only schema; [05] defines the Convex `replays` table |
| Selection state (operator↔snake mapping) | Convex (02-REQ-017) | [06] enforces the at-most-one invariant (02-REQ-018); SpacetimeDB has no concept of selection |
| Identity & credentials | Convex (02-REQ-016) | [03] defines mechanisms; all auth flows terminate at Convex |

### 3.4 SpacetimeDB Instance Lifecycle Contract

Motivated by 02-REQ-003, 02-REQ-019, 02-REQ-020, 02-REQ-021, 02-REQ-022.

```typescript
export interface SpacetimeDbInstanceLifecycle {
  readonly provision: {
    readonly trigger: 'game-launch'
    readonly freshPerGame: true
    readonly inputFromConvex: {
      readonly frozenConfig: GameConfig
      readonly teamMembership: ReadonlyArray<TeamMembershipRecord>
      readonly hmacSecret: Uint8Array
    }
  }
  readonly teardown: {
    readonly trigger: 'replay-persisted'
    readonly precondition: 'game-ended AND replay data obtained by Convex'
  }
}

export interface TeamMembershipRecord {
  readonly teamId: TeamId
  readonly members: ReadonlyArray<{ readonly identity: string; readonly role: 'human' | 'centaur' }>
}
```

`GameConfig` is re-exported from Module 01 (Section 3.3). `TeamId` is re-exported from Module 01 (Section 3.1).

**DOWNSTREAM IMPACT**: [04] must implement the `initialize_game` reducer to accept these inputs. [05] must implement the provisioning orchestration that supplies them. [03] must define the `hmacSecret` generation and the admission ticket format that SpacetimeDB validates.

### 3.5 Shared Engine Codebase Contract

Motivated by 02-REQ-034, 02-REQ-035, 02-REQ-036, 02-REQ-037.

The shared engine codebase re-exports all of Module 01's exported interfaces (Section 3 of `01-game-rules.md`). The authoritative list of exports:

```typescript
export {
  // Enums and branded types (01 §3.1)
  Direction, CellType, ItemType, BoardSize, EffectFamily, EffectState,
  Cell, SnakeId, TeamId, ItemId, TurnNumber, CentaurId, OperatorId, Agent,
  BOARD_DIMENSIONS, invulnerabilityLevel, isVisible,

  // State shapes (01 §3.2)
  PotionEffect, SnakeState, ItemState, Board, TeamClockState,

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
| SpacetimeDB game module | [04] | Full export set; `resolveTurn()` + `generateBoardAndInitialState()` for authoritative execution | Authoritative |
| Centaur Server library | [07], [08] | Full export set; `resolveTurn()` for simulation | Simulation only |
| Game Platform Client | [09] | Domain types for rendering; `resolveTurn()` for pre-validation | Display only |
| Operator Client | [08] | Domain types for rendering; `resolveTurn()` for pre-validation | Display only |

**DOWNSTREAM IMPACT**: The shared engine codebase must use only ECMAScript standard library APIs (no runtime-specific APIs) because it runs in SpacetimeDB's TypeScript runtime, Node.js/Deno/Bun (Centaur Servers), and browsers. The BLAKE3 dependency for `subSeed()` (per Module 01 DOWNSTREAM IMPACT note 4) must be available in all three environments.

### 3.6 Centaur Server Extension Surface

Motivated by 02-REQ-030, 02-REQ-032, 02-REQ-032a.

```typescript
export interface CentaurServerExtensionSurface {
  readonly drives: 'custom Drive<T> implementations per [07] interface'
  readonly preferences: 'custom Preference implementations per [07] interface'
}
```

The extension surface is intentionally described by reference to downstream module interfaces rather than defining concrete types here, because the `Drive<T>` and `Preference` type signatures are owned by [07]. Module 02 exports only the *architectural fact* that exactly these two extension points exist and no others.

The operator web application is not an extension point of the library. Teams customise the operator app by modifying their fork of the reference implementation repository (02-REQ-032a). The stable interface between the library and the operator app is the data-layer API surface exported by `@team-snek/centaur-lib` (see [08-REQ-076]).

**DOWNSTREAM IMPACT**: [07] must export `Drive<T>` and `Preference` type signatures that teams program against. [08] defines the reference operator app delivered in the forkable repository; it does not export a customisation interface. The stable team-facing interface is the data-layer API surface exported by centaur-lib. No additional library extension points may be added without revising 02-REQ-032.

### 3.7 Security Enforcement Points

Motivated by 02-REQ-033.

Exported as architectural constraints specifying where each security invariant is enforced:

```typescript
export interface SecurityEnforcementModel {
  readonly moveStagingAuthorization: {
    readonly enforcedBy: 'SpacetimeDB stage_move reducer'
    readonly scope: 'team-level (any team member can stage for any team snake)'
    readonly mechanism: 'team_permissions table lookup against connection Identity'
  }
  readonly invisibilityFiltering: {
    readonly enforcedBy: 'SpacetimeDB RLS'
    readonly mechanism: 'Row filter on snake visibility flag × connection team membership'
  }
  readonly admissionTicketValidation: {
    readonly enforcedBy: 'SpacetimeDB register reducer'
    readonly mechanism: 'HMAC signature verification (secret seeded at instance init)'
  }
  readonly selectionInvariants: {
    readonly enforcedBy: 'Convex function contracts'
    readonly scope: 'at-most-one-operator-per-snake, at-most-one-snake-per-operator'
  }
  readonly centaurServerIdentity: {
    readonly enforcedBy: 'Convex challenge-callback protocol'
    readonly mechanism: 'Domain ownership verification via nonce echo'
  }
}
```

**DOWNSTREAM IMPACT**: [03] must implement admission ticket issuance and the challenge-callback protocol such that the HMAC secret is never exposed to clients. [04] must implement `stage_move` authorization and RLS filtering. [05]/[06] must implement selection invariant enforcement in Convex function contracts. None of these invariants may depend on the Centaur Server library being used — they must hold against any client that speaks the raw protocol.

### 3.8 Client Connection Topology

Motivated by 02-REQ-038, 02-REQ-039, 02-REQ-041.

```typescript
export interface OperatorConnectionModel {
  readonly spacetimeDb: {
    readonly transport: 'WebSocket'
    readonly authMechanism: 'HMAC admission ticket via register reducer'
    readonly capabilities: readonly ['subscribe_game_state', 'stage_move', 'declare_turn_over']
  }
  readonly convex: {
    readonly transport: 'Convex client (HTTP/WebSocket)'
    readonly authMechanism: 'Google OAuth session'
    readonly capabilities: readonly ['subscribe_centaur_state', 'mutate_selection', 'mutate_drives', 'append_action_log']
  }
}

export interface GamePlatformClientConnectionModel {
  readonly spacetimeDb: {
    readonly transport: 'WebSocket'
    readonly authMechanism: 'Read-only HMAC admission ticket via register reducer'
    readonly capabilities: readonly ['subscribe_game_state']
  } | null
  readonly convex: {
    readonly transport: 'Convex client (HTTP/WebSocket)'
    readonly authMechanism: 'Google OAuth session'
    readonly capabilities: readonly ['subscribe_platform_state']
  }
}

export interface CentaurServerConnectionModel {
  readonly spacetimeDb: {
    readonly transport: 'WebSocket'
    readonly authMechanism: 'HMAC admission ticket via register reducer (role: centaur)'
    readonly capabilities: readonly ['subscribe_game_state', 'stage_move', 'declare_turn_over']
  }
  readonly convex: {
    readonly transport: 'Convex client'
    readonly authMechanism: 'Challenge-callback JWT'
    readonly capabilities: readonly ['subscribe_centaur_state', 'mutate_snake_config', 'append_action_log']
  }
}
```

**DOWNSTREAM IMPACT**: [03] must issue distinct admission ticket types for operators (role: `human`), Centaur Servers (role: `centaur`), and spectators (role: `spectator`, read-only). [04] must enforce capability restrictions based on the ticket's role — spectators cannot call `stage_move` or `declare_turn_over`. [09] must implement the Game Platform Client connection model: always-on Convex client for platform state, plus a conditional SpacetimeDB WebSocket connection when spectating a live game. [08] must implement the operator dual-connection flow.

### 3.9 Web Application Boundary

Motivated by 02-REQ-042, 02-REQ-043, 02-REQ-044, 02-REQ-045 through 02-REQ-049.

```typescript
export interface WebApplicationBoundary {
  readonly gamePlatform: {
    readonly scope: readonly [
      'home_navigation', 'team_identity_management', 'centaur_server_registration',
      'member_management', 'timekeeper_assignment', 'room_browsing', 'room_creation',
      'room_lobby', 'game_configuration', 'live_spectating', 'platform_replay_viewer',
      'player_profiles', 'team_profiles', 'leaderboards'
    ]
    readonly excludes: readonly [
      'bot_parameters', 'heuristic_configuration', 'drive_management',
      'live_operator_interface', 'team_replay_viewer'
    ]
  }
  readonly centaurServerApp: {
    readonly scope: readonly [
      'heuristic_configuration', 'bot_parameter_configuration',
      'live_operator_interface', 'team_replay_viewer'
    ]
    readonly excludes: readonly [
      'room_creation', 'room_browsing', 'leaderboards', 'platform_profiles'
    ]
  }
}
```

**DOWNSTREAM IMPACT**: [09] must not build UI for any item in `gamePlatform.excludes`. [08] must not build UI for any item in `centaurServerApp.excludes`. The `centaur_server_registration` feature on the Game Platform Client is limited to registering the domain URL and triggering healthchecks — no bot or heuristic configuration.

### 3.10 DOWNSTREAM IMPACT Notes

1. **Single Convex namespace.** Modules [05] and [06] both define Convex tables within the same single deployment (02-REQ-002). They must coordinate to avoid naming collisions. Per SPEC-INSTRUCTIONS.md §Cross-Cutting Concerns, [05] should load [06]'s exported interfaces when authoring its schema.

2. **SpacetimeDB instance isolation is a hard invariant.** Module [04] must design its authentication and subscription system such that no connection can access data from a different game's SpacetimeDB instance (02-REQ-004). This precludes any shared-state patterns across instances.

3. **Config freeze at launch is irreversible.** Module [05]'s game configuration mutations must enforce that no configuration write succeeds when `GameStatus === 'playing'` or `GameStatus === 'finished'` (02-REQ-050). The frozen config supplied to `initialize_game` is the sole source of truth for the game's rules.

4. **Successor auto-creation produces an unstarted game record only.** Module [05]'s game-end handler must create the successor record with `status: 'not-started'` and must NOT provision a SpacetimeDB instance as part of successor creation (02-REQ-051). Provisioning occurs only on subsequent explicit launch.

5. **Selection state lives in Convex, not SpacetimeDB.** Module [04] must not include operator-to-snake mapping in its schema. Module [06] owns the selection tables and invariant enforcement. SpacetimeDB authorization is team-scoped only (02-REQ-017).

6. **Shared engine codebase must be ECMAScript-portable.** The codebase consumed by [04] (SpacetimeDB), [07]/[08] (Centaur Server), and [09] (browser) must not use runtime-specific APIs. The BLAKE3 dependency must be available in all three environments. Flat board encoding (`y * width + x`) is mandated by Module 01 DOWNSTREAM IMPACT note 3.

7. **WebSocket is the transport between clients and SpacetimeDB.** Modules [04], [08], and [09] must design their client connection code around WebSocket. HTTP fallback or alternative transports are not supported by SpacetimeDB's client protocol.

8. **Game-end notification is runtime-pushed, not Convex-polled.** Module [04] must implement a mechanism to push game-end notifications to Convex (02-REQ-022a). Convex does not poll or subscribe to SpacetimeDB during gameplay. Module [05] must implement a handler for receiving this notification.

9. **Security invariants are enforced at infrastructure boundaries, not in the library.** Modules [03], [04], [05], and [06] must implement their respective security enforcement points (Section 3.7) independently of the Centaur Server library. No security guarantee may assume the library is being used (02-REQ-033).

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
**Rationale**: SpacetimeDB itself is a hard architectural choice for the game runtime (not an implementation detail), and the WebSocket client protocol is imposed by SpacetimeDB. Since the platform commits to SpacetimeDB, it inherits the WebSocket constraint, and that constraint should be visible in requirements so that downstream modules ([04], [09]) plan around it rather than presuming transport flexibility that does not exist. The "no implementation artifacts" rule applies to internal implementation choices (libraries, table names), not to the external contract surface of a chosen runtime.
**Affected requirements/design elements**: 02-REQ-023 (Centaur Server → STDB, now "WebSocket subscription"), 02-REQ-038 (operator → STDB, now "via WebSocket"), 02-REQ-041 (spectator → STDB, now "via WebSocket"). 02-REQ-009 was left behavioral ("real-time state synchronization without per-turn polling") because it describes what the runtime delivers, not how a specific client connects; flag if this should also be updated.

---

### 02-REVIEW-006: Replay data retrieval pattern

**Type**: Ambiguity
**Phase**: Design
**Context**: 02-REQ-022 allows any retrieval pattern for obtaining the game log from SpacetimeDB at game end — Convex-pull, runtime-push, or bundled in the game-end notification. The design section (2.11) describes the flow abstractly without committing to a specific pattern, because the choice is owned by [04] and [05].
**Question**: Should module 02's design commit to a specific retrieval pattern, or leave it to downstream modules as currently drafted?
**Options**:
- A: Leave to [04]/[05] — module 02 specifies only that retrieval and persistence must complete before teardown.
- B: Commit to Convex-pull (Convex calls a SpacetimeDB HTTP endpoint to fetch the log).
- C: Commit to runtime-push (SpacetimeDB pushes the log to a Convex HTTP action in the game-end notification).
**Informal spec reference**: §9.4 step 8, §13.1.

### 02-REVIEW-007: Spectator visibility — no-team vs. opponent-equivalent

**Type**: Ambiguity
**Phase**: Design
**Context**: 02-REQ-041 states spectators are subject to invisibility filtering "on the same terms as opponent team connections." Spectators belong to no team. The RLS rule must determine what a no-team connection sees. Two interpretations: (a) spectators see the union of what all teams see (i.e., all snakes including invisible ones), or (b) spectators see the intersection (i.e., invisible snakes of *every* team are hidden). The requirement text ("on the same terms as opponent team connections") implies (b) — spectators are treated as opponents of all teams.
**Question**: Confirm that spectators cannot see any team's invisible snakes (option B), consistent with the requirement text.
**Options**:
- A: Spectators see all snakes (union). Invisible snakes are hidden only from opponent *team* connections, not from unaffiliated spectators.
- B: Spectators see no invisible snakes (intersection). They are treated as opponents of every team for RLS purposes.
**Informal spec reference**: §8.5 ("Spectators connect with a read-only admission ticket").
