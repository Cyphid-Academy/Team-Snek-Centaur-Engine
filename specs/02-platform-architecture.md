# Module 02: Platform Architecture

## Requirements

### 2.1 Runtime Topology

**02-REQ-001**: The platform shall comprise exactly three runtime kinds: a **SpacetimeDB game runtime**, a **Convex platform runtime**, and **Centaur Server runtimes**.

**02-REQ-002**: There shall be exactly one Convex deployment for the entire platform. All persistent platform state lives within this single deployment.

**02-REQ-003**: There shall be exactly one SpacetimeDB instance per active game. A SpacetimeDB instance is transient: it is provisioned when its game is created and torn down after its game ends.

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

**02-REQ-019**: Convex shall orchestrate the provisioning of SpacetimeDB instances for new games and their teardown after games end. (The reducer signatures and provisioning API mechanics are owned by [04] and [05].)

**02-REQ-020**: A SpacetimeDB instance shall not be reused across distinct games. Each game (including each round of a tournament) shall be served by its own freshly provisioned SpacetimeDB instance.

**02-REQ-021**: A SpacetimeDB instance's lifetime shall be bounded to the lifetime of its game. After the game ends and replay data has been persisted ([02-REQ-022]), the instance shall be torn down.

**02-REQ-022**: At game end, Convex shall persist the complete game record by reading the game state log directly from the SpacetimeDB instance. This persistence shall complete before SpacetimeDB instance teardown.

---

### 2.4 Centaur Server Runtime Responsibilities

**02-REQ-023**: A Centaur Server shall hold a live subscription to its game's SpacetimeDB instance for the duration of any game its team is participating in, observing game state in real time.

**02-REQ-024**: A Centaur Server shall hold a live subscription to Convex for its team's Centaur subsystem state, including snake configuration, active Drives, and bot parameters.

**02-REQ-025**: A Centaur Server shall run bot computation for every snake belonging to its team that is not currently controlled by a human operator.

**02-REQ-026**: A Centaur Server shall stage bot-computed moves into its game's SpacetimeDB instance via the staged-moves mechanism ([02-REQ-011]).

**02-REQ-027**: A Centaur Server shall write Centaur subsystem state updates (including snake state map updates, worst-case-world annotations, heuristic outputs) and action log entries to Convex.

**02-REQ-028**: A Centaur Server shall serve the operator web application over HTTP to authenticated members of its team.

**02-REQ-029**: A Centaur Server shall expose a healthcheck endpoint that the platform can call to verify availability. The platform shall call this endpoint when a Centaur Server is added to a game and on operator-initiated wake-up requests.

---

### 2.5 Centaur Server Library

**02-REQ-030**: The platform shall provide a Centaur Server library that packages the bot framework ([07]), the authentication handler ([03]), the healthcheck endpoint contract, the Convex schema bindings, and a reference operator web application.

**02-REQ-031**: The Centaur Server library is the architecturally assumed implementation path for teams. The platform's design and documentation shall treat library-based Centaur Servers as the supported case and shall not be obligated to accommodate teams that build a Centaur Server without the library.

**02-REQ-032**: The Centaur Server library shall expose a bounded extension surface limited to: (a) custom Drive implementations, (b) custom Preference implementations, and (c) optional customization of the operator web application. No other library-mediated extension points are sanctioned.

**02-REQ-033** *(negative)*: The platform shall not rely on teams' use of the Centaur Server library for any security or correctness invariant. All invariants that bound what a Centaur Server may do shall be enforced by mechanisms external to the library — specifically by SpacetimeDB authorization rules, Convex function contracts, and admission ticket validation ([03]) — and shall hold equally against a Centaur Server that bypasses the library entirely.

---

### 2.6 Shared Engine Codebase

**02-REQ-034**: The platform shall provide a single shared TypeScript codebase that exports the domain type vocabulary defined by [01] (Section 1.1) and a turn-resolution implementation conforming to the eleven-phase pipeline of [01-REQ-041] through [01-REQ-052].

**02-REQ-035**: The SpacetimeDB game runtime shall consume the shared engine codebase to perform authoritative turn resolution. It shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

**02-REQ-036**: The Centaur Server library shall consume the shared engine codebase to perform game-state simulation and world-tree exploration ([07]). It shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

**02-REQ-037**: Web clients (both the operator web application and the Game Platform spectator/replay viewers) shall consume the shared engine codebase for pre-validation, simulation, and rendering of board state. They shall not implement [01]'s domain types or turn-resolution algorithm in a parallel codebase.

---

### 2.7 Human Client Topology

**02-REQ-038**: Human operators shall connect directly to their game's SpacetimeDB instance via a real-time bidirectional channel for purposes of (a) observing game state subject to invisibility filtering ([02-REQ-010]) and (b) staging direct moves for human-controlled snakes.

**02-REQ-039**: Human operators shall additionally connect to Convex via the standard Convex client to read and write Centaur subsystem state, Drive assignments, and selection state.

**02-REQ-040**: The operator web application shall be served to a team's human members from that team's Centaur Server, not from the Game Platform.

**02-REQ-041**: Human spectators shall connect directly to a game's SpacetimeDB instance via a real-time bidirectional channel using a read-only admission ticket ([03]). Spectator connections shall be subject to invisibility filtering ([02-REQ-010]) on the same terms as opponent team connections.

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

## REVIEW Items

### 02-REVIEW-001: Informal spec version drift

**Type**: Ambiguity
**Context**: `SPEC-INSTRUCTIONS.md` references `team-snek-centaur-platform-spec-v2_1.md` as the informal source of truth, but the file present in the project root is `team-snek-centaur-platform-spec-v2.2.md`. This module's requirements were extracted from v2.2 on the assumption that v2.2 supersedes v2.1.
**Question**: Confirm v2.2 is the current source of truth and that `SPEC-INSTRUCTIONS.md` is stale on the filename. If a v2.1 file existed previously and was updated, are there any v2.1-only requirements that should be carried forward independently?
**Options**:
- A: v2.2 is canonical; instructions doc filename is stale; no carry-forward.
- B: Both versions matter; needs reconciliation pass before module 02 is considered complete.
**Informal spec reference**: N/A (meta-question).

---

### 02-REVIEW-002: "Single Convex deployment" — hard constraint or current implementation?

**Type**: Ambiguity
**Context**: The informal spec (§2, "Convex (Unified Platform)") states "A single Convex instance manages all persistent state." 02-REQ-002 elevates this to a testable architectural requirement. It is unclear whether this is a binding architectural constraint (e.g., precludes future sharding of Convex by region) or a description of the current single-instance deployment.
**Question**: Should the requirement remain "exactly one" or be relaxed to "all persistent state lives within the Convex platform" without quantifying the deployment count?
**Options**:
- A: Hard "exactly one" constraint, as currently written.
- B: Relax to "Convex is the persistent platform substrate" with no deployment-count claim.
**Informal spec reference**: §2, "Convex (Unified Platform)".

---

### 02-REVIEW-003: Auto-created next-game-in-room implicit STDB provisioning

**Type**: Gap
**Context**: §9.4 step 7 says "A new game is auto-created in the room inheriting config" after a game ends. 02-REQ-020 asserts STDB instances are not reused across games and each game gets its own freshly provisioned instance. This implies the auto-created next game also gets a new STDB, but the informal spec does not explicitly state this for the non-tournament case. The same principle is stated only for tournament rounds in §9.4 step 4.
**Question**: Does the "fresh STDB per game" rule apply uniformly to (a) tournament rounds, (b) non-tournament auto-created next games in a persistent room, and (c) any other game-creation path? 02-REQ-020 currently asserts (a) and (b) on the assumption that uniformity is intended.
**Options**:
- A: Uniform — every game-creation path provisions a fresh STDB. (Assumed by current draft.)
- B: Non-uniform — some game-creation paths reuse instances. Identify which.
**Informal spec reference**: §9.4 steps 4 and 7.

---

### 02-REVIEW-004: STDB instance isolation as proposed addition

**Type**: Proposed Addition
**Context**: 02-REQ-004 asserts that SpacetimeDB instances are mutually isolated. This is implicit in the "one per active game" topology but is not stated explicitly anywhere in the informal spec. It is being added as a foundational architectural invariant on the basis that any contrary design would have major security and correctness implications.
**Question**: Confirm this addition is intended.
**Options**:
- A: Add as a hard requirement (current draft).
- B: Drop as redundant with "one per active game" — instance isolation is presumed but not asserted.
**Informal spec reference**: N/A (proposed addition).

---

### 02-REVIEW-005: "Real-time bidirectional channel" vs naming the transport

**Type**: Ambiguity
**Context**: §2 of the informal spec explicitly names WebSocket as the transport between SpacetimeDB and its clients (Centaur Servers, web clients). The spec instructions forbid requirements from referencing implementation artifacts. The current draft uses neutral phrasing ("real-time bidirectional channel") rather than naming WebSocket, on the basis that the choice of transport is an implementation concern of the SpacetimeDB platform itself, not a domain requirement.
**Question**: Is the neutral phrasing correct, or does the platform deliberately constrain itself to WebSocket as a binding architectural choice that should appear in requirements?
**Options**:
- A: Neutral phrasing — transport is implementation detail. (Current draft.)
- B: Name WebSocket as a binding constraint at the requirements level.
**Informal spec reference**: §2, "Infrastructure Topology" diagram and "SpacetimeDB (Game Runtime)".
