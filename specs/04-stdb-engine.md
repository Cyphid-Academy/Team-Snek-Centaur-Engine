# Module 04: SpacetimeDB Game Engine

## Requirements

This module specifies the per-game runtime that authoritatively executes [01]'s game rules, holds live gameplay state, mediates client admission per [03], and retains the complete historical record of the game in a form sufficient for replay export. Its scope is bounded by [02]: it is the **SpacetimeDB game runtime** referred to throughout [02], and it owns the informal-spec material in Sections 10 (schema) and 14 (turn event schema). Requirements here are concept-level; specific table names, column names, reducer names, and RLS rule syntax are Phase 2 (Design) concerns.

### 4.1 Scope and Module Boundaries

**04-REQ-001**: This module shall specify the behaviour of the SpacetimeDB game runtime introduced by [02-REQ-001] and constrained by [02-REQ-003], [02-REQ-007], [02-REQ-008], [02-REQ-009], [02-REQ-010], [02-REQ-013], and [02-REQ-014]. Requirements in this module shall not restate [01]'s game rules or [03]'s authentication and admission mechanics; they shall specify how the runtime realises, stores, and exposes the state produced by those rules.

**04-REQ-002** *(negative)*: The SpacetimeDB game runtime shall not hold, derive, or expose any platform-wide persistent state. All platform-wide persistent state lives in Convex per [02-REQ-015]. The runtime's state shall be scoped to a single game instance and shall be discarded when the instance is torn down per [02-REQ-021], subject to the replay-export obligation in Section 4.12.

**04-REQ-003** *(negative)*: The SpacetimeDB game runtime shall not accept move-staging, turn-declaration, or any other gameplay-mutation operation from connections that have not been admitted per Section 4.4.

---

### 4.2 Game State Retention Model

**04-REQ-004**: The runtime shall maintain a **historical record** of the game's state over time such that, for every turn `T` in `[0, latestCompletedTurn]`, the complete observable state of the game at the boundary between turn `T` and turn `T+1` is directly queryable from the runtime alone, without any auxiliary computation that re-executes prior turns. The observable state comprises: every snake's body, health, invulnerability level, active effects, pending effects, last direction, alive status, visible status, and `ateLastTurn` flag per [01-REQ-004]; every item's position and type; the board layout; and each team's time budget. (Satisfies [02-REQ-013].)

**04-REQ-005**: The historical record shall be **append-only**: once a row, event, or other record representing state at or before turn `T` has been written as part of the atomic transaction that resolves turn `T`, the runtime shall not subsequently mutate or delete that record except as part of replay export teardown ([02-REQ-021]). Historical records shall not be re-written to reflect later corrections.

**04-REQ-006**: The historical record shall include, for each turn `T ≥ 0`, a per-turn snapshot of each snake's full state ([01-REQ-004]) at the boundary between turn `T` and turn `T+1`. "At the boundary" means after Phase 11 of turn `T` has completed and before Phase 1 of turn `T+1` has begun.

**04-REQ-007**: The historical record shall track each item's lifetime by recording the turn on which it was spawned and the turn on which it was consumed or destroyed. For any turn `T`, the set of items present on the board at the boundary between turn `T` and turn `T+1` shall be directly derivable from this record. Items present at game start (Section 4.3) shall have a spawn turn of `0`.

**04-REQ-008**: The historical record shall include the board layout (cell types per [01-REQ-002]) as static data written once during game initialisation (Section 4.3) and never subsequently modified. Board cell types shall not change after game start.

**04-REQ-009**: The historical record shall include, for each completed turn `T`, each team's remaining time budget (Section 4.6) and a marker indicating how the team's turn was declared over — either by explicit declaration (with the timestamp at which the declaration occurred) or by clock expiry.

**04-REQ-010**: The historical record shall include, for each completed turn `T`, the turn's wall-clock start and the wall-clock moment at which turn resolution began. The gap between successive turns' start markers captures time spent in turn resolution itself; the runtime shall not assume resolution is instantaneous.

**04-REQ-011**: The historical record shall include all turn events emitted by turn resolution (Section 4.8), attributed to the turn in which they were produced, in an order that preserves the relative emission sequence within a turn.

**04-REQ-012**: The set of information persisted in the historical record shall be sufficient to reconstruct a complete replay of the game — including every board state, every item lifetime, every turn event, and every `stagedBy` attribution — without consulting any runtime other than this one. (Satisfies [02-REQ-014] and the replay-export contract with [05].)

---

### 4.3 Game Initialisation

**04-REQ-013**: The runtime shall expose a **privileged initialisation operation** that may be called exactly once per instance, before any connection is admitted, by the Convex orchestration path described in [02-REQ-019]. The caller shall be authenticated per [03-REQ-048]. The operation shall accept, at minimum: a fully specified initial game state comprising the board layout (cell terrain as a flat array per [01-REQ-008]–[01-REQ-013]), all snake starting states (positions, health, team assignments per [01-REQ-020]–[01-REQ-021]), and all initial item placements (per [01-REQ-017]); the dynamic gameplay parameters (food spawn rate, potion spawn rates, hazard damage, max health, timer budgets, max turns, and other runtime-behaviour parameters — but not board generation parameters, which are consumed by Convex and never reach STDB); the participating-team roster per [03-REQ-039]; and the game's unique identifier (used to validate the `aud` claim in connecting clients' JWTs per [03-REQ-023]). The operation shall not accept a game seed for board generation, nor shall it call `generateBoardAndInitialState()` — board generation is performed by Convex before the STDB instance is provisioned (see [02] §2.14). No per-instance signing secret is seeded — client authentication is handled by SpacetimeDB's OIDC-based JWT validation against the Convex platform's public key (see [03] §3.17).

**04-REQ-014**: Successful completion of the initialisation operation shall leave the runtime in a state where (a) the static board layout ([01-REQ-008] through [01-REQ-013]) is written, (b) each snake's initial state ([01-REQ-020], [01-REQ-021]) is written as the turn-0 snapshot, (c) initial food placements ([01-REQ-017]) are written as spawn-turn-0 items, (d) each team's initial time budget ([01-REQ-035]) is recorded, (e) the game's unique identifier is stored in `game_config` for `aud` claim validation by the `client_connected` callback (Section 4.4), and (f) the participating-team roster (per [03-REQ-039]) is available for use by the connection admission path.

**04-REQ-015**: Once the initialisation operation has completed successfully, the runtime shall be in the state of **turn 0 before Phase 1** and shall be ready to accept client connections (Section 4.4), staged moves (Section 4.5), and turn-over declarations (Section 4.6).

**04-REQ-016** *(negative)*: The runtime shall reject any attempt to invoke the privileged initialisation operation after it has completed once. The runtime shall also reject any move-staging or turn-declaration operation submitted before the initialisation operation has completed, and the `client_connected` callback shall disconnect any client that connects before initialisation is complete.

**04-REQ-017**: The runtime shall **not** perform board generation. Board generation (`generateBoardAndInitialState()`, [01-REQ-010] through [01-REQ-017], bounded-retry feasibility [01-REQ-061]) is performed by Convex before the STDB instance is provisioned (see [02] §2.14 and [05-REQ-032]). The `initialize_game` reducer receives a pre-computed initial game state (board layout, snake starting states, initial items) and writes it to STDB tables. The reducer shall validate the structural integrity of the received state — correct board dimensions, valid cell types, consistent snake count matching the team roster, valid item positions — and shall reject malformed payloads synchronously as an error return to the caller. This validation is a defensive coding-error check: a structurally invalid payload indicates a bug in Convex's board-generation or serialisation logic, not a user-facing configuration problem. Infeasibility of board generation for a given configuration is surfaced to the room owner by Convex during config mode, before any STDB instance is provisioned.

---

### 4.4 Connection Admission

**04-REQ-018**: The runtime shall implement a **`client_connected` lifecycle callback** that is invoked automatically by the SpacetimeDB runtime when a client establishes a WebSocket connection. The callback shall read the connecting client's JWT claims (previously validated by SpacetimeDB's built-in OIDC verification against the Convex platform's public key per [03] §3.17) and perform application-level validation per [03-REQ-021] and [03-REQ-023].

**04-REQ-019**: The `client_connected` callback shall validate the JWT's `aud` claim against the game's unique identifier stored in `game_config` (Section 4.3), parse the `sub` claim via `parseSubClaim()` per [03] §4.4, validate the team binding against the participating roster, and derive an `Agent` value via `deriveAgentFromSubClaim()`. Upon successful validation, the callback shall associate the calling connection's opaque connection identifier with the parsed Centaur Team (except for spectator connections with `sub` prefix `"spectator:"`, which associate no team per [03-REQ-026]) and derived role (operator, bot, or spectator). This association shall persist for the lifetime of the connection, consistent with [03-REQ-021].

**04-REQ-020**: The runtime shall maintain, for the full lifetime of the game instance, a **participant attribution record** (the `team_permissions` table) that maps each connection that has been successfully admitted via `client_connected` to an `Agent` value (as defined by [01]: `{kind: 'centaur', centaurId}` for Centaur Server connections, or `{kind: 'operator', operatorId}` for operator connections). This mapping shall be derived from the JWT `sub` claim at connection time — the SpacetimeDB connection Identity is resolved to an `Agent` in the `client_connected` callback, not deferred to replay-export time. The record shall be retained for the full lifetime of the game instance. (Satisfies [03-REQ-044]. Resolves 04-REVIEW-011.)

**04-REQ-021**: The participant attribution record shall not be mutated or deleted when the underlying connection is closed, whether by network interruption, client shutdown, or reconnection. A client that reconnects shall obtain a fresh connection identifier and a fresh `Agent`-mapped attribution entry; previous entries remain intact so that historical `stagedBy: Agent` references from earlier turns remain resolvable without re-consulting the original connection Identity.

**04-REQ-022**: The `client_connected` callback shall disconnect any client whose JWT claims fail any of the criteria enumerated in [03-REQ-023] — including `aud` mismatch, unparseable `sub`, or team not found in the participating roster. A rejected connection shall not result in any association or attribution record being written.

**04-REQ-023** *(negative)*: The runtime shall not accept any alternative admission mechanism (e.g., per-instance shared secrets, IP allowlists, direct credentials, application-level `register` reducers). Connection admission is governed exclusively by OIDC-validated JWTs issued by Convex per [03], with application-level claim validation in the `client_connected` callback.

---

### 4.5 Move Staging

**04-REQ-024**: The runtime shall expose a **move-staging operation** that accepts, from a registered connection, a snake identifier and a direction ([01-REQ-001]). The runtime shall accept the operation only if the calling connection is registered as a human participant or bot participant for the Centaur Team that owns the named snake; all other callers shall be rejected. (Satisfies [03-REQ-028] within the runtime.)

**04-REQ-025**: At any instant during a turn, the runtime shall retain at most one staged move per snake. A new staged move for a snake whose previous staged move has not yet been consumed by turn resolution shall overwrite the previous staged move. Overwrite is the sole mechanism for changing a staged move; there is no separate cancel-move operation. (Satisfies [02-REQ-011].)

**04-REQ-026**: Each accepted staged move shall be recorded together with the `Agent` value (per 04-REQ-020) of the connection that wrote it (`stagedBy: Agent`) and the wall-clock time at which the move was accepted. When an overwrite occurs, these fields shall reflect the most recent writer's `Agent` and time, discarding the previous writer's attribution and time.

**04-REQ-027**: The staged-move storage shall be **transient**: it shall not form part of the historical record of Section 4.2. Staged moves are consumed and cleared by turn resolution (Section 4.7); after clearing, no record of the previously staged direction shall remain in the runtime except as captured by the movement event emitted for the turn in question (Section 4.8).

**04-REQ-028**: The runtime shall not validate move legality (e.g., reject moves that lead into walls) at the moment of staging. Legality is determined only during turn resolution, where a fatal direction kills the snake in Phase 3 per [01-REQ-044]. This preserves the "explore a direction to see its score" affordance described in [08]'s live-operator interface.

**04-REQ-029** *(negative)*: The runtime shall not permit a connection to stage a move for a snake belonging to a Centaur Team other than the Centaur Team the connection was admitted for, even if a connection identifier from the opposing team's admission is supplied in a spoofed parameter. Centaur Team membership is the connection-level association established in Section 4.4 and cannot be asserted per-call.

---

### 4.6 Chess Timer

**04-REQ-030**: The runtime shall implement the chess-timer semantics of [01-REQ-034] through [01-REQ-040] within its own state; no external runtime shall mediate per-turn clock timing. This includes: per-team time budget tracking, per-turn clock derivation from `min(effectiveCap, currentBudget)`, budget crediting on explicit declaration, and automatic declaration on clock expiry.

**04-REQ-031**: The runtime shall expose a **declare-turn-over operation** that a registered connection may invoke on behalf of the team the connection was admitted for. A declaration shall (a) stop that team's per-turn clock, (b) credit the remaining clock time back to that team's time budget, (c) record the declaration timestamp as part of the per-turn record required by 04-REQ-009, and (d) be idempotent — a second declaration by the same team in the same turn has no effect. Declarations from spectator connections shall be rejected.

**04-REQ-032**: The runtime shall autonomously detect when a team's per-turn clock has reached zero without an explicit declaration, and shall treat that event as an implicit turn-over declaration for that team. The per-turn record required by 04-REQ-009 shall distinguish clock-expiry declarations from explicit declarations.

**04-REQ-033**: The runtime shall trigger turn resolution (Section 4.7) **exactly once per turn**, at the moment all participating teams have declared turn over (whether explicitly, by clock expiry, or any combination). Turn resolution shall not be triggered by any other condition, including wall-clock elapsed time alone, administrative action, or connection count changes.

**04-REQ-034**: A team that has no alive snakes shall be treated for turn-resolution-triggering purposes as having declared turn over at the start of every subsequent turn. The runtime shall not wait for such a team's clock to expire before triggering resolution. (This handles the case where one team is eliminated but the game continues with the remaining teams per [01-REQ-054].)

**04-REQ-035**: Time-budget bookkeeping across turns shall conform to [01-REQ-035] (initial budget from configuration), [01-REQ-036] (budget increment at the start of each turn), and [01-REQ-037] (per-turn clock cap rule including the turn-0 first-turn-time override). The runtime shall record each team's post-turn budget as part of the historical record (04-REQ-009).

---

### 4.7 Turn Resolution

**04-REQ-036**: Turn resolution shall execute the eleven-phase pipeline of [01-REQ-041] and its sub-requirements ([01-REQ-042] through [01-REQ-052]) using the shared engine codebase of [02-REQ-034] and [02-REQ-035]. The runtime shall not implement a parallel or specialised variant of this pipeline.

**04-REQ-037**: Turn resolution shall execute as a **single atomic transaction**, such that either every state mutation produced by the eleven-phase pipeline is observable to subscribed clients simultaneously, or none of them are. No intermediate state from within the resolution pipeline shall be observable to any subscribed client. (Restates [02-REQ-008] at this module's level of specificity.)

**04-REQ-038**: Within the atomic transaction of turn resolution, the runtime shall, in order: (a) read the current set of staged moves (each carrying its `stagedBy: Agent` per 04-REQ-026); (b) run the eleven-phase pipeline of [01-REQ-041]; (c) for each snake that moved, emit a movement event recording the direction moved, whether growth occurred, and the `Agent` value of the connection that staged the move that was consumed (or `null` if the move was determined by the fallback rule of [01-REQ-042] because no move was staged); (d) emit all other turn events required by [01-REQ-052] (Section 4.8); (e) append the new turn-`T+1` snake-state snapshots, updated item-lifetime records, and post-turn time-budget entries to the historical record; (f) clear all staged moves; (g) add the budget increment to each team's budget per [01-REQ-036].

**04-REQ-039**: The `stagedBy` value captured in movement events shall be the `Agent` resolved from the staging connection's Identity at registration time per 04-REQ-020 and carried through from the staged-move record per 04-REQ-026. No further interpretation, mapping, or substitution of the `Agent` value is performed during turn resolution or replay export. (Satisfies [03-REQ-032]. Resolves 04-REVIEW-011.)

**04-REQ-040**: If a snake had no staged move at the moment of turn resolution and its direction was determined by the Phase 1 fallback rule of [01-REQ-042], the movement event for that snake shall distinguish the fallback case from the staged-move case. The `stagedBy` field of the movement event shall be **nullable** (`Agent | null`); it shall be populated with the `Agent` of the writer whose staged move was consumed when the move was staged, and shall be **null** when the move was determined by fallback. The fallback case covers both (a) subsequent-turn fallback to `lastDirection` per [01-REQ-042(b)] and (b) turn-0 random fallback per [01-REQ-042(c)] when no move was staged. (Resolves 04-REVIEW-002.)

**04-REQ-041** *(negative)*: Once turn resolution for turn `T` has committed, the runtime shall not accept further staged moves or turn-over declarations attributable to turn `T`. Any such operations received after commitment shall either be treated as pertaining to turn `T+1` (if they arrive after the new turn has begun) or rejected, at the runtime's discretion; the runtime shall not silently reorder them into turn `T`'s committed state.

**04-REQ-042**: After a turn-resolution commit, the runtime shall begin turn `T+1` by applying the budget-increment rule ([01-REQ-036]), computing each team's new per-turn clock per [01-REQ-037], and accepting staged moves and turn-over declarations for the new turn.

---

### 4.8 Turn Event Emission

**04-REQ-043**: The runtime shall emit, as part of each turn's atomic resolution transaction, a set of **turn events** covering every observable outcome of that turn. The set of event kinds shall be a **closed enumeration** — no extensibility mechanism shall permit new event kinds to be added without a deliberate revision of this requirement. The closed set shall comprise at minimum:

- (a) **Snake movement**: for each snake that executed a move in Phase 2, a record capturing the snake identifier, the originating cell, the destination cell, the direction, whether the tail was retained (growth), and `stagedBy` per 04-REQ-039 and 04-REQ-040 (nullable; null indicates a fallback-determined move).
- (b) **Snake death**: for each snake that died in Phase 3, Phase 5, or other phase of the pipeline, a record capturing the snake identifier, the cause of death (wall, hazard, self-collision, body-collision, head-to-head, starvation), the location, and — where applicable — the identifier of the snake responsible (e.g., the attacker in a body-collision kill).
- (c) **Severing**: for each severing outcome per [01-REQ-044c], a record capturing the attacker identifier, the victim identifier, the contact cell, and the number of segments removed.
- (d) **Food consumption**: for each snake that consumed food in Phase 5, a record capturing the snake identifier, the cell, and the resulting health value.
- (e) **Potion collection**: for each snake that consumed a potion in Phase 6, a record capturing the collector identifier, the cell, the potion type, and the set of teammates affected by the resulting pending effects.
- (f) **Food spawning**: for each food item spawned in Phase 7, a record capturing the new item's identifier and cell.
- (g) **Potion spawning**: for each potion item spawned in Phase 8, a record capturing the new item's identifier, cell, and potion type.
- (h) **Effect application**: for each effect that was moved from `pendingEffects` to `activeEffects` in Phase 9, a record capturing the affected snake, effect type, and expiry turn.
- (i) **Effect cancellation**: for each effect that was removed in Phase 9 — whether by disruption-triggered cancellation per [01-REQ-031] or by natural expiry per [01-REQ-050] — a record capturing the affected snake, effect type, and the reason (`disruption` or `expiry`).
- (j) **Hazard damage**: for each surviving snake that took hazard damage in Phase 5b without dying that turn, a record capturing the snake identifier, the hazard cell, the damage amount applied, and the resulting health value. Snakes that die *from* hazard damage in Phase 5 are covered by the death event (b) with cause `hazard` and shall not additionally emit a hazard_damage event. (Added per 04-REVIEW-003 resolution.)

**04-REQ-044**: Each turn-event record shall include enough information for a replay or animation client to visualise the associated outcome without re-executing turn resolution. In particular, event records shall not require the client to diff successive snake-state snapshots to recover information that the event describes (e.g., a death event shall carry the cause explicitly rather than requiring the client to infer it from a snake's alive-to-dead transition).

**04-REQ-045**: A turn's events form a **set** — they are not causally or temporally ordered with respect to each other within the turn; they are all produced atomically by a single turn-resolution transaction. For storage, replay consistency, and deterministic bit-exact comparison across independent runs, this set is given a **canonical representation order**. The ordering keys, applied in priority order, are: (1) **phase** — Phase 1 events before Phase 2 events, and so on through the eleven-phase pipeline; (2) **event-type class** within a phase — event types are grouped into an implementation-defined but fixed class order (e.g., movement events before death events before collection events within phases that produce multiple types); (3) **ascending snake identifier** of the primary subject within each event-type class (the moving snake for movement, the dying snake for death, the collector for potion collection, the eater for food consumption, the affected snake for effect application/cancellation/hazard damage, and so on); phase-internal events that have no snake subject (food spawning, potion spawning) shall follow all snake-subject events of the same phase in ascending item-identifier order. The resulting total order is a canonical representation order for storage and replay — it does not express causal or temporal dependencies between events within the turn and imposes no delivery-order obligation on subscription infrastructure. The canonical order shall be stable across independent replays of the same game seed. (Resolves 04-REVIEW-004; see also 04-REVIEW-009.)

**04-REQ-046** *(negative)*: The runtime shall not emit turn events that imply the existence of game mechanics not specified in [01]. The closed enumeration of 04-REQ-043 is exhaustive for the Team Snek ruleset as specified in this spec version.

---

### 4.9 Visibility Filtering

**04-REQ-047**: The runtime shall enforce [01-REQ-024]'s invisibility-as-information-asymmetry semantics at the **data layer**. Subscribed clients shall not observe the existence, position, body, health, effects, or any other attribute of a snake whose `visible` field is `false` ([01-REQ-023]) unless the client's admitted team matches the invisible snake's owning team. Spectator connections ([03-REQ-026]) and opponent-team connections shall be filtered equally per [02-REQ-010] and [03-REQ-031].

**04-REQ-048**: Visibility filtering shall apply to **all** queries against the historical record that refer to turns in which the snake's frozen visible state (per [01-REQ-033]) was `false`. In particular, a client scrubbing backward in history shall not be able to recover the position or existence of an invisible-at-that-turn snake belonging to an opponent team.

**04-REQ-049**: Visibility filtering shall apply consistently to all information channels through which a client could infer an invisible snake's state — snake-state queries, item-state queries (insofar as an invisible snake's presence on an item cell could leak it), turn events involving the invisible snake (e.g., a movement event or death event), and any aggregate counts. An opposing-team client shall observe a game in which the invisible snake does not appear at all for the turns during which it was invisible.

**04-REQ-050**: Allied connections (i.e., connections admitted for the same team as the invisible snake) shall observe the invisible snake normally, including any dedicated visual indicator the client chooses to render on the basis of the snake's `visible` field. The runtime shall expose `visible = false` to allied queries so the client can distinguish ally-invisible from ally-visible.

**04-REQ-051**: When a snake becomes visible or invisible at a turn boundary (because an `invis_buff` or `invis_collector` effect is applied, cancelled, or expires in Phase 9), the visibility filter shall transition at the boundary between turns. An opposing-team client observing turn `T+1` after the snake becomes invisible shall no longer observe the snake; a client that previously saw the snake shall have the observation vanish at that boundary. The reverse transition (invisible → visible) shall cause the snake to appear at the boundary.

**04-REQ-052** *(negative)*: The runtime shall not rely on client-side filtering for invisibility. A client that issues unfiltered queries directly against the runtime's data layer shall receive data that has already had invisible-opponent snakes elided; the runtime shall not assume a cooperating client.

---

### 4.10 Subscription and Real-Time Delivery

**04-REQ-053**: Registered connections shall be able to subscribe to the historical record and receive updates incrementally as turn resolution commits each new turn. A subscribed client shall not need to poll the runtime on a timer to detect turn progression. (Satisfies [02-REQ-009].)

**04-REQ-054**: The runtime shall support subscription patterns sufficient for each of the following client use cases:
- (a) **Live current-turn view**: observing the state of the current turn, updating automatically when a new turn begins.
- (b) **Historical scrubbing**: observing the state at an arbitrary past turn `T` by issuing a point-in-time query against the historical record (04-REQ-004).
- (c) **Animation between turns**: observing the transition from turn `T` to turn `T+1` by subscribing to the turn-`T+1` snake-state snapshot together with the turn-`T+1` turn events (Section 4.8).
- (d) **Full-game subscription**: a client that connects mid-game and wants the complete history shall be able to subscribe to all historical records and receive them as an initial delivery followed by incremental updates.

**04-REQ-055**: Subscription deliveries shall be subject to the visibility filter of Section 4.9 on the same terms as direct queries.

**04-REQ-056**: When turn resolution commits turn `T`'s state, all new rows, events, and record updates produced by that commit shall be delivered to subscribed clients as a single logical update corresponding to the atomic turn-resolution transaction. Clients shall not observe a state in which, e.g., the new snake-state snapshot has arrived but the corresponding turn events have not.

---

### 4.11 Historical Reconstruction

**04-REQ-057**: For any completed turn `T` in `[0, latestCompletedTurn]`, a subscribed client with an appropriate team admission shall, using only the runtime's query interface, be able to reconstruct:
- (a) the positions, bodies, health, effects, and visibility states of every snake belonging to teams the client is authorised to observe at the boundary between turns `T` and `T+1`;
- (b) the positions of every item present on the board at the boundary between turns `T` and `T+1`;
- (c) each team's remaining time budget at the end of turn `T`;
- (d) the full list of turn events emitted during turn `T`'s resolution, subject to visibility filtering per 04-REQ-049.

**04-REQ-058**: Historical reconstruction shall not require the client to replay turn resolution or re-execute any game-rule logic. The per-turn state is directly queryable from the historical record as written by the resolving transaction.

**04-REQ-059**: Historical reconstruction shall remain valid across turn progression: as the runtime appends new turn records, previously queryable historical states shall remain queryable with identical results. No append-only record shall be retroactively altered.

---

### 4.12 Replay Export

**04-REQ-060**: After a win condition has been detected in Phase 10 of some turn `T_end` ([01-REQ-051], [01-REQ-054] through [01-REQ-057]), the runtime shall treat the game as **ended** for gameplay purposes: further move-staging and turn-declaration operations shall be rejected, and no further turns shall be resolved. Game-end rejection begins at the moment the final turn's transaction commits. In-flight staged moves or turn-declaration operations arriving after the commit of turn `T_end` shall be rejected as "game over" — there is no grace window between commit and enforcement.

**04-REQ-061**: After game-end detection, the runtime shall make the complete historical record available to Convex for replay persistence ([05-REQ-040]). The complete record comprises the static board layout (as received from Convex at init time), the dynamic gameplay parameters seeded at initialisation, the per-game seed ([01-REQ-059], [01-REQ-060]) so that downstream systems can verify deterministic reproducibility per 04-REQ-069 (see 04-REVIEW-013; [01-REQ-059]'s "game client" exclusion does not apply to the privileged Convex replay-export caller authenticated per [03-REQ-048]), the full per-turn historical record of snake states (04-REQ-006), the full item-lifetime record (04-REQ-007), the full per-turn time-budget record (04-REQ-009), the full turn-timing record (04-REQ-010), the full turn-event record (04-REQ-011), and the participant attribution record of Section 4.4. Because `stagedBy` fields already carry `Agent` values (resolved at registration time per 04-REQ-020), no Identity→email/team-reference resolution step is required during replay export; the exported record already contains Convex-interpretable `Agent` values throughout. Retrieval is performed by Convex authenticated per [03-REQ-048]. The retrieval pattern — Convex-pull via HTTP action, runtime-push to a Convex endpoint, or the record being bundled into the game-end notification payload of 04-REQ-061a — is a Phase 2 Design concern; any such mechanism is permitted provided the requirements of this section are satisfied. (See also [03-REQ-045].)

**04-REQ-061a**: The runtime shall notify Convex when a game has ended, consistent with [05-REQ-038]'s obligation that Convex learns of game end in order to orchestrate score display, replay persistence, teardown, and next-game preparation. Convex registers its interest in receiving such notifications for a given instance via a privileged operation authenticated per [03-REQ-048]. The notification mechanism shall use best-practice platform affordances (e.g., SpacetimeDB's webhook subscription mechanism if available, with Convex having registered its interest at game-initialisation time); specifics are a Phase 2 Design concern. The notification need not itself carry the complete historical record; its minimum obligation is to convey that the game has ended and to identify the instance.

**04-REQ-062**: The replay-export client shall be authenticated as the Convex platform runtime per [03-REQ-048]. The runtime shall not permit any other caller to retrieve the bulk replay export. 04 requires only that the privilege be distinct from ordinary gameplay admission; detailed credential mechanics are owned by [03].

**04-REQ-063**: The runtime shall not be torn down until the replay-export client has confirmed successful retrieval of the replay data. Teardown is a Convex-orchestrated operation per [02-REQ-021]; 04's obligation is to remain available until export completes and to not silently discard data that has not yet been read.

**04-REQ-064**: During the post-game-end window in which replay export is in progress, visibility filtering (Section 4.9) shall not be applied to the replay-export client's queries. The replay export is the complete game record, including all previously invisible snakes' states, because downstream replay systems need the full game log regardless of which team's perspective an end viewer later chooses.

**04-REQ-065** *(negative)*: The runtime shall not spontaneously transmit gameplay or replay data to any external system during gameplay. Game-end notification ([04-REQ-061a]) and any bundled or runtime-initiated delivery of the historical record to Convex at game end ([04-REQ-061]) are explicitly permitted and do not constitute violations of this requirement.

---

### 4.13 Invariants and Cross-Cutting Negative Requirements

**04-REQ-066** *(negative)*: The runtime shall not modify any historical record after the turn-resolution transaction that produced it has committed. In particular, it shall not rewrite prior-turn snake states, event records, or time-budget entries in response to later discoveries or corrections. Historical correctness is the responsibility of the resolving transaction at the time of commit.

**04-REQ-067** *(negative)*: The runtime shall not deliver events, snake states, or any other state referring to a turn `T` to subscribed clients until the atomic turn-resolution transaction for turn `T` has fully committed. Clients shall not observe partial turn-resolution state.

**04-REQ-068** *(negative)*: The runtime shall not consult any external system (Convex, Centaur Server, or other) during gameplay. All data required for gameplay — rules, dynamic gameplay parameters, pre-computed initial game state, game identifier, participating-team roster, participant attribution record — is seeded at initialisation and never refreshed during the game's life. JWT signature validation is performed by SpacetimeDB's built-in OIDC mechanism (which fetches the JWKS at startup), not by application-level code during gameplay.

**04-REQ-069**: The runtime shall be deterministic with respect to its seeded randomness ([01-REQ-059], [01-REQ-060]): given identical initial seeds, configuration, and sequences of staged-move writes with identical timing, the resulting historical record shall be identical. (This enables test reproducibility and deterministic replay verification.)

**04-REQ-070** *(negative)*: The runtime shall not treat any connection as having elevated privileges beyond those derived from its JWT `sub` claim role and team association. Captain status, timekeeper role, and other Convex-side operator role distinctions ([03], [08]) shall not be visible to or enforceable by the runtime.

---

## REVIEW Items

### 04-REVIEW-001: Scheduled reducer for clock expiry as an architectural commitment — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: The informal spec (§10, `resolve_turn` bullet) mentions that turn resolution is "also triggered by clock expiry (scheduled reducer at max turn time as a fallback)". This sounds like an implementation detail — a scheduled reducer is a SpacetimeDB-specific mechanism. 04-REQ-032 abstracts this to "the runtime shall autonomously detect when a team's per-turn clock has reached zero... and treat that event as an implicit turn-over declaration". Whether this is correctly abstract-or-binding depends on whether alternative clock-expiry mechanisms (polling, push-from-Convex, wall-clock events on reducer entry) are acceptable substitutes.
**Question**: Is "scheduled reducer" an architectural commitment that requirements should encode, or an implementation choice left to Phase 2 design?
**Options**:
- A: Keep 04-REQ-032 abstract — runtime detects clock expiry by any suitable mechanism; specifics are Design. (Current draft.)
- B: Strengthen to require an internally scheduled mechanism (no external triggering of clock-expiry fallback), so that Convex cannot be in the loop for clock-expiry detection even as a fallback. This would preserve [04-REQ-068]'s "no external systems during gameplay" invariant more crisply.
**Informal spec reference**: §10, `resolve_turn` bullet.

**Decision**: Option A — keep 04-REQ-032 abstract; clock-expiry detection mechanism is a Phase 2 concern.
**Rationale**: [04-REQ-068]'s "no external systems during gameplay" invariant already binds the runtime to internal-only triggering of clock expiry (Convex cannot be consulted during gameplay), so Option B's stricter wording adds no constraint that isn't already present. If a future change weakens [04-REQ-068], this decision should be revisited.
**Affected requirements/design elements**: None — 04-REQ-032 stands as drafted.

---

### 04-REVIEW-002: `stagedBy` sentinel for fallback-determined moves — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 04-REQ-040 requires movement events to distinguish fallback-determined moves (where no player or Centaur Server staged a move for a snake, and [01-REQ-042]'s fallback rule applied) from staged moves. The informal spec's turn event schema (§14) defines `snake_moved` with a mandatory `stagedBy: Identity` field, which leaves no room for "no staged move was consumed". Possible resolutions: (a) make `stagedBy` nullable in the event schema and use null for fallback; (b) use a distinguished "runtime fallback" sentinel Identity value; (c) split the event into two distinct event kinds. The current draft punts to design ("the distinction shall be explicit in the event record") but the representation affects the closed event set of 04-REQ-043.
**Question**: Which representation should the closed event set use?
**Options**:
- A: `stagedBy` becomes nullable (null = fallback).
- B: A distinguished sentinel value is reserved and documented.
- C: Split `snake_moved` into `snake_moved_staged` and `snake_moved_fallback` as two event kinds in the closed set.
**Informal spec reference**: §14, `snake_moved` event.

**Decision**: Option A — `stagedBy` is nullable and null denotes a fallback-determined move.
**Rationale**: Simplest of the three and does not inflate the closed event set. Option B (sentinel Identity) leaks a magic value into a field whose type semantics are meant to be opaque per [03-REQ-032]. Option C doubles the movement event kind with no information gain. Assumes fallback is the only case in which a movement event has no staging writer; if a future rule change introduces additional null-stagedBy cases (e.g., runtime-initiated forced moves), the decision still holds but the set of null-meanings should be re-surveyed.
**Affected requirements/design elements**: 04-REQ-040 rewritten to make nullable-with-null-for-fallback explicit. 04-REQ-043(a) annotated to note the nullable typing of `stagedBy` in movement events.

---

### 04-REVIEW-003: Completeness of the closed event set — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 04-REQ-043 enumerates the closed event set as (a) movement, (b) death, (c) severing, (d) food consumption, (e) potion collection, (f) food spawning, (g) potion spawning, (h) effect application, (i) effect cancellation. This mirrors informal spec §14 closely but differs in one way: §14 does not include an explicit "severing" event kind — it folds severing into `snake_severed` as a combat event — which the current draft also uses, so that matches. However, §14 also lacks an event for **hazard damage applied to a snake that survives the hazard** (i.e., Phase 5b without Phase 5d death). Under the current draft, a snake that enters a hazard cell, loses health, and survives the turn produces no dedicated event — a replay client would have to diff health between turns to detect hazard application. This is acceptable for pure visualisation (hazard cells are visible terrain; the snake's health change is visible in its state snapshot) but blocks downstream analytics that would want an explicit hazard-damage event. Also missing: an event for the `ateLastTurn`-driven growth retention in Phase 2 (the growth bit is folded into the `snake_moved.grew` flag, which is sufficient if the growth/movement timing is well-understood by clients).
**Question**: Is the closed event set complete for the Team Snek ruleset, or should additional event kinds be added (e.g., `hazard_damage`, explicit `starvation_tick`)?
**Options**:
- A: Keep the event set as drafted (matches informal spec §14); rely on state-snapshot diffing for Phase 5 health changes. (Current draft.)
- B: Add `hazard_damage` as a tenth event kind, emitted for each surviving snake that took hazard damage in Phase 5b. Starvation deaths are already covered by the death event (b).
- C: Add both `hazard_damage` and `health_tick` events for completeness, at the cost of event volume.
**Informal spec reference**: §14.

**Decision**: Option B — add `hazard_damage` as a tenth event kind `(j)` in 04-REQ-043, emitted for each surviving snake that took hazard damage in Phase 5b.
**Rationale**: Option A was in tension with 04-REQ-044 ("event records shall not require the client to diff successive snake-state snapshots to recover information that the event describes"). Hazard damage to a surviving snake is exactly the kind of state change whose signal would otherwise be carried only by a snapshot diff. Option B also unlocks downstream analytics. Option C is rejected as gratuitous event-volume overhead — starvation is already carried by the death event (b) with cause `starvation`, and a per-turn `health_tick` event would be redundant with per-turn snake state.
**Affected requirements/design elements**: 04-REQ-043 extended with entry `(j) Hazard damage`. Informal spec §14's closed set is now superseded by [04-REQ-043] on this point. **Downstream impact**: when [08]'s replay viewer consumes the closed event set, it must include hazard_damage in its renderers.

---

### 04-REVIEW-004: Intra-phase event ordering determinism — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 04-REQ-045 requires events within a turn to be "totally ordered... reflects the phase order and, within a phase, a deterministic intra-phase ordering derivable from the turn seed". The turn seed is well-defined by [01-REQ-060]. But within a phase, multiple snakes may produce events (e.g., three snakes all eat food in Phase 5). The order in which those events are written affects replay bit-exactness for tooling that compares event streams. The informal spec does not specify intra-phase ordering rules. Possibilities include: (a) snake ID order; (b) turn-seed-shuffled order; (c) the order in which the pipeline's internal iteration happens to process snakes (implementation-defined). Committing to a specific rule at the requirements level affects what tests can assert.
**Question**: What intra-phase ordering rule should requirements commit to?
**Options**:
- A: Snake ID ascending — simple, deterministic, debuggable.
- B: Turn-seed-shuffled — avoids a systematic bias where low-ID snakes are always "first" in event streams.
- C: Implementation-defined — only determinism across replays is required, not a specific order. (This is what 04-REQ-045 currently implies.)
**Informal spec reference**: §14, no explicit ordering rule.

**Decision**: Option A — ascending snake identifier for snake-subject events; ascending item identifier for item-spawn events (food/potion spawning), which follow all snake-subject events within the same phase.
**Rationale**: Simplest, most debuggable, and requires no seed-derived ordering logic. Option B's concern about "low-ID snakes always appearing first" is cosmetic — event streams are not a fairness mechanism and clients that care about fairness are reading game state, not event ordering. Option C would leave the ordering unspecified enough that two conforming implementations could produce bit-different event streams for the same game seed, which defeats the purpose of 04-REQ-069's determinism commitment for cross-implementation test comparison. This decision assumes snake identifiers are stable per game (they are, per [01] Phase 2 typing). If a future change introduces multi-subject events or subject-less events beyond item spawns, the ordering rule will need extension.
**Affected requirements/design elements**: 04-REQ-045 rewritten to make the ascending-snake-ID rule explicit and to specify the fallback for events without a snake subject.

---

### 04-REVIEW-005: Replay-export authorisation mechanism — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 04-REQ-062 says the replay-export client is "authenticated as the Convex platform runtime" and defers the mechanism to [03] / [05]. [03]'s current draft (Sections 3.3 and 3.4) covers Centaur Server credentials and SpacetimeDB access tokens for gameplay, but does not specify how Convex authenticates *itself* to the SpacetimeDB instance for privileged operations like initialisation (04-REQ-013) or replay export (04-REQ-061). The informal spec §10 mentions "validates admin token embedded at deploy time" for `initialize_game`. This is a cross-module gap: does the privileged Convex-to-runtime authentication use a separate admin token seeded at deploy time, SpacetimeDB module-owner credentials, or yet another mechanism?
**Question**: Where should the privileged Convex-to-SpacetimeDB authentication mechanism be specified?
**Options**:
- A: In [03] as a new requirement section — privileged Convex-to-runtime auth is an identity/credential concern.
- B: In [04] as a new requirement section — the runtime's privileged operations are its own concern.
- C: In [05] as part of orchestration — Convex is the initiator and owns the mechanism.
**Informal spec reference**: §10 "validates admin token embedded at deploy time"; §9.4 step 4.

**Decision**: Option A — [03] owns the requirement. A single new requirement in [03] is sufficient; beyond-best-practice security detail is out of scope for Phase 1.
**Rationale**: [03] is already the module that owns every other credential in the system, so placing this there keeps credential semantics in one place. Only unusual credential situations (e.g., Centaur Servers without their own Google auth) warrant extensive requirements-level elaboration; Convex-to-SpacetimeDB is a standard platform-to-platform authentication situation that best-practice affordances of each platform can handle, so the requirement just needs to state that the capability exists.
**Affected requirements/design elements**: Added as [03-REQ-048] in a new subsection §3.9 "Convex Access to the SpacetimeDB Runtime". Cross-references to [03-REQ-048] added to [04-REQ-013] (privileged initialisation), [04-REQ-061] (end-of-game historical record retrieval), [04-REQ-061a] (game-end notification subscription), and [04-REQ-062] (replay-export authentication). [05-REQ-032] and [05-REQ-040] may likewise reference [03-REQ-048] when [05] is next touched; not done as part of this resolution because those edits are out of scope for module 04.

---

### 04-REVIEW-006: Game-end detection granularity (turn commit vs Phase 10 completion) — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 04-REQ-060 says game-end treatment applies "after a win condition has been detected in Phase 10". Phase 10 is inside the atomic turn-resolution transaction (04-REQ-037). So in practice, game-end detection happens as part of the same transaction that commits the final turn's state. The runtime then needs to transition into "no more turns" mode *after* the commit. The current wording is not explicit about whether game-end rejection of gameplay operations begins immediately on the commit or whether there is a short tail-end window. This matters for edge cases like a staged move arriving concurrent with the final turn's commit.
**Question**: Should the transition to game-ended state be explicitly tied to the commit point of the win-detecting turn, and should in-flight operations arriving during or after commit be explicitly specified?
**Options**:
- A: Game-end rejection begins at the moment the final turn's transaction commits. In-flight staged moves that arrive after commit are rejected as "game over". (Implied by current draft.)
- B: Make this explicit in the requirements — add a clause to 04-REQ-060 stating the commit boundary.
**Informal spec reference**: §5 Phase 10; §9.4 step 7.

**Decision**: Option A — game-end rejection begins at the moment the final turn's transaction commits. In-flight operations arriving after commit are rejected as "game over."
**Rationale**: The commit of the win-detecting turn is a natural and unambiguous boundary. SpacetimeDB's ACID transaction model means Phase 10's win-condition detection and the state update are part of the same atomic commit. Once that commit is visible, the game is over. There is no meaningful grace window to define — any operation arriving after the commit point is operating on a game that has already ended. This is already implied by the draft but has been made explicit in 04-REQ-060 with commit-boundary language.
**Affected requirements/design elements**: 04-REQ-060 updated with explicit commit-boundary language: "Game-end rejection begins at the moment the final turn's transaction commits. In-flight staged moves or turn-declaration operations arriving after the commit of turn `T_end` shall be rejected as 'game over' — there is no grace window between commit and enforcement."

---

### 04-REVIEW-007: Historical record size and retention semantics during long games — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 04-REQ-004 requires the historical record to support reconstruction of any past turn in the game. For a game with `maxTurns = 1000`, this could imply a large working set held inside a SpacetimeDB instance. The informal spec does not address retention bounds or memory pressure. Two sub-questions: (a) is unbounded historical retention part of the runtime's contract, or is there an implicit cap? (b) if the runtime has a cap, do clients lose the ability to scrub to very early turns?
**Question**: Does the runtime commit to unbounded in-game historical retention, and if so, is this a performance concern that Phase 2 design should address?
**Options**:
- A: Unbounded retention for the full life of the game, regardless of duration. Performance is Phase 2's concern.
- B: Retention bounded by configuration; early turns evicted from live queries but still present in the eventual replay export.
- C: Retention unbounded for replay-export purposes but optionally windowed for live subscription queries.
**Informal spec reference**: §10.

**Decision**: Option A — unbounded retention for the full life of the game instance.
**Rationale**: Resolved after reading [05] Phase 1 draft. Instance lifetime is bounded by [05-REQ-037] (teardown occurs only after [05-REQ-040] has read the complete append-only game record and persisted it to Convex), and replay viewing never consults the runtime after teardown per [05-REQ-044]. [05] commits Convex to reading the full record in one pass at game end; a runtime-side retention cap (Option B) would break that commitment. Option C's subscription-windowing is a Phase 2 optimisation, not a requirements-level concern. Post-teardown retention is Convex's concern, not this module's. If a future change to [05] adopts streaming/incremental replay export rather than a single end-of-game read, this decision should be revisited.
**Affected requirements/design elements**: None — 04-REQ-004 stands as drafted.

---

### 04-REVIEW-008: Initialisation failure surfacing — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 04-REQ-017 requires the runtime to fail initialisation if board generation is infeasible per [01-REQ-061], and to surface the cause in a form Convex can relay to the room owner. The concrete form of that surfacing — error code, structured object, exception kind — is a Phase 2 concern. But requirements should at least say whether the surface is a synchronous error on the initialisation call or an asynchronous state that Convex polls for.
**Question**: Should the initialisation operation signal failure synchronously to its caller or leave the instance in an observable failure state that the caller reads back?
**Options**:
- A: Synchronous failure return — the privileged initialisation operation returns a failure outcome to Convex directly.
- B: Asynchronous — Convex writes an initialisation request, the runtime processes it, and a readback endpoint exposes success/failure.
- C: Hybrid — synchronous for quick-to-detect failures (e.g., obviously invalid config), asynchronous for board-generation retries that may take non-trivial time.
**Informal spec reference**: §9.4 step 4; §10 `initialize_game`.

**Decision**: Option A — synchronous failure return from the STDB init reducer to Convex, with architectural elaboration on scope.
**Rationale**: Under the updated architecture, board generation has moved entirely to Convex (see [02] §2.14 and updated 04-REQ-017). STDB no longer calls `generateBoardAndInitialState()` and does not perform bounded-retry feasibility logic. The `initialize_game` reducer receives a pre-computed initial game state from Convex and writes it to tables. The only failure mode remaining on the STDB side is structural validation of the received payload (correct dimensions, valid cell types, consistent snake count, etc.). A malformed payload indicates a coding error in Convex's board-generation or serialisation logic, not a user-facing configuration problem. This validation is fast and deterministic, making synchronous failure the natural and only reasonable choice. The primary user-facing failure path — board-generation infeasibility for a given configuration — is handled entirely by the Convex mutation that runs `generateBoardAndInitialState()`, which surfaces structured errors reactively to the web client during config mode, before any STDB instance is provisioned.
**Affected requirements/design elements**: 04-REQ-017 rewritten: STDB does not generate boards; the init reducer writes received state and validates structural integrity, rejecting malformed payloads synchronously as a coding-error exception. 04-REQ-013 rewritten: accepts a fully specified initial game state plus dynamic gameplay parameters, not a game seed or full `GameConfig`. Cross-reference: [05-REQ-032] updated to reflect Convex generating the board and passing the result to STDB.

---

### 04-REVIEW-009: Turn event ordering guarantees during subscription delivery — **RESOLVED**

**Type**: Proposed Addition
**Phase**: Requirements
**Context**: 04-REQ-056 says that all new state produced by a turn commit is delivered as a "single logical update". 04-REQ-045 requires events within a turn to be totally ordered. These together imply clients observe events in the specified total order, but the requirement does not explicitly assert that the *delivery order* to clients matches the *emission order*. Subscription systems sometimes deliver rows in storage order, which may not match emission order. For replay and animation correctness, clients need the guarantee that event order as observed matches event order as emitted.
**Question**: Should the module explicitly require subscription delivery to preserve emission order for turn events within a single turn?
**Proposed requirement**: "Subscribed clients shall receive turn events for a given turn in the order specified by 04-REQ-045. Delivery order shall match emission order."
**Informal spec reference**: §10 client query patterns; §14.

**Decision**: No new delivery-order requirement. A turn's events form a *set* — there are no causal or temporal dependencies between events within a turn; they are all produced atomically. The total ordering defined by 04-REQ-045 is a **canonical representation order** for storage and replay consistency, not an expression of causal sequence. The canonical order sorts events by: (1) phase, (2) event-type class within a phase, (3) ascending snake identifier within each event-type class (ascending item identifier for non-snake-subject events). Turn resolution does not depend on the temporal order in which events are received by the server within a turn. Because the canonical order is a property of the stored representation (not of delivery), clients that need deterministic replay ordering shall read from the stored record in canonical order; they shall not rely on subscription delivery order. No guarantee about subscription delivery order is added. 04-REQ-045 has been amended to make the set-based, event-type-class, and canonical-order distinctions explicit.

---

### 04-REVIEW-010: Scope of "data layer" visibility filter (RLS vs view) — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 04-REQ-047 requires visibility filtering "at the data layer" — i.e., not relying on cooperating clients. In SpacetimeDB this maps directly to Row Level Security (RLS) rules. But the requirement is deliberately phrased in abstract terms so it does not name RLS. A concern: if a future deployment uses a different storage substrate that does not support per-row filtering natively, is "data layer" the right abstraction, or should the requirement say "server-side filtering applied before delivery to a client"?
**Question**: Is "data layer" filtering the right abstraction, or should it be restated in terms of "server-side filtering applied to query results before delivery"?
**Options**:
- A: Keep "data layer" — it encompasses RLS and any future equivalent. (Current draft.)
- B: Restate as "server-side, pre-delivery" — decouples from substrate entirely.
**Informal spec reference**: §2 "SpacetimeDB (Game Runtime)"; §10.

**Decision**: Option A — keep "data layer" as the abstraction. It encompasses RLS and any future equivalent mechanism. No requirement text changes needed.

---

### 04-REVIEW-011: Interaction between `team_permissions` retention and STDB disconnect semantics — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 04-REQ-020 and 04-REQ-021 require the participant attribution record to persist for the full game lifetime, including across reconnections. SpacetimeDB connections have their own lifecycle — an Identity may be reused or may be per-connection. The requirement correctly abstracts away from this by saying "each connection identifier that has successfully registered" gets its own attribution entry, and closing a connection does not delete its entry. But this creates a subtle invariant: the runtime must treat connection identifiers as immutable historical facts even after the connection is gone. If SpacetimeDB's connection-identity semantics differ from this assumption (e.g., Identity is global and persistent across reconnections for the same client), the requirement is overspecified. If it's per-connection-ephemeral, the requirement is correct but Phase 2 needs to be careful.
**Question**: Does SpacetimeDB's Identity semantics match the requirement's assumption (per-connection, potentially reused across reconnects for the same client, but immutable once associated with a historical row)? This is a factual question about SpacetimeDB's platform behaviour that needs verification before Phase 2.
**Options**:
- A: Assume per-connection Identity (current draft); verify in Phase 2 and adjust if wrong.
- B: Verify now and restate if SpacetimeDB semantics are different.
**Informal spec reference**: §10 `register`; [03-REQ-044].

**Decision**: The unresolved question about SpacetimeDB Identity semantics is rendered moot by a higher-level architectural decision. Module 01 defines an `Agent` discriminated union (`{kind: 'centaur', centaurId}` | `{kind: 'operator', operatorId}`) as the module-local concept for event attribution (per resolved 01-REVIEW-011). The SpacetimeDB connection Identity is now resolved to an `Agent` value **at connection time** (in the `client_connected` lifecycle callback, when JWT `sub` claim contents are available), not deferred to replay-export time. Consequently:
- `stagedBy` fields stored in STDB carry `Agent | null`, not opaque Identity.
- The participant attribution record (04-REQ-020) maps each connection to its resolved `Agent` at connection time via `client_connected`.
- 04-REQ-039's "no-interpretation" constraint has been rewritten: the runtime does perform the Identity→Agent mapping, but solely at connection time from JWT claims; no further interpretation occurs during turn resolution or replay export.
- 04-REQ-061 no longer requires a resolution step at replay-export time; exported records already contain `Agent` values.
- Module 03 requirements (03-REQ-032, 03-REQ-044, 03-REQ-045) and the 03-REVIEW-005 RESOLVED block have been updated accordingly.

**Affected requirements**: 04-REQ-020, 04-REQ-021, 04-REQ-026, 04-REQ-038(c), 04-REQ-039, 04-REQ-040, 04-REQ-061; cascading to 03-REQ-032, 03-REQ-044, 03-REQ-045, 03-REVIEW-005.

---

### 04-REVIEW-012: Visibility of turn-0 initial food placements to opposing teams — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: Initial food items are placed during initialisation per [01-REQ-017] and recorded with spawn turn 0 per 04-REQ-007. Visibility filtering (Section 4.9) filters *snake* state, not item state. But an opponent team observing initial food placements could, in principle, infer the approximate locations of enemy starting positions (since initial food is one-per-snake placed among eligible cells). Whether this is a visibility-filter concern depends on whether starting-position information is considered private.
**Question**: Is there any expectation that initial snake positions are hidden from opponents before turn 0 observations begin? If so, initial food placements may need to be filtered too; if not (i.e., all teams see all starting positions from turn 0 onward as a matter of game design), no additional requirement is needed.
**Options**:
- A: Starting positions and initial food are fully public from turn 0; no additional filtering. (Current draft assumption.)
- B: Starting positions are private until each team's snakes become visible through their own actions — would require additional filtering.
**Informal spec reference**: §4.4, §4.5; no explicit statement.

**Decision**: Option A — starting positions and initial food are fully public from turn 0; no additional filtering needed.
**Rationale**: Snakes are always visible on turn 0, so there is no pre-game-start window during which enemy positions are hidden. Initial food placement is random among eligible cells, so observing those placements reveals negligible positional information about enemy snakes. The game design treats starting state as public; there is no stated expectation of positional privacy at turn 0.
**Affected requirements/design elements**: None — 04-REQ-047's visibility-filtering scope stands as drafted (snake state only, not item state).

---

### 04-REVIEW-013: Game-seed accessibility and deterministic-replay testability — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 04-REQ-069 requires the runtime to be deterministic with respect to seeded randomness. [01-REQ-059] says the per-game seed "shall not be accessible to any game client". The combination creates tension for deterministic-replay testing: if the seed is inaccessible to clients, how can a test harness verify the game log is reproducible from the seed? One answer: determinism is a property of the runtime that is verified via privileged (non-client) channels; clients don't need the seed. This is consistent with [01-REQ-059] but leaves 04-REQ-069 untestable by ordinary integration tests.
**Question**: Should the per-game seed be accessible to the privileged replay-export client (04-REQ-061) so that a replay export can be verified for determinism downstream? This would be a narrow relaxation of [01-REQ-059] for privileged callers only.
**Options**:
- A: Seed remains inaccessible to all callers including replay export. Determinism is a runtime property verified by internal tests only.
- B: Seed is part of the replay export payload. Downstream systems (replay viewer, test harness) can use it to verify reproducibility and to re-derive any per-turn randomness outputs.
- C: Seed is exposed only to the privileged replay-export call, not to any gameplay client.
**Informal spec reference**: §4.4; §10.

**Decision**: Option B — the game seed is included in the replay-export payload (04-REQ-061) so that downstream systems (Convex replay storage, test harnesses) can verify deterministic reproducibility.
**Rationale**: The seed must be exported to Convex to become part of the persisted replay data. [01-REQ-059]'s constraint that the seed "shall not be accessible to any game client" is about preventing Centaur Servers from accessing the seed *during gameplay* — which would allow them to predict item spawns and gain an unfair advantage — not about preventing the seed from appearing in post-game replay data held by the privileged platform. The replay-export caller is authenticated per [03-REQ-048] and is therefore not a "game client" in the sense of [01-REQ-059]. Including the seed in the export is the only way to make 04-REQ-069's determinism guarantee externally verifiable.
**Affected requirements/design elements**: 04-REQ-061 amended to explicitly include the per-game seed in the enumerated contents of the complete historical record.

---

### 04-REVIEW-014: Final submission pass semantics inside SpacetimeDB — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: Informal spec §6.8 describes a "final submission" by the Centaur Server bot framework "immediately before the turn deadline flushes all dirty automatic-mode snakes." That final submission happens in the Centaur Server, not in SpacetimeDB, and it stages moves via 04-REQ-024. From 04's perspective, the final submission is just a burst of staged moves arriving shortly before `declare_turn_over`. No additional requirement should be needed on the SpacetimeDB side, but I want to flag this to confirm no hidden coordination requirement exists (e.g., a "final submission barrier" reducer) that would need a home in 04.
**Question**: Is the "final submission pass" entirely a Centaur Server concern, with no runtime-side coordination, or does the runtime need an explicit requirement for handling a pre-declaration burst of staged moves?
**Options**:
- A: Entirely a Centaur Server concern; no additional 04 requirement needed. (Current draft assumption.)
- B: Add a requirement that the runtime accepts staged moves up to the instant of `declare_turn_over`, and that turn resolution consumes whatever was staged at that instant (already implied by 04-REQ-038(a)).
**Informal spec reference**: §6.8.

**Decision**: Option A — the "final submission pass" is entirely a Centaur Server concern; no additional 04 requirement is needed.
**Rationale**: From 04's perspective, the final submission is an ordinary burst of staged-move writes arriving via 04-REQ-024 before `declare_turn_over`. 04-REQ-038(a) already requires turn resolution to consume whatever was staged at the instant of declaration, so the runtime's behaviour is already fully specified. No runtime-side coordination barrier or dedicated reducer is required; the ordering is entirely the Centaur Server's responsibility.
**Affected requirements/design elements**: None — 04-REQ-024 and 04-REQ-038(a) stand as drafted.

---

### 04-REVIEW-015: Provenance of the per-instance admission-ticket validation secret — **RESOLVED (obsolete)**

**Type**: Gap (raised 2026-04-10 on reading [05] Phase 1 draft)
**Phase**: Requirements
**Original context**: This review item asked whether 04 should add an explicit requirement for accepting the per-instance HMAC admission-ticket validation secret as an init-time parameter.
**Resolution**: The OIDC auth redesign eliminates per-instance signing secrets entirely. Client authentication is now handled by SpacetimeDB's built-in OIDC JWT validation against the Convex platform's public key (see [03] §3.17). The `initialize_game` reducer receives the game's unique identifier (for `aud` claim validation in `client_connected`) and the participating-team roster, but no signing secret. This review item is therefore obsolete — the question it raised no longer applies.

---

### 04-REVIEW-016: Admission-ticket validation secret confidentiality on the runtime side — **RESOLVED (obsolete)**

**Type**: Proposed Addition (raised 2026-04-10 on reading [05] Phase 1 draft)
**Phase**: Requirements
**Original context**: This review item proposed a negative requirement that the per-instance HMAC secret not be exposed via any subscription, query, or replay export.
**Resolution**: The OIDC auth redesign eliminates per-instance secrets entirely. No signing secret is stored in the runtime — JWT signature validation is performed by SpacetimeDB's built-in OIDC mechanism using the platform's public key fetched via JWKS. The confidentiality concern that motivated this review item no longer exists.

---

### 04-REVIEW-017: Symmetric cross-runtime isolation invariant

**Type**: Proposed Addition (raised 2026-04-10 on reading [06] Phase 1 draft)
**Phase**: Requirements
**Context**: [06-REQ-045] and [06-REQ-046] assert, from the Centaur-state side, that SpacetimeDB does not read from or write to Centaur state and that Centaur state does not expose any affordance for writing to STDB-owned state. These negatives are consistent with [02]'s topology but are currently only stated in [06]. 04 has a broader "no external consultation during gameplay" invariant ([04-REQ-068], which I should double-check), but no explicit symmetric negative about not consulting Convex (platform or Centaur) at all. Adding the symmetric negative on the 04 side would make the boundary belt-and-braces and would prevent a Phase 2 designer from, say, reaching into Convex during turn resolution to read a bot parameter.
**Question**: Is [04-REQ-068] (or whichever 04 requirement most closely covers this) sufficient, or should a dedicated negative requirement name Convex explicitly and cite [06-REQ-045/046]?
**Options**:
- A: Rely on [04-REQ-068]'s general "no external systems during gameplay" invariant; no new requirement needed.
- B: Add an explicit 04 requirement mirroring [06-REQ-045/046]: the runtime shall not read from or write to Convex during gameplay; the sole permitted runtime↔Convex interactions are (i) init-time parameter delivery per [05-REQ-032] and (ii) end-of-game replay export per [05-REQ-040] / 04-REQ-061.
- C: Same as B but also explicitly carve out the Convex-driven teardown signal (if any is needed — depends on how game-end detection lands per 04-REVIEW-006).
**Informal spec reference**: §2 (topology); [06-REQ-045], [06-REQ-046].
