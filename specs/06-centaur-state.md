# Module 06: Centaur State

## Requirements

### 6.1 Scope and Ownership

**06-REQ-001**: The Centaur state subsystem shall be the persistent store of all per-team and per-game state that the bot framework ([07]) and the Centaur Server web application ([08]) require, other than authoritative game state (which lives in SpacetimeDB per [02-REQ-007]) and platform-wide records (which are owned by [05]).

**06-REQ-002**: All Centaur state shall reside in the single Convex deployment mandated by [02-REQ-002]. No Centaur state shall be stored in any SpacetimeDB instance.

**06-REQ-003** *(negative)*: The Centaur state subsystem shall not hold any state that is authoritative for game outcome. Game-authoritative state (board, snake bodies, items, chess timer, turn history) is owned by SpacetimeDB per [02-REQ-013].

**06-REQ-004**: Centaur state shall be partitioned into two lifetime classes:
- **Team-scoped persistent state**: survives across games and is edited between games. Bound to a Centaur Team identity ([02-REQ-005], [03]).
- **Game-scoped state**: bound to a single game's lifetime, initialised at game start and retained thereafter for replay ([06-REQ-040]).

---

### 6.2 Team-Scoped Heuristic Defaults

**06-REQ-005**: The subsystem shall persist, per Centaur Team, a **heuristic default configuration** describing the team's defaults for every Drive type and every Preference registered with that team's Centaur Server ([07]).

**06-REQ-006**: For each registered Preference, the heuristic default configuration shall store: (a) whether the Preference is active on new snakes by default, and (b) its default portfolio weight.

**06-REQ-007**: For each registered Drive type, the heuristic default configuration shall store: (a) its default portfolio weight when added to a snake, and (b) its ordinal position in the Drive dropdown presented to operators ([08]).

**06-REQ-008**: The subsystem shall accept authorised mutations that create, update, or delete entries in the heuristic default configuration. Writes shall be permitted only to members of the owning Centaur Team ([03]).

**06-REQ-009**: Edits to the heuristic default configuration shall not retroactively affect any game already in progress. Game-scoped per-snake portfolio state ([06-REQ-013]) is independent of the team's current defaults once the game has begun.

**06-REQ-010** *(negative)*: The Game Platform shall not write to the heuristic default configuration. This is a restatement of [02-REQ-046] at the data layer and is enforced by function-contract checks in the subsystem, not by trust in the Game Platform.

---

### 6.3 Team-Scoped Bot Parameters

**06-REQ-011**: The subsystem shall persist, per Centaur Team, a **bot parameter record** containing at minimum:
- The softmax global temperature used for bot decisioning ([07]).
- The default operator mode (Centaur or Automatic) that the live operator interface ([08]) starts a game in.
- The automatic-mode time allocation applied to turns other than turn 0.
- The automatic-mode time allocation applied to turn 0.

**06-REQ-012** *(negative)*: The Game Platform shall not write to the bot parameter record. This is a restatement of [02-REQ-045] at the data layer and is enforced by function-contract checks in the subsystem.

---

### 6.4 Game-Scoped Per-Snake Portfolio State

**06-REQ-013**: For each snake in each active game the subsystem shall persist a **per-snake portfolio state** containing, at minimum:
- The set of currently active Drives on the snake, each with its target, the target's type (Snake or Cell per [01]), and its current portfolio weight.
- Per-snake heuristic weight overrides for any Preference or Drive whose weight deviates from the team default.
- Per-snake activation overrides for Preferences whose active/inactive status deviates from the team default.
- A nullable per-snake temperature override.

**06-REQ-014**: At game start, the per-snake portfolio state for every snake belonging to the team shall be initialised such that:
- Every Preference in the team's heuristic default configuration that is marked active-by-default is present at its default weight.
- No Drives are active.
- No per-snake weight, activation, or temperature overrides are present.

Initialisation shall use the team's heuristic default configuration as captured at the moment of game start ([06-REQ-009]).

**06-REQ-015**: The subsystem shall accept authorised mutations that add a Drive to a snake, remove a Drive from a snake, change the weight of a Drive or Preference on a snake, change the active/inactive state of a Preference on a snake, and set or clear a snake's temperature override.

**06-REQ-016**: Per-snake portfolio state shall persist across turns. Deselecting a snake shall not reset any of its Drives, weight overrides, activation overrides, or temperature override.

**06-REQ-017**: The effective heuristic configuration for a snake at any moment is the team default configuration overlaid by that snake's portfolio state. A downstream reader of the subsystem shall be able to compute this effective configuration from the persisted data without additional negotiation with any other runtime.

---

### 6.5 Game-Scoped Selection State

**06-REQ-018**: For each snake in each active game the subsystem shall persist a **selection record** comprising:
- The user identity currently selecting the snake, or null if the snake is unselected.
- A manual-mode flag indicating whether the snake is in manual mode ([08]).

**06-REQ-019**: At most one user identity may be recorded as the selector of any given snake. (Discharges [02-REQ-018] for the snake side.)

**06-REQ-020**: At most one snake may be recorded as selected by any given user identity within the scope of a single game. (Discharges [02-REQ-018] for the operator side.)

**06-REQ-021**: The subsystem shall reject any mutation that would cause either [06-REQ-019] or [06-REQ-020] to be violated. Enforcement shall be by the subsystem's own function contracts; downstream runtimes shall not be required to check these invariants before calling.

**06-REQ-022**: A selection mutation that names a snake currently selected by another user identity shall be permitted only if the caller's mutation explicitly requests displacement of the prior selector. Absent such a request, the mutation shall be rejected. (Supports the displacement confirmation affordance in [08], informal spec §7.5.)

**06-REQ-023**: When a selection displacement occurs, the displaced user identity's selection record for that game shall be updated atomically with the new selector's record such that at no intermediate point can a reader observe both identities as selectors of the same snake or either identity as selector of more than one snake.

**06-REQ-024**: Selection mutations shall be permitted only to members of the Centaur Team that owns the snake being selected ([03]). A user identity that is not a member of the owning team shall not be able to appear as selector in any selection record for that team's snakes.

**06-REQ-025**: Manual-mode toggling shall be permitted only to the user identity currently holding the selection on the snake, or — per [08], informal spec §7.5 — shall be auto-set to true as a side effect of that identity staging a direction for the snake.

---

### 6.6 Game-Scoped Per-Snake Computed State

**06-REQ-026**: For each snake in each active game the subsystem shall persist a **computed display state** comprising, at minimum:
- A per-direction map of worst-case weighted scores (the "stateMap" in [07] terminology).
- A per-direction representation of the worst-case simulated world used to produce each score, sufficient for the operator interface ([08]) to render the worst-case world preview.
- A per-direction representation of any annotations computed against those worst-case worlds (e.g., territory overlays) that the operator interface renders.
- A per-direction representation of the normalised per-heuristic outputs that produced each score, sufficient to drive the decision breakdown table in [08].

**06-REQ-027**: The Centaur Server for the owning team shall be the sole writer of a snake's computed display state. No other runtime or identity shall write to it. (Paired with the action log writer rules in [06-REQ-037].)

**06-REQ-028**: Updates to computed display state shall be full snapshots rather than deltas, so that any recorded snapshot is independently interpretable without reference to prior snapshots. (Supports sub-turn replay reconstruction per [06-REQ-035].)

**06-REQ-029**: The subsystem shall not impose any per-turn or per-second rate limit on computed display state updates beyond what is required by Convex operational constraints. The bot framework ([07]) is the authority on update cadence.

---

### 6.7 Convex Function Contract Surface

**06-REQ-030**: All mutations to Centaur state shall pass through a defined function contract surface. The subsystem shall not permit direct row-level writes that bypass this surface. (This is a restatement of standard Convex practice and is made explicit here because the invariants in [06-REQ-019] through [06-REQ-024] depend on it.)

**06-REQ-031**: Every function in the contract surface that mutates Centaur state shall authenticate the caller and shall reject the mutation if the caller's identity does not have a right to perform it under the rules stated in [06-REQ-008], [06-REQ-010], [06-REQ-012], [06-REQ-024], and [06-REQ-025].

**06-REQ-032**: The function contract surface shall expose read queries sufficient for:
- The Centaur Server web application to render the live operator interface and the team-perspective replay viewer ([08]).
- The bot framework on the Centaur Server to read the effective heuristic configuration for each of its team's snakes ([07]).

Read access shall be scoped such that a member of one team cannot read another team's heuristic default configuration, bot parameters, per-snake portfolio state, selection state, computed display state, or action log, except where an explicit cross-team read affordance is defined (none are defined by this module).

---

### 6.8 Centaur Action Log

**06-REQ-033**: The subsystem shall persist a **Centaur action log** recording state-changing events in the Centaur subsystem during each game, at clock-time resolution finer than turn granularity.

**06-REQ-034**: Each action log entry shall record at minimum: the game it belongs to, the turn in which it occurred, the identity of the actor (user identity or Centaur Server identity per [03]), the actor's identity type (human or Centaur Server), and a wall-clock timestamp.

**06-REQ-035**: The action log shall be sufficient, in combination with the SpacetimeDB game log imported at game end ([02-REQ-022], [05]), to reconstruct the team's experience at any timestamp within any turn of the game, including:
- Which snake each operator had selected at that moment.
- Each snake's manual-mode flag at that moment.
- Each snake's active Drives, their targets, and their weights at that moment.
- Each snake's per-direction stateMap, worst-case worlds, annotations, and heuristic outputs at that moment, as last written prior to that moment.
- The current operator mode (Centaur or Automatic) at that moment.
- Staged moves for each snake and the identity that staged them, at that moment.
- Temperature overrides in effect at that moment.

**06-REQ-036**: At minimum the following event categories shall be recorded in the action log:
- Move staging (snake, direction, staging identity).
- Snake selection and deselection (snake, user identity).
- Manual-mode toggling (snake, new value).
- Drive addition and removal (snake, Drive type, target type, target, weight).
- Heuristic weight changes (snake, heuristic, old weight, new weight).
- Operator-mode changes (new mode).
- Team-side turn submission events.
- Computed display state snapshots (snake, stateMap, worst-case worlds, annotations, heuristic outputs), written as full snapshots per [06-REQ-028].
- Temperature override changes (snake, new value).

**06-REQ-037**: The following action log event categories shall be written exclusively by the owning team's Centaur Server runtime, since no other runtime has the information needed to produce them:
- Computed display state snapshots.
- Bot-originated move staging events.

All other event categories may be written by either the Centaur Server or a human operator on the team, as appropriate to the origin of the action.

**06-REQ-038** *(negative)*: The action log shall not be used to reconstruct authoritative game state (board contents, snake bodies, collisions, item spawns). Authoritative game state is reconstructed from the SpacetimeDB log per [02-REQ-013].

**06-REQ-039**: Action log entries, once written, shall be immutable. Corrections to mistaken entries are not supported; downstream readers of the log (e.g., the team replay viewer in [08]) shall treat the log as append-only.

---

### 6.9 Lifetime and Retention

**06-REQ-040**: Game-scoped Centaur state (per-snake portfolio state, selection state, computed display state, action log) shall be retained after the game ends for the lifetime of the game record in Convex ([05]). It shall not be deleted at the time SpacetimeDB teardown occurs per [02-REQ-021].

**06-REQ-041**: Team-scoped Centaur state (heuristic default configuration, bot parameters) shall persist for the lifetime of the Centaur Team. Deletion of a Centaur Team shall cascade to its team-scoped Centaur state; the cascade mechanics are owned by [05].

**06-REQ-042**: The subsystem shall not reuse game-scoped state across distinct games. A freshly provisioned game ([02-REQ-020]) shall have no pre-existing per-snake portfolio state, selection state, computed display state, or action log entries.

---

### 6.10 Interaction Boundaries

**06-REQ-043**: A Centaur Server shall be able to subscribe to its team's team-scoped state and to its active games' game-scoped state such that changes are observed in real time by the bot framework and the served operator interface. (Discharges [02-REQ-024] at the data-contract level.)

**06-REQ-044**: Human operators shall be able to read and mutate Centaur state directly through the function contract surface without routing through their team's Centaur Server runtime, subject to the authorisation rules in [06-REQ-031]. (Discharges [02-REQ-039] at the data-contract level.)

**06-REQ-045** *(negative)*: The SpacetimeDB game runtime shall not read from or write to Centaur state. All communication between a Centaur Server's bot framework and the game runtime flows through the staged-moves mechanism ([02-REQ-011]) and the real-time subscription ([02-REQ-023]), never through Convex.

**06-REQ-046** *(negative)*: The Centaur state subsystem shall not expose any mutation that lets a Centaur Server or human operator write directly to SpacetimeDB-owned state. Cross-runtime state flows only in the direction defined by [02]'s topology.

---

## REVIEW Items

### 06-REVIEW-001: Heuristic defaults scoped to team vs Centaur Server

**Type**: Ambiguity
**Context**: Informal spec §6.4 says "Each Centaur Server maintains a global heuristic configuration". §7.1 and §7.2 say these tables are "stored in Convex per team". The current draft treats the scoping as per-team on the basis that [02-REQ-005] mandates a 1:1 relationship between Centaur Teams and Centaur Servers, so the two framings are extensionally equivalent.
**Question**: Is the extensional equivalence sufficient, or is there a case (e.g., server re-registration, server replacement, server rename) where "per server" and "per team" would produce different outcomes that should be resolved explicitly?
**Options**:
- A: Per-team is authoritative; if a team replaces its Centaur Server, the new server inherits the existing heuristic defaults. (Assumed by current draft.)
- B: Per-server is authoritative; replacing a team's Centaur Server starts its heuristic defaults from scratch. Requires additional lifecycle requirements around server replacement.
**Informal spec reference**: §6.4, §7.1, §7.2, §11 ("bot_params", "heuristic_config").

---

### 06-REVIEW-002: Cross-team read visibility of heuristic defaults and bot parameters

**Type**: Gap
**Context**: The informal spec does not explicitly state whether one team's heuristic defaults or bot parameters are visible to members of other teams. [06-REQ-032] defaults to strict team-scoping (no cross-team reads) on the basis that these values are competitive information and that no use case motivating cross-team visibility is identified in the informal spec.
**Question**: Confirm strict team-scoping, or identify cross-team read affordances (e.g., for a platform administrator, for post-game analysis by opponents, for leaderboard purposes) that should be added.
**Options**:
- A: Strict team-scoping, no cross-team reads. (Current draft.)
- B: Allow cross-team reads in specific roles or lifecycle phases — specify which.
**Informal spec reference**: N/A (gap).

---

### 06-REVIEW-003: Who writes non-compute action log entries

**Type**: Ambiguity
**Context**: The informal spec lists action log entries including `move_staged`, `snake_selected`, `manual_toggled`, `drive_added`, etc., but does not explicitly distinguish which events are written by the Centaur Server runtime and which are written by the human operator client that originates them. [06-REQ-037] reserves the two event categories whose payloads cannot plausibly be produced by a human client (computed display state snapshots and bot-originated move staging) to the Centaur Server, and leaves the rest open. In practice this likely means the client that initiated the action is the writer, but this is not the only plausible design — an alternative is that all action log writes are brokered through the Centaur Server so that the bot framework and UI share a single write path.
**Question**: Which entity writes user-originated action log entries (selection changes, Drive edits, manual-mode toggles, temperature changes, operator-mode changes)? The human operator's browser against Convex directly, or the Centaur Server on behalf of the operator?
**Options**:
- A: Human browsers write their own action log entries directly to Convex. (Permitted by the current draft.)
- B: All action log writes are brokered through the Centaur Server, regardless of originator. Requires changes to [06-REQ-037] and possibly to [06-REQ-044] as well as additional trust assumptions about the Centaur Server.
- C: Each event category is explicitly assigned to one writer.
**Informal spec reference**: §11 ("centaur_action_log"), §13.3.

---

### 06-REVIEW-004: Action log delivery guarantees for sub-turn replay fidelity

**Type**: Gap
**Context**: [06-REQ-035] promises that the action log is sufficient to reconstruct the team's experience at any timestamp. Sub-turn replay fidelity depends on the log being a faithful record of what actually happened — missing entries would produce ghosting in the replay where a snake's state jumps without explanation. The informal spec does not specify delivery guarantees for action log writes, nor what should happen if a write fails (e.g., network partition between an operator's browser and Convex during a turn).
**Question**: What delivery guarantees does the subsystem promise for action log writes, and what is the observable behaviour when a write fails?
**Options**:
- A: Best-effort. Dropped entries produce gaps in the replay; this is accepted. No requirements added.
- B: At-least-once with client-side retry and idempotency keys. Requires adding an idempotency key to action log entries and a requirement for the writers to retry.
- C: Convex transactional writes for authoritative mutations (selection, drive add/remove, etc.) that pair the state change with the log entry atomically, so a dropped log entry implies the state change also did not occur. Most of the listed event categories already correspond to a state mutation; only `statemap_updated` is a log-only event.
**Informal spec reference**: §11 ("centaur_action_log"), §13.3.

---

### 06-REVIEW-005: Temperature override persistence across turns and deselection

**Type**: Gap
**Context**: Informal spec §6.4 explicitly states "Drive assignments and weight overrides persist across turns (they are not reset when the operator deselects the snake)", and the draft's [06-REQ-016] preserves this. The informal spec is silent on whether the per-snake temperature override has the same persistence semantics. The draft treats it as symmetric with weight overrides (persistent).
**Question**: Is per-snake temperature override intended to persist across turns and across deselection, matching Drive/weight override semantics?
**Options**:
- A: Temperature override persists across turns and across deselection, symmetric with Drives and weight overrides. (Current draft.)
- B: Temperature override resets on deselection or at some other event.
**Informal spec reference**: §6.4, §11 ("snake_config.temperatureOverride").

---

### 06-REVIEW-006: Selection-state lifetime at game end

**Type**: Gap
**Context**: [06-REQ-040] retains all game-scoped state, including selection state, for the lifetime of the game record. This means a finished game's last selection state is visible forever. The team replay viewer ([08]) almost certainly wants this to render historical selection shadows. But it is worth confirming that permanently retaining "which operator had which snake selected at game end" is intended, as opposed to clearing selection state on game finalisation while retaining the action log.
**Question**: Is retaining the terminal selection record intentional, or should selection state be cleared at game end with historical selection visible only through the action log?
**Options**:
- A: Retain terminal selection record. (Current draft.) Simpler; makes the action log strictly supplementary for this particular piece of state.
- B: Clear selection record at game end; the replay viewer reconstructs selection history from the action log only.
**Informal spec reference**: §11 ("snake_config"), §13.3.

---

### 06-REVIEW-007: Informal spec v2.1/v2.2 filename drift

**Type**: Ambiguity
**Context**: `SPEC-INSTRUCTIONS.md` references `team-snek-centaur-platform-spec-v2_1.md` as the informal source of truth, but the file in the project root is `team-snek-centaur-platform-spec-v2.2.md`. This is the same issue flagged in 02-REVIEW-001. Requirements in this module were extracted from v2.2 on the same assumption (v2.2 supersedes v2.1). Flagging here for consistency; resolution should be shared with 02-REVIEW-001.
**Question**: Confirm v2.2 is canonical. See 02-REVIEW-001.
**Informal spec reference**: N/A (meta).
