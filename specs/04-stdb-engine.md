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

**04-REQ-013**: The runtime shall expose a **privileged initialisation operation** that may be called exactly once per instance, before any connection is admitted, by the Convex orchestration path described in [02-REQ-019]. The operation shall accept, at minimum: the game configuration per [01]'s configurable parameters and [09.3] of the informal spec, the participating-team roster per [03-REQ-039], the admission-ticket validation secret per [03-REQ-022], and the initial chess-timer budget per team per [01-REQ-035].

**04-REQ-014**: Successful completion of the initialisation operation shall leave the runtime in a state where (a) the static board layout ([01-REQ-008] through [01-REQ-013]) is written, (b) each snake's initial state ([01-REQ-020], [01-REQ-021]) is written as the turn-0 snapshot, (c) initial food placements ([01-REQ-017]) are written as spawn-turn-0 items, (d) each team's initial time budget ([01-REQ-035]) is recorded, (e) the admission-ticket validation secret is available for use by the admission path (Section 4.4), and (f) the participating-team roster and per-team authorised human email addresses (per [03-REQ-023(d)(e)]) are available for use by the admission path.

**04-REQ-015**: Once the initialisation operation has completed successfully, the runtime shall be in the state of **turn 0 before Phase 1** and shall be ready to accept connection registrations (Section 4.4), staged moves (Section 4.5), and turn-over declarations (Section 4.6).

**04-REQ-016** *(negative)*: The runtime shall reject any attempt to invoke the privileged initialisation operation after it has completed once. The runtime shall also reject any move-staging, turn-declaration, or connection-registration operation submitted before the initialisation operation has completed.

**04-REQ-017**: The runtime shall perform board generation (hazard placement, fertile tile selection, territory assignment, parity selection, starting-position placement, and initial food placement) during the initialisation operation in conformance with [01-REQ-010] through [01-REQ-017] and the bounded-retry feasibility rule [01-REQ-061]. If all allowed board-generation attempts fail, the initialisation operation shall fail in a way that prevents any connection from being admitted to the instance, and shall surface the failure cause to the caller in a form that allows Convex to report infeasibility to the room owner per [01-REQ-061].

---

### 4.4 Connection Admission

**04-REQ-018**: The runtime shall expose a **connection registration operation** through which a connecting client presents an admission ticket per [03-REQ-019]. The operation shall validate the ticket per [03-REQ-021] and [03-REQ-023] using the admission-ticket validation secret seeded during initialisation (Section 4.3).

**04-REQ-019**: Upon successful ticket validation, the runtime shall associate the calling connection's opaque connection identifier with the ticket's asserted team (except for spectator tickets, which associate no team per [03-REQ-026]) and asserted role (human participant, Centaur Server participant, or spectator). This association shall persist for the lifetime of the connection without further ticket re-checks, consistent with [03-REQ-021].

**04-REQ-020**: The runtime shall maintain, for the full lifetime of the game instance, a **participant attribution record** that maps each connection identifier that has successfully registered to enough information to later resolve it, at replay export time, to either (a) the email address of a human participant or (b) a reference identifying the Centaur Server participant of a specific team. This record shall be populated on each successful registration from the ticket contents. (Satisfies [03-REQ-044].)

**04-REQ-021**: The participant attribution record shall not be mutated or deleted when the underlying connection is closed, whether by network interruption, client shutdown, or reconnection. A client that reconnects shall obtain a fresh connection identifier and a fresh attribution entry; previous entries remain intact so that historical `stagedBy` references from earlier turns remain resolvable.

**04-REQ-022**: The runtime shall reject any connection registration whose admission ticket fails any of the criteria enumerated in [03-REQ-023]. A rejected registration shall not result in any association or attribution record being written.

**04-REQ-023** *(negative)*: The runtime shall not accept any alternative admission mechanism (e.g., pre-shared secrets, IP allowlists, direct credentials). Connection admission is governed exclusively by admission tickets issued per [03].

---

### 4.5 Move Staging

**04-REQ-024**: The runtime shall expose a **move-staging operation** that accepts, from a registered connection, a snake identifier and a direction ([01-REQ-001]). The runtime shall accept the operation only if the calling connection is registered as a human participant or Centaur Server participant for the team that owns the named snake; all other callers shall be rejected. (Satisfies [03-REQ-028] within the runtime.)

**04-REQ-025**: At any instant during a turn, the runtime shall retain at most one staged move per snake. A new staged move for a snake whose previous staged move has not yet been consumed by turn resolution shall overwrite the previous staged move. Overwrite is the sole mechanism for changing a staged move; there is no separate cancel-move operation. (Satisfies [02-REQ-011].)

**04-REQ-026**: Each accepted staged move shall be recorded together with the opaque connection identifier of the connection that wrote it (`stagedBy`) and the wall-clock time at which the move was accepted. When an overwrite occurs, these fields shall reflect the most recent writer and time, discarding the previous writer's identity and time.

**04-REQ-027**: The staged-move storage shall be **transient**: it shall not form part of the historical record of Section 4.2. Staged moves are consumed and cleared by turn resolution (Section 4.7); after clearing, no record of the previously staged direction shall remain in the runtime except as captured by the movement event emitted for the turn in question (Section 4.8).

**04-REQ-028**: The runtime shall not validate move legality (e.g., reject moves that lead into walls) at the moment of staging. Legality is determined only during turn resolution, where a fatal direction kills the snake in Phase 3 per [01-REQ-044]. This preserves the "explore a direction to see its score" affordance described in [08]'s live-operator interface.

**04-REQ-029** *(negative)*: The runtime shall not permit a connection to stage a move for a snake belonging to a team other than the team the connection was admitted for, even if a connection identifier from the opposing team's admission is supplied in a spoofed parameter. Team membership is the connection-level association established in Section 4.4 and cannot be asserted per-call.

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

**04-REQ-038**: Within the atomic transaction of turn resolution, the runtime shall, in order: (a) read the current set of staged moves; (b) run the eleven-phase pipeline of [01-REQ-041]; (c) for each snake that moved, emit a movement event recording the direction moved, whether growth occurred, and the opaque `stagedBy` connection identifier of the connection that staged the move that was consumed (or a well-defined sentinel if the move was determined by the fallback rule of [01-REQ-042] because no move was staged); (d) emit all other turn events required by [01-REQ-052] (Section 4.8); (e) append the new turn-`T+1` snake-state snapshots, updated item-lifetime records, and post-turn time-budget entries to the historical record; (f) clear all staged moves; (g) add the budget increment to each team's budget per [01-REQ-036].

**04-REQ-039**: The `stagedBy` value captured in movement events shall be the opaque connection identifier of the most recent writer per 04-REQ-026, without any interpretation, mapping, or substitution by the runtime. (Satisfies [03-REQ-032]'s no-interpretation constraint.)

**04-REQ-040**: If a snake had no staged move at the moment of turn resolution and its direction was determined by the Phase 1 fallback rule of [01-REQ-042], the movement event for that snake shall distinguish the fallback case from the staged-move case. The `stagedBy` field for fallback-determined moves shall not be populated with a connection identifier; the distinction shall be explicit in the event record. The fallback case covers both (a) subsequent-turn fallback to `lastDirection` per [01-REQ-042(b)] and (b) turn-0 random fallback per [01-REQ-042(c)] when no move was staged.

**04-REQ-041** *(negative)*: Once turn resolution for turn `T` has committed, the runtime shall not accept further staged moves or turn-over declarations attributable to turn `T`. Any such operations received after commitment shall either be treated as pertaining to turn `T+1` (if they arrive after the new turn has begun) or rejected, at the runtime's discretion; the runtime shall not silently reorder them into turn `T`'s committed state.

**04-REQ-042**: After a turn-resolution commit, the runtime shall begin turn `T+1` by applying the budget-increment rule ([01-REQ-036]), computing each team's new per-turn clock per [01-REQ-037], and accepting staged moves and turn-over declarations for the new turn.

---

### 4.8 Turn Event Emission

**04-REQ-043**: The runtime shall emit, as part of each turn's atomic resolution transaction, a set of **turn events** covering every observable outcome of that turn. The set of event kinds shall be a **closed enumeration** — no extensibility mechanism shall permit new event kinds to be added without a deliberate revision of this requirement. The closed set shall comprise at minimum:

- (a) **Snake movement**: for each snake that executed a move in Phase 2, a record capturing the snake identifier, the originating cell, the destination cell, the direction, whether the tail was retained (growth), and `stagedBy` per 04-REQ-039 and 04-REQ-040.
- (b) **Snake death**: for each snake that died in Phase 3, Phase 5, or other phase of the pipeline, a record capturing the snake identifier, the cause of death (wall, hazard, self-collision, body-collision, head-to-head, starvation), the location, and — where applicable — the identifier of the snake responsible (e.g., the attacker in a body-collision kill).
- (c) **Severing**: for each severing outcome per [01-REQ-044c], a record capturing the attacker identifier, the victim identifier, the contact cell, and the number of segments removed.
- (d) **Food consumption**: for each snake that consumed food in Phase 5, a record capturing the snake identifier, the cell, and the resulting health value.
- (e) **Potion collection**: for each snake that consumed a potion in Phase 6, a record capturing the collector identifier, the cell, the potion type, and the set of teammates affected by the resulting pending effects.
- (f) **Food spawning**: for each food item spawned in Phase 7, a record capturing the new item's identifier and cell.
- (g) **Potion spawning**: for each potion item spawned in Phase 8, a record capturing the new item's identifier, cell, and potion type.
- (h) **Effect application**: for each effect that was moved from `pendingEffects` to `activeEffects` in Phase 9, a record capturing the affected snake, effect type, and expiry turn.
- (i) **Effect cancellation**: for each effect that was removed in Phase 9 — whether by disruption-triggered cancellation per [01-REQ-031] or by natural expiry per [01-REQ-050] — a record capturing the affected snake, effect type, and the reason (`disruption` or `expiry`).

**04-REQ-044**: Each turn-event record shall include enough information for a replay or animation client to visualise the associated outcome without re-executing turn resolution. In particular, event records shall not require the client to diff successive snake-state snapshots to recover information that the event describes (e.g., a death event shall carry the cause explicitly rather than requiring the client to infer it from a snake's alive-to-dead transition).

**04-REQ-045**: The set of emitted events for a given turn shall be totally ordered within that turn in a way that reflects the phase order and, within a phase, a deterministic intra-phase ordering derivable from the turn seed ([01-REQ-060]) and stable across independent replays of the same game seed.

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

**04-REQ-060**: After a win condition has been detected in Phase 10 of some turn `T_end` ([01-REQ-051], [01-REQ-054] through [01-REQ-057]), the runtime shall treat the game as **ended** for gameplay purposes: further move-staging and turn-declaration operations shall be rejected, and no further turns shall be resolved.

**04-REQ-061**: After game-end detection, the runtime shall remain available to an **authorised replay-export client** (the Convex orchestration path referred to by [02-REQ-022]) for a bulk read of all data needed to reconstruct a complete replay. "All data needed" comprises the static board layout, the game configuration seeded at initialisation, the full per-turn historical record of snake states (04-REQ-006), the full item-lifetime record (04-REQ-007), the full per-turn time-budget record (04-REQ-009), the full turn-timing record (04-REQ-010), the full turn-event record (04-REQ-011), and the participant attribution record of Section 4.4 in a form that permits `stagedBy` connection identifiers to be resolved to human emails or Centaur Server team references per [03-REQ-045].

**04-REQ-062**: The replay-export client shall be authenticated as the Convex platform runtime. The runtime shall not permit any other caller to retrieve the bulk replay export. The mechanism of this authentication is a matter for [03] / [05] to specify; 04 requires only that the privilege be distinct from ordinary gameplay admission.

**04-REQ-063**: The runtime shall not be torn down until the replay-export client has confirmed successful retrieval of the replay data. Teardown is a Convex-orchestrated operation per [02-REQ-021]; 04's obligation is to remain available until export completes and to not silently discard data that has not yet been read.

**04-REQ-064**: During the post-game-end window in which replay export is in progress, visibility filtering (Section 4.9) shall not be applied to the replay-export client's queries. The replay export is the complete game record, including all previously invisible snakes' states, because downstream replay systems need the full game log regardless of which team's perspective an end viewer later chooses.

**04-REQ-065** *(negative)*: The runtime shall not push or post replay data to any external system on its own initiative. Replay export is pull-based: Convex reads, the runtime serves.

---

### 4.13 Invariants and Cross-Cutting Negative Requirements

**04-REQ-066** *(negative)*: The runtime shall not modify any historical record after the turn-resolution transaction that produced it has committed. In particular, it shall not rewrite prior-turn snake states, event records, or time-budget entries in response to later discoveries or corrections. Historical correctness is the responsibility of the resolving transaction at the time of commit.

**04-REQ-067** *(negative)*: The runtime shall not deliver events, snake states, or any other state referring to a turn `T` to subscribed clients until the atomic turn-resolution transaction for turn `T` has fully committed. Clients shall not observe partial turn-resolution state.

**04-REQ-068** *(negative)*: The runtime shall not consult any external system (Convex, Centaur Server, or other) during gameplay. All data required for gameplay — rules, configuration, admission validation secret, participant attribution record — is seeded at initialisation and never refreshed during the game's life.

**04-REQ-069**: The runtime shall be deterministic with respect to its seeded randomness ([01-REQ-059], [01-REQ-060]): given identical initial seeds, configuration, and sequences of staged-move writes with identical timing, the resulting historical record shall be identical. (This enables test reproducibility and deterministic replay verification.)

**04-REQ-070** *(negative)*: The runtime shall not treat any connection as having elevated privileges beyond those derived from its admission ticket role and team association. Captain status, timekeeper role, and other Convex-side human role distinctions ([03], [08]) shall not be visible to or enforceable by the runtime.

---

## REVIEW Items

### 04-REVIEW-001: Scheduled reducer for clock expiry as an architectural commitment

**Type**: Ambiguity
**Context**: The informal spec (§10, `resolve_turn` bullet) mentions that turn resolution is "also triggered by clock expiry (scheduled reducer at max turn time as a fallback)". This sounds like an implementation detail — a scheduled reducer is a SpacetimeDB-specific mechanism. 04-REQ-032 abstracts this to "the runtime shall autonomously detect when a team's per-turn clock has reached zero... and treat that event as an implicit turn-over declaration". Whether this is correctly abstract-or-binding depends on whether alternative clock-expiry mechanisms (polling, push-from-Convex, wall-clock events on reducer entry) are acceptable substitutes.
**Question**: Is "scheduled reducer" an architectural commitment that requirements should encode, or an implementation choice left to Phase 2 design?
**Options**:
- A: Keep 04-REQ-032 abstract — runtime detects clock expiry by any suitable mechanism; specifics are Design. (Current draft.)
- B: Strengthen to require an internally scheduled mechanism (no external triggering of clock-expiry fallback), so that Convex cannot be in the loop for clock-expiry detection even as a fallback. This would preserve [04-REQ-068]'s "no external systems during gameplay" invariant more crisply.
**Informal spec reference**: §10, `resolve_turn` bullet.

---

### 04-REVIEW-002: `stagedBy` sentinel for fallback-determined moves

**Type**: Gap
**Context**: 04-REQ-040 requires movement events to distinguish fallback-determined moves (where no player or Centaur Server staged a move for a snake, and [01-REQ-042]'s fallback rule applied) from staged moves. The informal spec's turn event schema (§14) defines `snake_moved` with a mandatory `stagedBy: Identity` field, which leaves no room for "no staged move was consumed". Possible resolutions: (a) make `stagedBy` nullable in the event schema and use null for fallback; (b) use a distinguished "runtime fallback" sentinel Identity value; (c) split the event into two distinct event kinds. The current draft punts to design ("the distinction shall be explicit in the event record") but the representation affects the closed event set of 04-REQ-043.
**Question**: Which representation should the closed event set use?
**Options**:
- A: `stagedBy` becomes nullable (null = fallback).
- B: A distinguished sentinel value is reserved and documented.
- C: Split `snake_moved` into `snake_moved_staged` and `snake_moved_fallback` as two event kinds in the closed set.
**Informal spec reference**: §14, `snake_moved` event.

---

### 04-REVIEW-003: Completeness of the closed event set

**Type**: Gap
**Context**: 04-REQ-043 enumerates the closed event set as (a) movement, (b) death, (c) severing, (d) food consumption, (e) potion collection, (f) food spawning, (g) potion spawning, (h) effect application, (i) effect cancellation. This mirrors informal spec §14 closely but differs in one way: §14 does not include an explicit "severing" event kind — it folds severing into `snake_severed` as a combat event — which the current draft also uses, so that matches. However, §14 also lacks an event for **hazard damage applied to a snake that survives the hazard** (i.e., Phase 5b without Phase 5d death). Under the current draft, a snake that enters a hazard cell, loses health, and survives the turn produces no dedicated event — a replay client would have to diff health between turns to detect hazard application. This is acceptable for pure visualisation (hazard cells are visible terrain; the snake's health change is visible in its state snapshot) but blocks downstream analytics that would want an explicit hazard-damage event. Also missing: an event for the `ateLastTurn`-driven growth retention in Phase 2 (the growth bit is folded into the `snake_moved.grew` flag, which is sufficient if the growth/movement timing is well-understood by clients).
**Question**: Is the closed event set complete for the Team Snek ruleset, or should additional event kinds be added (e.g., `hazard_damage`, explicit `starvation_tick`)?
**Options**:
- A: Keep the event set as drafted (matches informal spec §14); rely on state-snapshot diffing for Phase 5 health changes. (Current draft.)
- B: Add `hazard_damage` as a tenth event kind, emitted for each surviving snake that took hazard damage in Phase 5b. Starvation deaths are already covered by the death event (b).
- C: Add both `hazard_damage` and `health_tick` events for completeness, at the cost of event volume.
**Informal spec reference**: §14.

---

### 04-REVIEW-004: Intra-phase event ordering determinism

**Type**: Ambiguity
**Context**: 04-REQ-045 requires events within a turn to be "totally ordered... reflects the phase order and, within a phase, a deterministic intra-phase ordering derivable from the turn seed". The turn seed is well-defined by [01-REQ-060]. But within a phase, multiple snakes may produce events (e.g., three snakes all eat food in Phase 5). The order in which those events are written affects replay bit-exactness for tooling that compares event streams. The informal spec does not specify intra-phase ordering rules. Possibilities include: (a) snake ID order; (b) turn-seed-shuffled order; (c) the order in which the pipeline's internal iteration happens to process snakes (implementation-defined). Committing to a specific rule at the requirements level affects what tests can assert.
**Question**: What intra-phase ordering rule should requirements commit to?
**Options**:
- A: Snake ID ascending — simple, deterministic, debuggable.
- B: Turn-seed-shuffled — avoids a systematic bias where low-ID snakes are always "first" in event streams.
- C: Implementation-defined — only determinism across replays is required, not a specific order. (This is what 04-REQ-045 currently implies.)
**Informal spec reference**: §14, no explicit ordering rule.

---

### 04-REVIEW-005: Replay-export authorisation mechanism

**Type**: Gap
**Context**: 04-REQ-062 says the replay-export client is "authenticated as the Convex platform runtime" and defers the mechanism to [03] / [05]. [03]'s current draft (Sections 3.3 and 3.4) covers Centaur Server credentials and admission tickets for gameplay, but does not specify how Convex authenticates *itself* to the SpacetimeDB instance for privileged operations like initialisation (04-REQ-013) or replay export (04-REQ-061). The informal spec §10 mentions "validates admin token embedded at deploy time" for `initialize_game`. This is a cross-module gap: does the privileged Convex-to-runtime authentication use the admission-ticket HMAC secret with a distinguished role ("platform"), a separate admin token seeded at deploy time, or yet another mechanism?
**Question**: Where should the privileged Convex-to-SpacetimeDB authentication mechanism be specified?
**Options**:
- A: In [03] as a new requirement section — privileged Convex-to-runtime auth is an identity/credential concern.
- B: In [04] as a new requirement section — the runtime's privileged operations are its own concern.
- C: In [05] as part of orchestration — Convex is the initiator and owns the mechanism.
**Informal spec reference**: §10 "validates admin token embedded at deploy time"; §9.4 step 4.

---

### 04-REVIEW-006: Game-end detection granularity (turn commit vs Phase 10 completion)

**Type**: Ambiguity
**Status**: **Narrowed** (2026-04-10) after reading [05] Phase 1 draft. The ownership question ("who detects game-end, STDB or Convex?") is now settled — [05-REQ-038] commits Convex to *observing* the runtime for the terminal state, so detection is a Convex-side read of a runtime-emitted signal. The remaining question is narrower: what shape does that signal take on the runtime side?
**Context**: 04-REQ-060 says game-end treatment applies "after a win condition has been detected in Phase 10". Phase 10 is inside the atomic turn-resolution transaction (04-REQ-037). Game-end detection happens as part of the same transaction that commits the final turn's state. The runtime then needs to transition into "no more turns" mode *after* the commit.
**Remaining question**: Does the runtime emit a distinct terminal event (e.g., `game_ended`) as part of the final turn's commit, or is game-end derived by Convex from a flag on the final turn-resolved record? The former is more explicit and testable; the latter is lighter weight.
**Options**:
- A: Runtime emits a dedicated terminal event within the final turn's commit. Convex observes this event.
- B: Runtime sets a "terminal" flag on the turn record itself. Convex derives game-end from the flag.
- C: Runtime does both: a dedicated terminal event *and* a flag, for redundancy.
**Also open**: whether in-flight staged moves arriving after commit are rejected explicitly (currently implied by the current draft, not stated).
**Informal spec reference**: §5 Phase 10; §9.4 step 7; [05-REQ-038].

---

### 04-REVIEW-007: Historical record size and retention semantics during long games

**Type**: Gap
**Status**: **Resolved** (2026-04-10) after reading [05] Phase 1 draft.
**Context**: 04-REQ-004 requires the historical record to support reconstruction of any past turn in the game. Question was whether in-instance retention is unbounded and what retention bound applies to the runtime itself.
**Decision**: Option A — unbounded retention for the full life of the game instance. Instance lifetime is bounded by [05-REQ-037] (teardown occurs only after [05-REQ-040] has read the complete append-only game record and persisted it to Convex), and replay viewing never consults the runtime after teardown per [05-REQ-044]. Post-teardown retention is Convex's concern, not this module's.
**Rationale**: [05] commits Convex to reading the full record in one pass at game end before instance teardown. A runtime-side retention cap would break that commitment. Performance of holding large histories in a single instance is a Phase 2 concern, not a requirements-level concern.
**Informal spec reference**: §10.

---

### 04-REVIEW-008: Initialisation failure surfacing

**Type**: Ambiguity
**Context**: 04-REQ-017 requires the runtime to fail initialisation if board generation is infeasible per [01-REQ-061], and to surface the cause in a form Convex can relay to the room owner. The concrete form of that surfacing — error code, structured object, exception kind — is a Phase 2 concern. But requirements should at least say whether the surface is a synchronous error on the initialisation call or an asynchronous state that Convex polls for.
**Question**: Should the initialisation operation signal failure synchronously to its caller or leave the instance in an observable failure state that the caller reads back?
**Options**:
- A: Synchronous failure return — the privileged initialisation operation returns a failure outcome to Convex directly.
- B: Asynchronous — Convex writes an initialisation request, the runtime processes it, and a readback endpoint exposes success/failure.
- C: Hybrid — synchronous for quick-to-detect failures (e.g., obviously invalid config), asynchronous for board-generation retries that may take non-trivial time.
**Informal spec reference**: §9.4 step 4; §10 `initialize_game`.

---

### 04-REVIEW-009: Turn event ordering guarantees during subscription delivery

**Type**: Proposed Addition
**Context**: 04-REQ-056 says that all new state produced by a turn commit is delivered as a "single logical update". 04-REQ-045 requires events within a turn to be totally ordered. These together imply clients observe events in the specified total order, but the requirement does not explicitly assert that the *delivery order* to clients matches the *emission order*. Subscription systems sometimes deliver rows in storage order, which may not match emission order. For replay and animation correctness, clients need the guarantee that event order as observed matches event order as emitted.
**Question**: Should the module explicitly require subscription delivery to preserve emission order for turn events within a single turn?
**Proposed requirement**: "Subscribed clients shall receive turn events for a given turn in the order specified by 04-REQ-045. Delivery order shall match emission order."
**Informal spec reference**: §10 client query patterns; §14.

---

### 04-REVIEW-010: Scope of "data layer" visibility filter (RLS vs view)

**Type**: Ambiguity
**Context**: 04-REQ-047 requires visibility filtering "at the data layer" — i.e., not relying on cooperating clients. In SpacetimeDB this maps directly to Row Level Security (RLS) rules. But the requirement is deliberately phrased in abstract terms so it does not name RLS. A concern: if a future deployment uses a different storage substrate that does not support per-row filtering natively, is "data layer" the right abstraction, or should the requirement say "server-side filtering applied before delivery to a client"?
**Question**: Is "data layer" filtering the right abstraction, or should it be restated in terms of "server-side filtering applied to query results before delivery"?
**Options**:
- A: Keep "data layer" — it encompasses RLS and any future equivalent. (Current draft.)
- B: Restate as "server-side, pre-delivery" — decouples from substrate entirely.
**Informal spec reference**: §2 "SpacetimeDB (Game Runtime)"; §10.

---

### 04-REVIEW-011: Interaction between `team_permissions` retention and STDB disconnect semantics

**Type**: Gap
**Context**: 04-REQ-020 and 04-REQ-021 require the participant attribution record to persist for the full game lifetime, including across reconnections. SpacetimeDB connections have their own lifecycle — an Identity may be reused or may be per-connection. The requirement correctly abstracts away from this by saying "each connection identifier that has successfully registered" gets its own attribution entry, and closing a connection does not delete its entry. But this creates a subtle invariant: the runtime must treat connection identifiers as immutable historical facts even after the connection is gone. If SpacetimeDB's connection-identity semantics differ from this assumption (e.g., Identity is global and persistent across reconnections for the same client), the requirement is overspecified. If it's per-connection-ephemeral, the requirement is correct but Phase 2 needs to be careful.
**Question**: Does SpacetimeDB's Identity semantics match the requirement's assumption (per-connection, potentially reused across reconnects for the same client, but immutable once associated with a historical row)? This is a factual question about SpacetimeDB's platform behaviour that needs verification before Phase 2.
**Options**:
- A: Assume per-connection Identity (current draft); verify in Phase 2 and adjust if wrong.
- B: Verify now and restate if SpacetimeDB semantics are different.
**Informal spec reference**: §10 `register`; [03-REQ-044].

---

### 04-REVIEW-012: Visibility of turn-0 initial food placements to opposing teams

**Type**: Gap
**Context**: Initial food items are placed during initialisation per [01-REQ-017] and recorded with spawn turn 0 per 04-REQ-007. Visibility filtering (Section 4.9) filters *snake* state, not item state. But an opponent team observing initial food placements could, in principle, infer the approximate locations of enemy starting positions (since initial food is one-per-snake placed among eligible cells). Whether this is a visibility-filter concern depends on whether starting-position information is considered private.
**Question**: Is there any expectation that initial snake positions are hidden from opponents before turn 0 observations begin? If so, initial food placements may need to be filtered too; if not (i.e., all teams see all starting positions from turn 0 onward as a matter of game design), no additional requirement is needed.
**Options**:
- A: Starting positions and initial food are fully public from turn 0; no additional filtering. (Current draft assumption.)
- B: Starting positions are private until each team's snakes become visible through their own actions — would require additional filtering.
**Informal spec reference**: §4.4, §4.5; no explicit statement.

---

### 04-REVIEW-013: Game-seed accessibility and deterministic-replay testability

**Type**: Ambiguity
**Context**: 04-REQ-069 requires the runtime to be deterministic with respect to seeded randomness. [01-REQ-059] says the per-game seed "shall not be accessible to any game client". The combination creates tension for deterministic-replay testing: if the seed is inaccessible to clients, how can a test harness verify the game log is reproducible from the seed? One answer: determinism is a property of the runtime that is verified via privileged (non-client) channels; clients don't need the seed. This is consistent with [01-REQ-059] but leaves 04-REQ-069 untestable by ordinary integration tests.
**Question**: Should the per-game seed be accessible to the privileged replay-export client (04-REQ-061) so that a replay export can be verified for determinism downstream? This would be a narrow relaxation of [01-REQ-059] for privileged callers only.
**Options**:
- A: Seed remains inaccessible to all callers including replay export. Determinism is a runtime property verified by internal tests only.
- B: Seed is part of the replay export payload. Downstream systems (replay viewer, test harness) can use it to verify reproducibility and to re-derive any per-turn randomness outputs.
- C: Seed is exposed only to the privileged replay-export call, not to any gameplay client.
**Informal spec reference**: §4.4; §10.

---

### 04-REVIEW-014: Final submission pass semantics inside SpacetimeDB

**Type**: Gap
**Context**: Informal spec §6.8 describes a "final submission" by the Centaur Server bot framework "immediately before the turn deadline flushes all dirty automatic-mode snakes." That final submission happens in the Centaur Server, not in SpacetimeDB, and it stages moves via 04-REQ-024. From 04's perspective, the final submission is just a burst of staged moves arriving shortly before `declare_turn_over`. No additional requirement should be needed on the SpacetimeDB side, but I want to flag this to confirm no hidden coordination requirement exists (e.g., a "final submission barrier" reducer) that would need a home in 04.
**Question**: Is the "final submission pass" entirely a Centaur Server concern, with no runtime-side coordination, or does the runtime need an explicit requirement for handling a pre-declaration burst of staged moves?
**Options**:
- A: Entirely a Centaur Server concern; no additional 04 requirement needed. (Current draft assumption.)
- B: Add a requirement that the runtime accepts staged moves up to the instant of `declare_turn_over`, and that turn resolution consumes whatever was staged at that instant (already implied by 04-REQ-038(a)).
**Informal spec reference**: §6.8.

---

### 04-REVIEW-015: Provenance of the per-instance admission-ticket validation secret

**Type**: Gap (raised 2026-04-10 on reading [05] Phase 1 draft)
**Context**: [05-REQ-032] commits Convex to supplying "the instance's unique admission-ticket validation secret" as an explicit parameter to the runtime's privileged initialisation operation. [03-REQ-022] describes the secret as "provisioned to that instance at init time", which is consistent with the [05] commitment but does not nail down the direction (Convex-generates-and-passes vs runtime-generates-and-returns). The current draft of 04 does not have an explicit requirement stating that the secret arrives via the init-time parameter set of Section 4.3. This is a gap on the 04 side, not a conflict — but leaving it implicit means a Phase 2 designer could choose a different direction that would break [05-REQ-032]'s assumption.
**Question**: Should 04 add an explicit requirement discharging [05-REQ-032] — i.e., the runtime shall accept the admission-ticket validation secret as an init-time parameter and shall treat that secret as the sole trust anchor for admission-ticket validation per 4.4?
**Options**:
- A: Add a new 04 requirement stating that the secret is received as an init parameter, is retained for the life of the instance, and is not derived or regenerated inside the runtime. This makes the Convex-supplies direction binding.
- B: Leave it implicit; rely on [03-REQ-022] and [05-REQ-032] to carry the constraint. Weaker but avoids restating dependency requirements.
- C: Add a weaker requirement that the secret is received at init time but leaves its provenance (Convex-supplied vs runtime-generated-and-returned-to-Convex) to Design.
**Informal spec reference**: §3 ("SpacetimeDB Admission Tickets"); §10 `initialize_game`.

---

### 04-REVIEW-016: Admission-ticket validation secret confidentiality on the runtime side

**Type**: Proposed Addition (raised 2026-04-10 on reading [05] Phase 1 draft)
**Context**: [05-REVIEW-001] asks how Convex stores its copy of the per-instance admission-ticket validation secret. Whatever is decided there, the runtime holds the other copy, and 04 currently has no requirement asserting that the secret is not exposed via any read query, subscription, or replay export. Without such a requirement, a Phase 2 designer could inadvertently include the secret in a client-visible table or in the exported historical record. The secret must remain confidential to the runtime's admission path and must not appear in the replay export ([05-REQ-040]), as doing so would leak a game-instance credential into persistent platform storage indefinitely.
**Question**: Should a negative requirement be added stating that the admission-ticket validation secret is not exposed to any subscription, query, or replay-export read?
**Proposed requirement**: "The runtime shall hold the admission-ticket validation secret ([03-REQ-022]) solely for the purpose of admission-ticket validation per Section 4.4. The secret shall not appear in any client-visible query result, subscription update, or replay-export read; in particular, the historical record delivered via replay export per 04-REQ-061 shall not contain the secret."
**Informal spec reference**: §3 ("SpacetimeDB Admission Tickets"); §10.

---

### 04-REVIEW-017: Symmetric cross-runtime isolation invariant

**Type**: Proposed Addition (raised 2026-04-10 on reading [06] Phase 1 draft)
**Context**: [06-REQ-045] and [06-REQ-046] assert, from the Centaur-state side, that SpacetimeDB does not read from or write to Centaur state and that Centaur state does not expose any affordance for writing to STDB-owned state. These negatives are consistent with [02]'s topology but are currently only stated in [06]. 04 has a broader "no external consultation during gameplay" invariant ([04-REQ-068], which I should double-check), but no explicit symmetric negative about not consulting Convex (platform or Centaur) at all. Adding the symmetric negative on the 04 side would make the boundary belt-and-braces and would prevent a Phase 2 designer from, say, reaching into Convex during turn resolution to read a bot parameter.
**Question**: Is [04-REQ-068] (or whichever 04 requirement most closely covers this) sufficient, or should a dedicated negative requirement name Convex explicitly and cite [06-REQ-045/046]?
**Options**:
- A: Rely on [04-REQ-068]'s general "no external systems during gameplay" invariant; no new requirement needed.
- B: Add an explicit 04 requirement mirroring [06-REQ-045/046]: the runtime shall not read from or write to Convex during gameplay; the sole permitted runtime↔Convex interactions are (i) init-time parameter delivery per [05-REQ-032] and (ii) end-of-game replay export per [05-REQ-040] / 04-REQ-061.
- C: Same as B but also explicitly carve out the Convex-driven teardown signal (if any is needed — depends on how game-end detection lands per 04-REVIEW-006).
**Informal spec reference**: §2 (topology); [06-REQ-045], [06-REQ-046].
