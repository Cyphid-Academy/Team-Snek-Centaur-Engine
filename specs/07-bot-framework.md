# Module 07: Bot Framework

## Requirements

### 7.1 Scope and Runtime Placement

**07-REQ-001**: The bot framework shall be a library consumed by the Snek Centaur Server runtime ([02-REQ-004]). It shall execute within the Snek Centaur Server process and share that process's access to its hosted Centaur Teams' Centaur state ([06]) and to each team's game's SpacetimeDB instance ([02-REQ-023]).

**07-REQ-002**: The bot framework shall operate at single-ply (depth-1) lookahead for the MVP: for each candidate self-move, it simulates exactly the next turn's resolution and scores the resulting board. Multi-ply tree search is out of scope for this module.

**07-REQ-003**: The bot framework shall produce, for every snake owned by its team in the current game, a **stateMap** — a function from candidate direction to a worst-case weighted score — updated continuously during the turn in response to changes in its reactive inputs (07-REQ-020).

**07-REQ-004**: The bot framework shall be the sole writer of the per-snake computed display state defined in [06-REQ-026], for the snakes owned by a hosted Centaur Team. This discharges [06-REQ-027] from the bot-framework side.

**07-REQ-005** *(negative)*: The bot framework shall not write authoritative game state to SpacetimeDB. Its only write channel into SpacetimeDB is the staged-move mechanism ([02-REQ-011]), for automatic-mode snakes per 07-REQ-046.

---

### 7.2 Heuristic Type Vocabulary

**07-REQ-006**: The bot framework shall define two heuristic abstractions that Drive/Preference authors program against:
- **Drive\<T\>**: a parameterised, directed motivation toward or away from a future event. The type parameter `T` is constrained to one of two **target types**: a snake (identified per [01-REQ-004]) or a cell (a board position).
- **Preference**: a time-invariant scalar function over a board state.

**07-REQ-007**: A Drive\<T\> shall comprise the following operations, each of which an author must supply:
- A **reward** operation that yields a scalar in [−1, 1] for a given self, target, and board state.
- A **distance** operation that yields a non-negative scalar for a given self, target, and board state.
- A **motivation** operation that combines reward and distance into a scalar in [−1, 1].
- A **satisfaction predicate** that, for a given self, target, and board state, indicates whether the Drive has been achieved in that world.
- A **target-eligibility predicate** that, for a given candidate target, self, and board state, indicates whether the candidate is a valid target.
- A **self-direction nomination** operation that yields the set of self-move directions the Drive considers relevant given its current target and board.
- A **foreign-move nomination** operation that yields, for each foreign snake the Drive cares about, a set of directions that snake might take which the Drive cares about.

**07-REQ-008**: A Preference shall be a function from a self snake and a board state to a scalar in [−1, 1]. Preferences shall have no notion of target and no distance or satisfaction concept.

**07-REQ-009**: All heuristic scalar outputs — Drive reward, Drive motivation, Drive terminal reward on satisfaction, and Preference value — shall lie in [−1, 1]. Calibration of relative importance shall be expressed exclusively through portfolio weights ([06-REQ-013], 07-REQ-014), never by scaling heuristic outputs outside this range.

**07-REQ-010**: When a Drive's satisfaction predicate evaluates to true in a simulated board state, the Drive's contribution to that world's score shall be the Drive's reward operation applied in that world (the **terminal reward**), bypassing distance dampening and the motivation operation. A Drive whose satisfaction predicate evaluated to true in a given turn's observed state shall be removed from the snake's active portfolio at the turn's close.

**07-REQ-011**: The framework shall distinguish **Goal** and **Fear** variants of a Drive only as author-level semantics: a Goal is a Drive whose reward operation returns positive values in typical configurations; a Fear is a Drive whose reward operation returns negative values. The framework shall treat Goals and Fears identically at runtime. (Restates §6.1 for clarity.)

**07-REQ-012** *(negative)*: The framework shall not assume any algebraic property of author-supplied operations (e.g., monotonicity of motivation in distance, symmetry of distance) beyond the range constraints in 07-REQ-009. Authors are responsible for constructing operations that yield useful behaviour under the framework's scoring rules (§7.8).

---

### 7.3 Portfolio Model and Runtime Portfolio Evolution

**07-REQ-013**: Each snake owned by the team shall have, at every moment within a game, a **portfolio** comprising: a set of active Preferences (each with a current portfolio weight), a set of active Drives (each with a specific target, a target type, and a current portfolio weight), and an effective softmax temperature derived per 07-REQ-056.

**07-REQ-014**: At the start of a game, each of the team's snakes' portfolios shall be initialised from the team's heuristic default configuration ([06-REQ-005]) as captured at game start per [06-REQ-014]: every Preference marked active-by-default is present at its default weight; no Drives are active; no per-snake overrides are present. (Discharges 07's share of [06-REQ-014].)

**07-REQ-015**: The framework shall respond to operator-initiated mutations of a snake's portfolio ([06-REQ-015]) — Drive add, Drive remove, Drive retarget, Preference weight change, Drive weight change, Preference activation toggle, temperature override set/clear — by recomputing the affected snake's stateMap in accordance with the reactive input rules in §7.5 and the scoring rules in §7.8. Such mutations shall never require restarting or clearing the game tree cache (07-REQ-022).

**07-REQ-016**: The **effective heuristic configuration** for a given snake at a given moment is the team default ([06-REQ-005]–[06-REQ-007]) overlaid by that snake's portfolio state ([06-REQ-013]). The framework shall read this effective configuration from the Centaur state subsystem per [06-REQ-017] without further negotiation with any other runtime.

**07-REQ-017**: A Drive's **target** shall be a concrete reference — a specific snake identity or a specific cell coordinate — at every moment the Drive is active on a snake. The framework shall not maintain Drives whose target is unresolved.

**07-REQ-018** *(negative)*: The framework shall not modify the team's heuristic default configuration on its own initiative. All writes to [06]'s team-scoped state are operator-initiated via the Snek Centaur Server frontend ([08]).

---

### 7.4 Candidate Direction Enumeration

**07-REQ-019**: For each owned snake the framework shall enumerate **candidate self-directions** as a subset of {Up, Right, Down, Left} ([01-REQ-001]). Directions that are immediately lethal (wall collision per [01-REQ-044a] or self-collision per [01-REQ-044b] on the observed pre-turn board) may be deprioritised, but shall be retained as last-resort candidates such that at least one candidate direction is always produced for an alive snake. (Supports 07-REQ-003's total-function guarantee on the stateMap.)

---

### 7.5 Reactive Inputs

**07-REQ-020**: For each owned snake, the framework shall treat exactly three reactive inputs as determining the active content of that snake's game tree cache and stateMap:
- **Interest map**: the union, over the snake's active Drives, of each Drive's foreign-move nominations (07-REQ-007). For each foreign snake Y this yields the set of Y-directions at least one of the self snake's Drives cares about. If Y has no nominations from any active Drive, Y is absent from the snake's lattice entirely, regardless of Y's commitment state.
- **Commitment state**: for each foreign snake Y, either a specific committed direction or null, determined per 07-REQ-034's snake-category rules. When null, all of Y's nominated directions are in play.
- **Portfolio weights**: the scalar weights applied to normalised cached outputs during scoring (§7.8).

**07-REQ-021**: A cached branch in which foreign snake Y moves direction D shall be **active** if and only if D is in the snake's interest map for Y **and** Y's commitment is either null or equal to D. All other cached branches shall be **dormant**. Changes to the interest map or to a foreign snake's commitment shall toggle branches between active and dormant without re-simulation.

**07-REQ-022**: Portfolio weight changes ([06-REQ-015]) shall affect scoring (§7.8) but shall not change which branches are active or dormant, shall not invalidate any cached simulation, and shall not trigger new simulations. They shall trigger a rescan and possible dirty-marking of the stateMap per 07-REQ-036.

**07-REQ-023**: The game tree cache for an owned snake shall be cleared when the turn number observed in the framework's SpacetimeDB subscription changes, and rebuilt from scratch under the rules of this section. A SpacetimeDB reconnection that resurfaces the current turn number shall not trigger a clear. Within a turn, the cache shall be append-only: simulations once stored are never evicted, only toggled active/dormant.

---

### 7.6 World Simulation and Game Tree Cache

**07-REQ-024**: For each candidate self-direction of each owned snake the framework shall maintain an append-only **game tree cache**: a set of simulated next-turn worlds, each produced by combining the candidate self-move with some assignment of directions to foreign snakes. The framework shall use the shared engine's turn-resolution logic ([01-REQ-041] through [01-REQ-052], as implemented by [02]'s shared engine codebase) to perform the simulation.

**07-REQ-025**: Each cached world shall store, in addition to the simulated board state, **normalised heuristic outputs** for that world: each Drive's reward/motivation/terminal-reward value and each Preference's value, computed against the simulated world and stored independently of portfolio weights.

**07-REQ-026**: Portfolio weights shall not be folded into cached normalised outputs. They shall be applied as a final scalar multiplication during scoring (§7.8). This separation is load-bearing for 07-REQ-022.

**07-REQ-027**: The lattice of foreign-move combinations for an owned snake's candidate self-direction shall be structured as follows:
- Each **dimension** of the lattice corresponds to one foreign snake that is present in the snake's interest map (07-REQ-020) and has at least one active direction.
- Each **rank** along a dimension is a position in that foreign snake's active directions ordered by descending per-(snake, direction) priority weight (07-REQ-028).
- A **point** in the lattice is a tuple that selects one active direction per dimension, and corresponds to exactly one simulated world per candidate self-direction of the owned snake.
- Foreign snakes that drop out of the interest map (because no Drive nominates any of their moves) contribute no dimension; their positions in the simulated world are held at their current cell. (A restatement of 07-REQ-020's exclusion rule for clarity.)

**07-REQ-028**: For each (foreign snake Y, direction D) pair present in the interest map, the framework shall compute a **priority weight** equal to the sum, over Drives that nominate D for Y, of the product of that Drive's portfolio weight and a rank-decay factor applied to the Drive's rank within the configured Drive ordering ([06-REQ-007]). Priority weights shall be reactively recomputed on any change that would affect them — Drive addition, Drive removal, Drive weight change, portfolio reordering. The concrete rank-decay formula is a design-phase decision.

**07-REQ-029**: The framework shall traverse uncomputed but active lattice points in descending combined priority, where a point's combined priority is the product of the per-(foreign snake, direction) priority weights at the point's chosen ranks. Traversal shall be anytime: partial progress is usable immediately and continues until the cache is full for the snake or the compute budget is exhausted ([07]'s compute scheduling in §7.9).

**07-REQ-030**: The traversal shall begin from the lattice point in which every foreign snake is at its highest-priority active direction (rank 0 in every dimension). Each point visited shall make its axis-neighbours (obtained by incrementing a single dimension's rank by 1, provided the new rank remains within that dimension's active-direction count) candidates for subsequent visiting. This produces a Dijkstra-like traversal that visits points in descending combined priority without re-visiting.

**07-REQ-031** *(negative)*: Already-computed cached worlds shall not be re-simulated in response to priority weight changes. A priority weight change only affects the *order* in which still-uncomputed active points are visited next.

**07-REQ-032**: Foreign snake position when a dimension is not present in the lattice: for any alive foreign snake that does not contribute a dimension (because the owned snake has no Drive nominating any of that foreign snake's moves), the simulated world shall place that foreign snake as frozen in place for the turn. Frozen snakes are held at their current position but temporally annotated as stale per 07-REQ-065, enabling downstream analysis algorithms to compensate for the frozen-in-place fiction via the temporal head-start mechanism of 07-REQ-066.

---

### 7.7 Teammate and Opponent Foreign Snakes

**07-REQ-033**: "Foreign snake", as used in §7.5 and §7.6, means any snake other than the owned snake being scored — including alive teammates. The bot framework shall treat teammate snakes as foreign for the purpose of the lattice and commitment state.

**07-REQ-034**: Commitment state semantics vary by snake category:
- **Teammate snake in manual mode**: its staged move (if any) is treated as a committed direction for simulation purposes, but **only when that staged direction intersects with the evaluating snake's interest map** (07-REQ-020). If the staged direction does not intersect the interest map, the manual teammate has no active directions in the lattice and contributes no dimension — it is held in place per 07-REQ-032, consistent with the standard lattice-membership rules of 07-REQ-020 and 07-REQ-021. The framework reads teammate staged moves from its SpacetimeDB subscription ([02-REQ-023]), where operator browsers stage moves directly via their game-participant access token ([03]'s operator identity).
- **Teammate snake in automatic mode**: its staged moves are **ignored entirely** by simulation in the MVP. Its commitment state is null (same as opponents), meaning all its nominated directions are active dimensions in the lattice. The fact that the bot framework may have staged a move for that automatic teammate via the submission pipeline (07-REQ-044) does NOT collapse it to a committed direction for other snakes' simulations.
- **Opponent snake**: commitment state is always null, because no mechanism exists for the framework to observe another team's staging. All nominated directions for the opponent are active dimensions in the lattice.

*Rationale*: Automatic-mode teammates are treated as uncommitted because their staged move is a bot-internal rolling best-guess that changes frequently and should not be used as a constraint by sibling evaluations. Only explicit human staging (manual mode) represents deliberate intent worth treating as committed.

---

### 7.8 Scoring

**07-REQ-035**: For each candidate self-direction of each owned snake, the **stateMap entry** at any moment shall be the **worst-case weighted score** over all cached worlds whose branch is currently active (per 07-REQ-021) for that self-direction. If no active worlds exist for a self-direction, the stateMap entry shall be undefined until at least one active world is cached for it.

**07-REQ-036**: The weighted score of a cached world shall be the sum of each Drive's contribution and each Preference's contribution, where:
- A Drive contributes `portfolioWeight × cachedMotivation` in that world, or, if the Drive's satisfaction predicate was true in that world, `portfolioWeight × cachedTerminalReward`.
- A Preference contributes `portfolioWeight × cachedPreferenceValue` in that world.

The stateMap's worst-case aggregation is the minimum weighted score across active cached worlds. On any rescoring that changes a stateMap entry's value, the snake's stateMap dirty flag shall be set.

**07-REQ-037**: The scoring operation on its own shall not invoke any world simulation. It shall read normalised outputs from the cache, multiply by current portfolio weights, sum, and take a min. This is the cheap-rescan property that makes weight editing live-editable.

**07-REQ-038**: Conservative minimax: the framework shall treat higher stateMap entries as better. At decision time (§7.9), softmax sampling shall favour candidate self-directions whose stateMap entry is higher.

**07-REQ-039**: Per-snake computed display state (as defined in [06-REQ-026]) shall be written by the framework as a **full snapshot** ([06-REQ-028]) whenever the snake's stateMap dirty flag is set. The snapshot shall comprise: the current stateMap, the worst-case simulated world for each candidate direction (the specific cached world selected by the minimum), any annotations the framework computes against those worlds, and the per-heuristic normalised outputs from those worst-case worlds broken out per heuristic for decision-table rendering. The write shall use the Centaur state function contract surface ([06-REQ-030]).

---

### 7.9 Compute Scheduling and Anytime Submission

**07-REQ-040**: Compute shall be distributed across owned snakes in three priority tiers, in descending order:
1. **Automatic-mode snakes** — any owned snake whose operator mode ([06-REQ-018]) is not manual. These receive continuous scheduled compute.
2. **Currently-selected manual-mode snakes** — snakes in manual mode that are currently selected by some user identity ([06-REQ-018]). These receive compute promoted to high priority on selection (§7.10).
3. **Unselected manual-mode snakes** — snakes in manual mode that no user is currently selecting. These receive compute only after tiers 1 and 2 have been served.

Within each tier, compute shall be allocated round-robin across snakes.

**07-REQ-041**: Within each snake, compute shall be allocated round-robin across candidate self-directions — that is, every snake and every candidate direction shall receive its highest-priority foreign world cached before any receives its second. This is the "breadth-first on rank 0" property of the Dijkstra traversal in 07-REQ-029.

**07-REQ-042**: On any change to a reactive input for an owned snake ([07-REQ-020]), the framework shall rescore the affected stateMap entries from the existing game tree cache without simulating new worlds. Any resulting change to a stateMap entry sets the dirty flag (07-REQ-036).

**07-REQ-043**: Any change to a reactive input that causes a previously dormant active-but-uncomputed lattice point to become active shall enqueue that point for simulation in the snake's current compute tier. Reversion to a prior commitment (for which the relevant branches were already computed) shall not enqueue any work; those branches reactivate without simulation.

**07-REQ-044**: The framework shall run a **scheduled submission pass** on a fixed interval during the turn (informal spec §6.8 specifies 100 ms; the concrete interval is a design-phase decision). On each pass, for each automatic-mode snake whose stateMap dirty flag is set, the framework shall:
- Sample a direction from the current stateMap via the softmax decision rule (§7.10).
- Stage that direction in SpacetimeDB via [02-REQ-011]'s staged-move mechanism.
- Clear the snake's dirty flag.

**07-REQ-045**: The framework shall execute a **final submission** pass when the dynamically computed turn deadline is imminent, flushing all automatic-mode snakes whose dirty flag is still set. The turn deadline shall be calculated dynamically each turn as: `min(automaticTimeAllocationMs, remainingTimeBudget)` where `automaticTimeAllocationMs` is the game-scoped centaur parameter from [06-REQ-040a] (always shorter than the max turn duration from the engine), and `remainingTimeBudget` is the team's current chess clock budget observable from SpacetimeDB. The smaller of the two takes precedence. On turn 0, `turn0AutomaticTimeAllocationMs` (also from [06-REQ-040a]) replaces `automaticTimeAllocationMs`. The threshold at which the deadline is considered "imminent" is a design-phase decision. The scheduled submission pipeline (07-REQ-044) continues to operate normally right up until the turn is declared over.

**07-REQ-045a**: When an operator (timekeeper) manually triggers immediate turn submission (`declareTurnOver`), the framework shall **not** execute a final flush of dirty automatic-mode snake states. The manual submission action reflects human discretion that the current total set of staged moves is acceptable for immediate submission. Flushing dirty states would cause new softmax rolls after the human decision with no opportunity for humans to respond, which contradicts the purpose of manual override. Only automatic deadline expiry triggers the final flush described in 07-REQ-045.

**07-REQ-046**: Manual-mode snakes — whether currently selected or not — shall never be staged by the scheduled or final submission passes. Their staged moves shall originate exclusively from operator action routed through [08]'s live operator interface. This discharges 07's share of the manual/auto staging split in [06-REQ-018].

**07-REQ-047**: Each staged move produced by the framework shall be attributable to the bot participant identity (via the per-Centaur-Team game credential issued by the game invitation flow of [05-REQ-032b]), not to any individual human operator, so that turn-event emission ([01-REQ-052]) can distinguish bot-originated moves from operator-originated moves in the `stagedBy` field.

---

### 7.10 Softmax Decision and Temperature

**07-REQ-048**: At decision time the framework shall sample a direction for an automatic-mode snake by applying the softmax distribution to that snake's current stateMap entries. Specifically, each candidate direction's sampling probability shall be proportional to `exp(stateMap[direction] / T)` where `T` is the snake's effective temperature per 07-REQ-056. Sampling shall use a source of randomness scoped to the Snek Centaur Server process; no requirement is placed on which source.

**07-REQ-049**: The softmax distribution shall be evaluated over the current set of candidate directions for the snake (07-REQ-019). Directions for which the stateMap entry is undefined at decision time shall be excluded from the distribution. If no candidate directions have a defined stateMap entry at decision time, the framework shall fall back to staging the snake's `lastDirection` (per [01-REQ-042(b)]) or, on turn 0 with no lastDirection, shall stage nothing — letting [01-REQ-042(c)]'s random-choice fallback handle the move in turn resolution.

**07-REQ-050**: A lower softmax temperature shall bias the decision toward the highest-scoring direction (more deterministic); a higher temperature shall bias toward more uniform sampling (more exploratory). The direction of this effect is part of the contract with operators calibrating temperature in [08].

---

### 7.11 Human-Selection Promotion

**07-REQ-051**: When a user identity transitions into selecting an owned snake ([06-REQ-018]) that is in manual mode, the framework shall promote that snake to the "currently-selected manual-mode" compute tier (tier 2 per 07-REQ-040) effective immediately. Any subsequent deselection of that snake shall demote it back to tier 3.

**07-REQ-052**: On selection promotion, the framework shall:
- Re-evaluate active/dormant status of the snake's cached branches against the current reactive inputs (07-REQ-020). Any commitment or interest-map changes that occurred during the snake's time in tier 3 shall cause branches to toggle and uncomputed-but-now-active branches to be enqueued for high-priority simulation.
- Rescore the stateMap from active cached branches (07-REQ-042). If the stateMap changes, the dirty flag is set and the computed display state snapshot is written per 07-REQ-039.

**07-REQ-053** *(negative)*: Selection promotion of a manual-mode snake shall not cause the framework to stage a move for that snake. Even after a full high-priority recompute, the stateMap is displayed but not acted upon. Staging remains the operator's responsibility (07-REQ-046).

**07-REQ-054**: If a manual-mode snake already has an operator-staged move at the moment of selection promotion, the staged move shall remain staged. Promotion affects display and compute scheduling only, not the staged move.

---

### 7.12 Temperature Sources

**07-REQ-055**: The framework shall read softmax temperature from two sources:
- **Team-wide default**: the softmax global temperature in the team's bot parameter record ([06-REQ-011]).
- **Per-snake override**: the optional per-snake temperature override in that snake's portfolio state ([06-REQ-013]).

**07-REQ-056**: A snake's **effective temperature** at a given moment shall be its per-snake temperature override if one is set, otherwise the team-wide default. Effective temperature shall be read reactively: changes to either source shall take effect on the next softmax decision without requiring cache invalidation or restart.

---

### 7.13 Boundary with Centaur State and SpacetimeDB

**07-REQ-057**: All persistent state the framework reads or writes — heuristic defaults, bot parameters, per-snake portfolio state, selection state, computed display state, and the action log — shall live in the Centaur state subsystem ([06]). The framework shall hold no persistent state of its own across game lifetimes. (Its game tree cache, stateMaps, and dirty flags are in-memory per-game scratch state.)

**07-REQ-058**: The framework shall subscribe to its team's game-scoped Centaur state for real-time change notifications per [06-REQ-043], so that operator edits to any snake's portfolio, selection, or temperature override propagate into the framework's reactive inputs without polling.

**07-REQ-059** *(negative)*: The framework shall not call Centaur state mutations on behalf of operators. Operator-initiated mutations ([06-REQ-015], [06-REQ-018]) are routed directly from [08] to [06]'s function contract surface per [06-REQ-044]; the framework observes their effects through its subscription and reacts accordingly.

**07-REQ-060**: The framework shall read board state, staged-move state, turn number, and chess timer state from its subscription to the game's SpacetimeDB instance per [02-REQ-023]. It shall not cache SpacetimeDB state in Convex.

**07-REQ-061** *(negative)*: The framework shall not attempt to read, subscribe to, or otherwise access the SpacetimeDB state of games belonging to other teams, nor any portion of the current game's SpacetimeDB state masked by the RLS rules in [04] for its own team's view.

---

### 7.14 Temporal Annotation of Simulated Board State

**07-REQ-065**: Each simulated partial board state produced by the framework shall track a **per-snake turn timestamp**. Snakes whose explicit moves are simulated (present in the lattice as active dimensions) shall be annotated with the current turn number. Frozen snakes (absent from the lattice, held in place per 07-REQ-032) shall be annotated as **one turn behind** the simulated snakes.

**07-REQ-066**: Board analysis algorithms operating on simulated partial board states — including but not limited to multi-headed BFS for Voronoi territory maps — shall use the per-snake turn timestamps (07-REQ-065) to give frozen snakes a temporal head start proportional to their staleness. This enables meaningful positional inference from simulated worlds despite the frozen-in-place fiction for non-lattice snakes.

---

### 7.15 Action Log Obligations

**07-REQ-062**: Every move the framework stages per 07-REQ-044 and 07-REQ-045 is recorded in the SpacetimeDB append-only staged-moves log ([04-REQ-025], [04-REQ-027]) as a side effect of the `stage_move` reducer call. The framework shall not write move-staging entries to the Centaur action log in Convex; move staging events are excluded from the Centaur action log per [06-REQ-036] and resolved 06-REVIEW-004. The staged-move log entry in SpacetimeDB inherently records the actor identity (the bot participant identity via the per-Centaur-Team game credential per [05-REQ-032b]) and is attributable as bot-originated per 07-REQ-047.

**07-REQ-063**: Every computed display state snapshot the framework writes per 07-REQ-039 shall correspond to an action log entry of category "computed display state snapshot" per [06-REQ-036] and [06-REQ-037].

**07-REQ-064** *(negative)*: The framework shall not write action log entries for operator-originated events (selection, manual-mode toggles, operator-initiated Drive edits, etc.). Those entries are written by the originating operator per [06-REQ-037]'s non-reserved categories (see resolved 06-REVIEW-003).

---

## REVIEW Items

### 07-REVIEW-001: Depth-1 scope as requirement vs design note

**Status**: ✅ Resolved — Option A (binding requirement)
**Type**: Ambiguity
**Phase**: Requirements
**Context**: The informal spec (§6 preamble) states "The MVP bot framework operates at depth-1 (single-ply lookahead). Multi-ply tree search is a future enhancement." 07-REQ-002 promotes this to a requirement, on the grounds that multi-ply would pervasively change the cache structure, reactive-input model, and compute scheduling, and a spec reader should be able to rely on "depth-1" as a binding contract. The alternative framing is that depth-1 is a current *design choice* that satisfies a more abstract requirement like "the framework shall produce per-direction worst-case scores that update continuously during the turn", and the depth statement belongs in Phase 2 Design.
**Question**: Should "depth-1" be a binding requirement that a future multi-ply implementation would have to supersede via an explicit spec revision, or is it a design-phase choice recorded only in Module 07's eventual Design section?
**Options**:
- A: Binding requirement (current draft, 07-REQ-002). Forces any multi-ply change to be a spec revision and documents the MVP scope clearly.
- B: Move to Design phase as a rationale note attached to the cache/traversal design. Requirements stay silent on depth.
**Resolution**: Option A. 07-REQ-002 stays as-is. Depth-1 is a binding requirement. Any future multi-ply extension would require an explicit spec revision. The "Flagged" tag has been removed from 07-REQ-002.
**Informal spec reference**: §6 preamble.

---

### 07-REVIEW-002: Teammates as foreign snakes

**Status**: ✅ Resolved — allied snakes are foreign, with commitment nuance
**Type**: Gap
**Phase**: Requirements
**Context**: The informal spec's §6.6 talks about "foreign snakes" without specifying whether teammates are included. Physically, teammates are part of the world and affect turn resolution (body collisions, severings, food competition); excluding them from the lattice would make simulations systematically wrong whenever a Drive's outcome depends on teammate behaviour. 07-REQ-033 includes teammates, and 07-REQ-034 distinguishes observable teammate commitments (staged moves within the team) from unobservable opponent commitments (null). This is a plausible reading but is not explicitly stated in the informal spec.

An alternative reading is that "foreign" means "opposing team" exclusively, and teammate interactions are handled by some other mechanism (e.g., cooperative scheduling so each team-snake simulates with teammates held at already-committed moves). The current draft does not adopt this reading because no such mechanism is described anywhere in the informal spec.

A subtle consequence of the current draft: a teammate snake that has been staged via the scheduled submission pipeline (07-REQ-044) will appear "committed" to that direction from the perspective of other owned snakes simulating against it. Changes to that teammate's own portfolio that later re-stage it would be observed as a commitment change in the other snakes' reactive inputs, and would toggle branches accordingly. This is internally consistent but worth confirming.
**Question**: Is "foreign" snake the set of all-other-snakes-including-teammates, or only opposing-team snakes?
**Options**:
- A: All non-self snakes, teammates included. Teammate commitments are observable as their staged moves. (Current draft.)
- B: Only opposing-team snakes. Teammates are handled by a separate (to-be-specified) mechanism.
- C: All non-self snakes, but teammates are always treated as committed to their currently-staged move if any, and never contribute interest-map dimensions beyond that committed direction. (A restricted variant of A.)
**Resolution**: Allied (teammate) snakes are indeed foreign snakes. 07-REQ-033 confirmed as-is. 07-REQ-034 has been amended to clarify the commitment semantics precisely by snake category: (1) manual-mode teammates have their staged move treated as committed only when the staged direction intersects the evaluating snake's interest map; (2) automatic-mode teammates have their staged moves ignored entirely — commitment state is null, same as opponents; (3) opponents are always null. A rationale note has been added to 07-REQ-034 explaining why automatic-mode teammates are treated as uncommitted: their staged move is a bot-internal rolling best-guess that changes frequently and should not constrain sibling evaluations. The "Flagged" tag has been removed from 07-REQ-033.
**Informal spec reference**: §6.6 (uses "foreign" without defining membership).

---

### 07-REVIEW-003: Foreign snakes absent from the interest map — hold in place

**Status**: ✅ Resolved — frozen in place with temporal annotation
**Type**: Ambiguity
**Phase**: Requirements
**Context**: 07-REQ-020 and 07-REQ-032 together specify that a foreign snake with no interest-map entry contributes no dimension to the lattice and is "held at its current position" in simulation. This is what the informal spec §6.6 implies ("Y drops out of the lattice — it contributes no dimension and is held at its current position"), but "held at its current position" is only physically plausible on turn 0 or for a dying/stuck snake. On any later turn, a live foreign snake will certainly move somewhere; simulating it as stationary is a deliberate fiction. The informal spec accepts this because a Drive that doesn't care about Y's moves by definition doesn't care where Y ends up; scoring of those heuristics that *don't* mention Y is unaffected by Y's fictitious stasis. But heuristics that *do* care about Y and don't nominate any of Y's moves (plausible if a Drive only nominates the specific moves it considers interesting and treats others as "don't care") will implicitly score Y's stationary ghost.
**Question**: Is "hold Y stationary" the right fill-in for dimensions absent from the interest map, or should there be a convention that a heuristic which cares about Y at all must nominate all of Y's plausible moves, even ones it treats as don't-care, so that Y is never absent from the lattice when the self snake scores anything that could depend on Y?
**Options**:
- A: Hold Y stationary (current draft). Simpler; places the "don't care" contract on heuristic authors implicitly.
- B: Add a requirement that a Drive nominating *any* move for Y must nominate all of Y's non-trivially-lethal moves. Shifts the contract to be explicit.
- C: When Y is absent from the interest map, simulate Y as taking a "typical" move (e.g., Y's last direction, or a staged move if observable per 07-REVIEW-002). Most realistic but most complex and introduces a new notion of "typical".
**Resolution**: The resolution is not any of the three listed options in isolation. The correct reading from the general centaur engine spec v6 (World Simulation section) specifies a temporal annotation mechanism that compensates for the frozen-in-place fiction:
- Foreign snakes absent from the interest map are held at their current position (as 07-REQ-032 already said) — this part is correct.
- **07-REQ-065** (new) specifies that simulated partial board states must track a per-snake turn timestamp. Snakes in the lattice are annotated with the current turn; frozen snakes are annotated as one turn behind.
- **07-REQ-066** (new) specifies that board analysis algorithms (e.g., multi-headed BFS for Voronoi territory maps) must use these timestamps to give frozen snakes a temporal head start proportional to their staleness.
- 07-REQ-032 has been updated to reference the temporal annotation mechanism, replacing the "deliberately diverges from physically realistic play" apology with the correct framing: "frozen in place but temporally annotated as stale, enabling downstream analysis algorithms to compensate."

*Post-mortem*: The formal spec extracted the "held at current position" rule from the team-snek spec v2.2 §6.6 but missed the temporal annotation mechanism documented in the general centaur engine spec v6 (World Simulation section, lines 309–311): "The partial board state tracks per-object turn timestamps. This allows graph algorithms such as multi-headed BFS for Voronoi territory to give objects that have moved an appropriate temporal head start." The team-snek v2.2 doesn't repeat this because it inherits it from v6 — the gap occurred because formal extraction focused on v2.2 without cross-referencing v6's simulation semantics.
**Informal spec reference**: §6.6 ("held at its current position"); general centaur engine spec v6 §World Simulation (lines 309–311).

---

### 07-REVIEW-004: Concrete numeric constants (RANK_DECAY, submission interval)

**Status**: ✅ Resolved — Option A (leave flexible)
**Type**: Proposed Addition
**Phase**: Requirements
**Context**: The informal spec's §6.6 specifies `RANK_DECAY = 0.9` and §6.8 specifies a 100 ms scheduled submission interval. Both look like design choices rather than user-facing contracts: a different decay constant or interval would not invalidate the framework's contract to operators or downstream modules. The current draft leaves these concrete values to Phase 2 Design (07-REQ-028, 07-REQ-044) and treats the requirement as "there exists a rank-decay mechanism" and "there exists a scheduled submission interval", respectively.
**Question**: Should these concrete numbers be pinned in Phase 1 Requirements (in case operators or testers need to assume specific values) or left flexible as Phase 2 design choices (the current draft's position)?
**Options**:
- A: Leave flexible in Phase 1; pin in Phase 2 Design. (Current draft.)
- B: Pin 0.9 and 100 ms as requirements on the grounds that the informal spec treats them as concrete.
- C: Expose both as bot parameters in [06-REQ-011], making them operator-tunable rather than hardcoded.
**Resolution**: Option A. Current draft position stands. Concrete numeric values are left to Phase 2 Design. No requirement text changes needed.
**Informal spec reference**: §6.6 (`RANK_DECAY = 0.9`); §6.8 ("100ms interval").

---

### 07-REVIEW-005: Final submission deadline awareness

**Status**: ✅ Resolved — dynamic deadline with chess clock semantics
**Type**: Gap
**Phase**: Requirements
**Context**: 07-REQ-045 requires the framework to execute a final submission pass immediately before the turn deadline, so that all dirty automatic-mode snakes are staged before the turn resolves. The chess timer ([01-REQ-034] through [01-REQ-040]) lives in SpacetimeDB, and the turn is declared over by explicit team declaration or per-turn clock expiry — neither of which is a clean "imminent deadline" signal the framework can precisely predict. Two complications:
1. If the team's own declaration of turn over is what ends the turn, the framework needs to cooperate with whatever component issues that declaration (operator UI in [08]? a bot-framework component itself?) so that the final submission runs before declaration, not after.
2. If the turn ends by clock expiry, the framework needs a near-zero-latency read on the per-turn clock to fire the final pass at the right moment.

The informal spec §6.8 just says "immediately before the turn deadline" without specifying how the framework obtains that signal.
**Question**: How does the framework learn that the turn is about to end, with enough lead time to execute a final submission pass?
**Options**:
- A: The team's turn-over declaration is issued by a component that first notifies the framework, waits for the framework's final pass to complete, then declares turn-over to SpacetimeDB. Requires a framework-side "flush" hook invoked from whatever triggers declaration.
- B: The framework polls the per-turn clock in SpacetimeDB at high frequency and fires the final pass when remaining time crosses a configurable threshold. Requires picking a threshold and accepting that either clock-expiry or explicit declaration can pre-empt the final pass.
- C: There is no distinct "final pass" — the framework's submission-pipeline cadence is fast enough that the scheduled pass immediately prior to any declaration is "good enough". Weakens 07-REQ-045 to a best-effort guarantee.
**Resolution**: 07-REQ-045 has been substantially amended:
- The deadline is not a single fixed signal — it is calculated dynamically each turn as `min(automaticTimeAllocationMs, remainingTimeBudget)` where `automaticTimeAllocationMs` is the game-scoped centaur parameter from [06-REQ-040a] and `remainingTimeBudget` is the team's chess clock budget from SpacetimeDB. On turn 0, `turn0AutomaticTimeAllocationMs` replaces `automaticTimeAllocationMs`.
- The final submission pass fires when the dynamically computed deadline is imminent (threshold is a design-phase decision).
- **07-REQ-045a** (new) specifies that manual operator turn submission (`declareTurnOver`) shall NOT trigger a final flush of dirty automatic-mode snake states. The manual submission reflects human discretion that the current staged moves are acceptable. Flushing dirty states would cause new softmax rolls after the human decision with no opportunity for humans to respond, contradicting the purpose of manual override.
- The scheduled submission pipeline (07-REQ-044) continues to operate normally until the turn is declared over — only the final flush differs between automatic deadline expiry (flush happens) and manual submission (flush suppressed).
- The "Flagged" tag has been removed from 07-REQ-045.
**Informal spec reference**: §6.8 ("final submission"); §5.3 (operator mode / time allocation).

---

### 07-REVIEW-006: Undefined stateMap entries at decision time

**Status**: ✅ Resolved — Option A (sample only from defined entries)
**Type**: Gap
**Phase**: Requirements
**Context**: 07-REQ-049 covers the edge case where no candidate direction has a defined stateMap entry at decision time (no cached world has yet been computed for the snake). It falls back to SpacetimeDB's own turn-0 random choice ([01-REQ-042(c)]) or continuation per `lastDirection`. A subtler case: some candidate directions have defined stateMap entries and others don't. The current draft excludes undefined directions from the softmax distribution, implicitly biasing decision toward directions the framework has had time to evaluate. This is reasonable in the general case but could under-explore: a direction that *would* have scored highest but got no compute time because priority pushed it to the back of the queue would be silently skipped.
**Question**: When some candidate directions have defined stateMap entries and others don't, should the framework (a) sample only from defined ones (current draft), (b) treat undefined entries as neutral (score 0) and include them in the softmax, or (c) block decision until all candidates have at least one cached world?
**Options**:
- A: Sample only from defined entries. (Current draft.) Simplest; matches "anytime" principle.
- B: Treat undefined as score 0 and include in softmax. Gives unevaluated directions a shot at selection proportional to temperature.
- C: Block the scheduled submission pass for a snake until all its candidate directions have ≥ 1 cached world. Slower but fairest.
**Resolution**: Option A. 07-REQ-049 stays as-is. The round-robin processing rule (07-REQ-041) guarantees that the highest-priority world simulation for each snake populates every not-certain-death direction's stateMap entry before any second-priority worlds are simulated, and those first simulations occur in priority order of cheap heuristics about worthwhile moves. Centaur Server authors are responsible for writing performant Drive/Preference code that fits many world simulations within the available time. If a team's heuristic code is too slow and some directions remain unevaluated at decision time, that is the CentaurTeam's failure to write performant code and it is appropriate that they suffer a less intelligent decision policy as a consequence.
**Informal spec reference**: §6.8, §6.9 (neither explicit on this case).

---

### 07-REVIEW-007: Retirement of a satisfied Drive — timing

**Status**: ✅ Resolved — Option A (retire on fresh post-resolution board)
**Type**: Ambiguity
**Phase**: Requirements
**Context**: 07-REQ-010 says a Drive whose satisfaction predicate evaluated to true "in a given turn's observed state shall be removed from the snake's active portfolio at the turn's close." The informal spec §6.1 says "In the bot's live portfolio, a satisfied Drive is removed after the turn in which satisfaction is detected." The current draft treats "observed state" as meaning the authoritative post-turn-resolution board published by SpacetimeDB, not merely any simulated world where the predicate happened to fire. Removing on simulated satisfaction would be wrong, because a simulated world is a hypothesis, not reality — and multiple simulated worlds could disagree on whether satisfaction holds for the same Drive.

Consequence of the draft: a Drive whose terminal reward contributes to scoring in a simulated world (via 07-REQ-010) still remains on the portfolio through that turn and is only retired once the next fresh board state arrives and the satisfaction predicate evaluates to true against it.
**Question**: Is "observed state" the correct anchor, and does retirement happen at the moment the fresh post-resolution board arrives from SpacetimeDB, or at some other moment?
**Options**:
- A: Retire on fresh post-resolution board when satisfaction predicate is true against it. (Current draft.)
- B: Retire on simulated satisfaction in the direction that ends up being selected. More optimistic (acts before confirmation).
- C: Retire on fresh post-resolution board, but only if satisfaction predicate is still true there — otherwise leave the Drive active even if a simulated world predicted satisfaction. (This is the contrapositive of A and is probably what A already says; listed for completeness.)
**Resolution**: Option A. 07-REQ-010 stays as-is. *Forward-looking note*: the planned extension to multi-ply (multi-turn-ahead) simulation will need to "shadow satisfy" Drives as part of simulating the Centaur's psychological state through multi-turn imagining of possible futures. A Drive satisfied in a hypothetical future turn would need to be removed from the simulated portfolio for deeper plies while remaining active in the authoritative portfolio that tracks real-world outcomes revealed by SpacetimeDB. This is beyond MVP scope and moot at single-ply depth, where satisfaction in a simulated world only affects the terminal reward contribution to that world's score and does not remove the Drive from the active portfolio.
**Informal spec reference**: §6.1 ("satisfied Drive is removed after the turn in which satisfaction is detected").

---

### 07-REVIEW-008: Game-tree-cache clearing and mid-turn fresh boards

**Status**: ✅ Resolved — Option A (clear on turn number change)
**Type**: Gap
**Phase**: Requirements
**Context**: 07-REQ-023 clears the game tree cache at the start of each fresh turn. "Start of turn" here is interpreted as the moment a new authoritative pre-turn board is published to SpacetimeDB subscribers. But between turns the cache is cleared and rebuilt from scratch, which is expensive relative to incremental update. The informal spec §6.6 acknowledges this is a deliberate simplification for the single-ply MVP and notes that multi-ply would retain deeper valid speculation. The question is whether there's a scenario in which the framework receives what it interprets as a "new turn" spuriously — e.g., because of a SpacetimeDB reconnection producing a state snapshot that looks like a new turn but is actually the current turn — and would unnecessarily clear the cache.
**Question**: What is the exact trigger for clearing the cache, framed in terms of observable SpacetimeDB state?
**Options**:
- A: Clear when the turn number observed in SpacetimeDB changes. Robust to reconnects that resurface the current turn, as long as turn number is stable.
- B: Clear when any pre-turn state field changes (board, items, snake lengths). More aggressive; may clear on spurious updates.
- C: Clear on the SpacetimeDB `resolve_turn` reducer emitting its "new turn ready" event ([04]'s exported interfaces). Tightly coupled to [04]'s emission contract but most precise.
**Resolution**: Option A. 07-REQ-023 has been amended to explicitly pin the cache clear trigger to a turn-number transition observed in the framework's SpacetimeDB subscription, with explicit reconnect-safety wording ("A SpacetimeDB reconnection that resurfaces the current turn number shall not trigger a clear."). *Rationale*: at 1-ply depth, at most one of the many simulated worlds remains consistent with the actual turn outcome received from SpacetimeDB. The compute investment lost by clearing the cache each turn is therefore negligible — nearly all cached worlds are invalidated by the real outcome regardless. A future multi-ply extension would retain deeper speculation consistent with the observed outcome, but for single-ply the full reset is the right tradeoff of simplicity over marginal compute savings.
**Informal spec reference**: §6.6 (does not specify trigger).

---

### 07-REVIEW-009: Operator-staged moves for manual snakes and the framework's view of them

**Status**: ✅ Resolved — Option A (direct-to-SpacetimeDB via access token)
**Type**: Gap
**Phase**: Requirements
**Context**: 07-REQ-046 says manual-mode snakes are never staged by the framework. But for simulating teammates (07-REVIEW-002 Option A), the framework may need to read teammate staged moves from Convex/Centaur state or from SpacetimeDB. It's unclear in the informal spec where operator-staged moves for manual snakes physically live before SpacetimeDB receives them — is the operator's browser writing to SpacetimeDB directly via its access token (per [03]'s operator game-participant identity) or is the staging brokered through the Snek Centaur Server?

If it's direct-to-SpacetimeDB, the framework reads it from its SpacetimeDB subscription like any other staged move. If it's brokered through the Snek Centaur Server, the framework might have earlier visibility but there's a new API surface to specify. The current draft (07-REQ-034) assumes the framework can observe staged moves for its own team's snakes via some means, without pinning the mechanism.
**Question**: Where are manual-mode operator-staged moves written, and how does the framework observe them?
**Options**:
- A: Operator browsers stage directly to SpacetimeDB via their game-participant access token. The framework observes via SpacetimeDB subscription.
- B: Operator browsers stage via the Snek Centaur Server runtime, which re-stages to SpacetimeDB. The framework observes via its own runtime state and action log.
- C: Dual writes: operator browsers stage directly to SpacetimeDB and also record the action in the Centaur action log ([06-REQ-036]); the framework observes via either path.
**Resolution**: Option A. Staged moves are always mediated exclusively by SpacetimeDB — there is no other state storage mechanism for staged moves besides SpacetimeDB. Convex never learns of move staging events until it receives the full download of game replay logs from SpacetimeDB for long-term persistence ([02-REQ-022]). Operator browsers stage moves directly to SpacetimeDB via their game-participant access token ([03]'s operator identity); the bot framework observes these staged moves via its SpacetimeDB subscription ([02-REQ-023]). No new API surface needed. 07-REQ-034 has been updated to make explicit that the framework reads teammate staged moves from its SpacetimeDB subscription. This is consistent with the staged-move data flow established by [04-REQ-025]/[04-REQ-027] and the exclusion of `move_staged` from the Centaur action log per resolved 06-REVIEW-004.
**Informal spec reference**: §7.5, §10 ("stage_move" reducer).

---

### 07-REVIEW-010: Informal spec filename drift

**Status**: ✅ Resolved — v2.2 is canonical
**Type**: Ambiguity
**Phase**: Requirements
**Context**: Consistent with 02-REVIEW-001 and 06-REVIEW-007. Requirements in this module were extracted from `team-snek-centaur-platform-spec-v2.2.md` on the assumption it supersedes any v2.1 reference in SPEC-INSTRUCTIONS.md. Resolution is shared with the prior reviews.
**Question**: Confirm v2.2 is canonical. See 02-REVIEW-001.
**Resolution**: Confirmed. v2.2 is canonical, consistent with 02-REVIEW-001 and 06-REVIEW-007.
**Informal spec reference**: N/A (meta).
