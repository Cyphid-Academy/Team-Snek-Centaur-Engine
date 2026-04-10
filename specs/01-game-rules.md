# Module 01: Game Rules

## Requirements

### 1.1 Domain Type Vocabulary

**01-REQ-001**: The system shall define a `Direction` type with exactly four values: `Up`, `Right`, `Down`, `Left`.

**01-REQ-002**: The system shall define a `CellType` with values: `Normal`, `Wall`, `Hazard`, `Fertile`.

**01-REQ-003**: The system shall define four named board sizes with the following properties:

| Label  | Total Grid | Playable Area |
|--------|-----------|---------------|
| Small  | 11×11     | 9×9 (81 cells)  |
| Medium | 13×13     | 11×11 (121 cells) |
| Large  | 17×17     | 15×15 (225 cells) |
| Giant  | 21×21     | 19×19 (361 cells) |

**01-REQ-004**: The system shall define a `SnakeState` type with the following fields:
- `snakeId`: unique identifier
- `letter`: single alphabetic character assigned at game start
- `teamId`: owning team
- `body`: ordered list of cell positions, head first, tail last; length = number of segments
- `health`: integer
- `invulnerabilityLevel`: signed integer
- `activeEffects`: list of `{ effectType, expiryTurn }`
- `pendingEffects`: list of `{ effectType, expiryTurn }` — scheduled to become active next turn
- `lastDirection`: nullable Direction
- `alive`: boolean
- `visible`: boolean
- `ateLastTurn`: boolean

**01-REQ-005**: The system shall define an `ItemType` with values: `Food`, `InvulnPotion`, `InvisPotion`.

**01-REQ-006**: The system shall define an `EffectType` with values: `invuln_buff`, `invuln_debuff`, `invis_buff`, `invis_collector`.

**01-REQ-007**: The system shall define an `ItemState` tracking each item's type, cell position, and whether it has been consumed.

---

### 1.2 Board Construction

**01-REQ-008**: The board shall be a rectangular grid of the configured size. All cells on the outermost 1-cell-thick border shall be `Wall` type. All remaining cells are inner cells.

**01-REQ-009**: The playable area for each board size is the inner cells as defined in 01-REQ-003 (total grid minus the 1-cell wall border on each side).

**01-REQ-010**: If the configured hazard percentage H > 0, `floor(inner_cell_count × H / 100)` inner cells shall be designated `Hazard`, chosen using randomness seeded from the game seed. Hazard placement shall guarantee that all non-Hazard, non-Wall inner cells form a single connected region.

**01-REQ-011**: Hazard cells are permanent terrain for the duration of the game. Items may occupy a Hazard cell simultaneously with hazard terrain.

**01-REQ-012**: If fertile ground is enabled, a subset of inner non-Wall non-Hazard cells shall be designated `Fertile` at game start. Fertile designations shall not change during the game.

**01-REQ-013**: Fertile tile selection shall use 4-octave fractal Perlin noise seeded from the game seed. Each successive octave doubles the base frequency of the previous and halves its amplitude. The clustering parameter C (integer 1–20) controls the base frequency of the first octave: low C → high base frequency → small scattered patches; high C → low base frequency → large contiguous blobs. The density parameter D (integer percent 1–90) controls coverage: the top D% of candidate inner non-Wall non-Hazard cells ranked by their noise score are designated Fertile.

**01-REQ-014**: For an N-team game, the board shall be divided into N starting territories by overlaying a circular pie centred on the board with N equal angular sectors. The angular offset of the pie shall be chosen randomly using the game seed. Each inner cell shall be assigned to the sector it overlaps most with; ties broken randomly using the game seed.

**01-REQ-015**: Each snake's starting head position shall be placed on a randomly chosen non-Wall, non-Hazard inner cell within its team's starting territory, using randomness seeded from the game seed.

**01-REQ-016**: All snake head starting positions across all teams shall be placed on cells of the same parity, where parity is `(x + y) mod 2`. The parity value (0 or 1) shall be chosen randomly using the game seed.

**01-REQ-017**: After all snake starting positions are assigned, one food item per snake shall be spawned on an eligible cell chosen randomly using the game seed. An eligible cell is inner, non-Wall, non-Hazard, and not occupied by a snake body. If fertile ground is enabled, eligible cells are additionally restricted to Fertile cells.

**01-REQ-061 (Board generation feasibility and bounded retry)**: Board generation (the full sequence of hazard placement, fertile tile selection, territory assignment, parity choice, starting-position assignment, and initial food placement, per 01-REQ-010 through 01-REQ-017) shall be treated as a single attempt that either succeeds or fails. An attempt **fails** if any of the following conditions holds:
- Hazard placement cannot satisfy the single-connected-region constraint of 01-REQ-010.
- For the chosen parity (01-REQ-016), at least one team's territory does not contain `snakesPerTeam` distinct non-Wall, non-Hazard inner cells of that parity for starting-head placement per 01-REQ-015.
- After starting-position assignment, the set of cells eligible for initial food placement under 01-REQ-017 (inner, non-Wall, non-Hazard, not occupied by a snake body; additionally Fertile if fertile ground is enabled) contains fewer than `totalSnakeCount` distinct cells, so that 01-REQ-017's one-food-per-snake mandate cannot be satisfied.

If an attempt fails, the setup process shall retry using a deterministic sub-seed derived from the game seed and an attempt counter, re-running the full generation sequence. Up to **three retries** shall be performed (four attempts total). If all four attempts fail, board generation shall be reported as **infeasible** for the current game configuration: the game shall be left in an unplayable state accompanied by a machine-readable error identifying which constraint failed on the final attempt, and the room owner shall be able to modify the game configuration and re-attempt provisioning.

The mechanism for deriving per-attempt sub-seeds from the game seed is a design-phase concern; the requirement here is only that each attempt uses a distinct deterministic seed derivable from the game seed plus the attempt index, so that the sequence of attempts (and the ultimate success or failure) is reproducible from the game seed alone.

---

### 1.3 Snake Initialization

**01-REQ-018**: Each snake shall be assigned a unique letter designation within its team, assigned consecutively starting from `A`. A snake's display name is `{teamName}.{letter}` (e.g., `Red.A`).

**01-REQ-019**: The number of snakes each team fields per game shall be equal across all teams and is determined by the configured `snakesPerTeam` parameter (1–10).

**01-REQ-020**: At game start, every snake shall have length 3 with all three body segments positioned on the snake's starting cell.

**01-REQ-021**: At game start, every snake shall have `health = MaxHealth`, `invulnerabilityLevel = 0`, `activeEffects = []`, `pendingEffects = []`, `ateLastTurn = false`, `lastDirection = null`, `visible = true`, `alive = true`.

---

### 1.4 Items and Derived Effect Fields

**01-REQ-022**: A snake's `invulnerabilityLevel` shall equal the count of its active `invuln_buff` effects minus the count of its active `invuln_debuff` effects.

**01-REQ-023**: A snake's `visible` field shall be `false` if and only if it has at least one active `invis_buff` or `invis_collector` effect.

**01-REQ-024**: Invisible snakes (visible = false) shall not be observable by connections belonging to opponent teams. All game mechanics (collision, severing, health, scoring) apply to invisible snakes identically to visible snakes. Invisibility is an information asymmetry only.

**01-REQ-025**: When a surviving snake's head occupies a food cell during turn resolution, the food item is consumed: `ateLastTurn` is set to `true` and `health` is restored to `MaxHealth`. Item collection (food or potions) is *not* a disruption — see 01-REQ-030.

**01-REQ-026**: When a surviving snake's head occupies an `InvulnPotion` cell during turn resolution, the potion is consumed and the following effects are added to the collector's and teammates' `pendingEffects` (to become active next turn): the collector receives one `invuln_debuff` with a 3-turn duration; each alive teammate receives one `invuln_buff` with a 3-turn duration. Multiple InvulnPotions collected by the same snake stack: each collection adds an independent pair of pending effects, with no cap.

**01-REQ-027**: When a surviving snake's head occupies an `InvisPotion` cell during turn resolution, the potion is consumed and the following effects are added to `pendingEffects` (to become active next turn): the collector receives one `invis_collector` with a 3-turn duration; each alive teammate receives one `invis_buff` with a 3-turn duration. Multiple InvisPotions collected by the same snake stack: each collection adds an independent pair of pending effects.

---

### 1.5 Disruptions and Potion Effect Cancellation

**01-REQ-028**: A snake is an **active potion collector** if it currently holds one or more active `invuln_debuff` or `invis_collector` effects originating from collecting potions. A snake may simultaneously hold any number of stacks of either type, acquired through successive collections; stacking is unbounded by the rules and bounded only by the finite supply of potions on the board.

**01-REQ-029**: *(Retired — folded into 01-REQ-028. Originally stated that a snake may simultaneously be a collector for both potion types. Under 01-REVIEW-005's resolution, this is subsumed by the more general stacking rule in 028. ID not reused.)*

**01-REQ-030**: A **disruption** is any of the following events experienced by a snake during turn resolution. This set is closed:
- (a) Death from any cause
- (b) Severing another snake's body
- (c) Being severed by another snake
- (d) Receiving a body collision — a foreign snake's head enters a cell occupied by this snake's body
- (e) Entering a hazard cell

Item collection (food, InvulnPotion, InvisPotion) is explicitly *not* a disruption. This enables multi-potion stacking (01-REQ-028) and decouples food consumption from the potion-cancellation mechanism.

**01-REQ-031**: If an active potion collector suffers any disruption during turn resolution, the following cancellation shall be scheduled for Phase 9: *all* of the collector's own `invuln_debuff` and `invis_collector` effects shall be removed (every stack of every type), and *all* of its alive teammates' corresponding `invuln_buff` and `invis_buff` effects originating from those potions shall be removed. A single disruption burns every potion-collector stack the snake holds, regardless of type. See resolved 01-REVIEW-004.

**01-REQ-032**: *(Retired — under 01-REVIEW-005's resolution, re-collecting a potion of the same type no longer cancels the earlier stack; it adds an independent stack per 01-REQ-026/027 and the unbounded stacking rule in 01-REQ-028. ID not reused.)*

---

### 1.6 Effect Immutability

**01-REQ-033**: All effect states — `invulnerabilityLevel`, `visible`, and the full `activeEffects` list — shall be frozen at the start of each turn's resolution. These frozen states shall be the authoritative values used for all collision detection and disruption evaluation during that turn. Effects gained, cancelled, or expired during the current turn's resolution shall not alter the frozen states and shall not take effect until Phase 9.

---

### 1.7 Chess Timer

**01-REQ-034**: Each team shall have a **time budget** (non-negative integer, milliseconds) that persists across turns within a game.

**01-REQ-035**: The time budget for each team at game start shall be the configured `initialBudget`.

**01-REQ-036**: At the start of each turn, each team's budget shall be incremented by the configured `budgetIncrement` (default 500ms).

**01-REQ-037**: At the start of each turn, each team's **per-turn clock** shall be set to `min(effectiveCap, currentBudget)`. The effective cap is `firstTurnTime` (default 60s) on turn 0 and `maxTurnTime` (default 10s) on all subsequent turns.

**01-REQ-038**: A team may **declare turn over** at any time during the current turn. Upon declaration, the team's remaining per-turn clock time is added back to its budget. The team's per-turn clock stops.

**01-REQ-039**: A team's turn shall be automatically declared over when its per-turn clock reaches zero.

**01-REQ-040**: Turn resolution shall commence when all teams have declared turn over (whether explicitly or by clock expiry).

---

### 1.8 Turn Resolution Pipeline

**01-REQ-041**: Turn resolution shall execute the following eleven phases in strict order once per turn:

1. Move Collection
2. Snake Movement
3. Collision Detection
4. Pending Effect Recording
5. Health, Hazards, and Food
6. Potion Collection
7. Food Spawning
8. Potion Spawning
9. Effect Application and Expiry
10. Win Condition Check
11. Event Emission

**01-REQ-042 (Phase 1 — Move Collection)**: For each alive snake, its direction for this turn shall be determined as follows: (a) if a move is staged, use that direction; (b) else if `lastDirection` is non-null, use `lastDirection` unconditionally (even if that cell is lethal); (c) else (no prior direction, only possible on turn 0 with no move staged) choose a direction uniformly at random from {Up, Right, Down, Left} using the turn seed (01-REQ-060). The random choice is not constrained to non-lethal cells — if the chosen direction would cause wall or self-collision, the snake dies in Phase 3 as it would from any other fatal move. See resolved 01-REVIEW-006.

**01-REQ-043 (Phase 2 — Snake Movement)**: All alive snakes shall move simultaneously. Each snake's head advances one cell in its chosen direction. If `ateLastTurn` is `true`, the tail segment is retained and `ateLastTurn` is reset to `false`; otherwise the tail segment is removed. `lastDirection` is updated to the direction moved.

**01-REQ-044 (Phase 3 — Collision Detection)**: After all snakes have moved in Phase 2, the following collision types shall be evaluated simultaneously using the frozen effect states from 01-REQ-033. "Simultaneously" means no sub-ordering within Phase 3: the post-Phase-2 board configuration (all moved heads and all body segments of all snakes, including snakes that are themselves dying from wall or self-collision within this same Phase 3) is the single reference state against which every collision rule is evaluated. A snake dying from wall or self-collision in Phase 3 does not have its body removed from Phase 3's evaluation; its segments remain valid body-collision targets for other snakes in the same pass. See resolved 01-REVIEW-002 for a worked example.

**01-REQ-044a (Wall collision)**: A snake whose head occupies a Wall cell after Phase 2 dies.

**01-REQ-044b (Self-collision)**: A snake whose head occupies a cell containing any other segment of its own body after Phase 2 dies. (The just-vacated tail cell is not included, as the tail is removed in Phase 2 before this check.)

**01-REQ-044c (Body collision)**: A snake (attacker) whose head occupies a cell containing a non-head body segment of another snake (victim) after Phase 2 shall be resolved using frozen invulnerabilityLevels: if attacker's frozen level > victim's frozen level, the victim is **severed** — all body segments from the contact segment through the tail are removed from the victim, and the attacker survives; otherwise the attacker dies.

**01-REQ-044d (Head-to-head collision)**: When two or more snake heads occupy the same cell after Phase 2: snakes with a frozen invulnerabilityLevel below the maximum frozen level among all involved snakes die; among surviving snakes (those at the maximum level), shorter snakes (fewer body segments after Phase 2) die; if two or more snakes at the maximum level have equal length, all of them die.

**01-REQ-045 (Phase 4 — Pending Effect Recording)**: For each snake that suffers any disruption in Phase 3 (death, severing, being severed, receiving a body collision) and is an active potion collector, the cancellations specified in 01-REQ-031 shall be scheduled for application in Phase 9, based on Phase 3 outcomes using frozen effect states. (Rationale: a snake can only carry an `invuln_debuff` by having collected an InvulnPotion, so "vulnerable snake dies" is a strict subset of "active collector suffers a disruption" — a separate buff-cancellation rule would be fully subsumed by this one. See resolved 01-REVIEW-001.)

**01-REQ-046 (Phase 5 — Health, Hazards, and Food)**: The following are applied to each surviving snake in order. All health modifications shall be calculated before any starvation deaths are evaluated.

**01-REQ-046a (Health tick)**: 1 health point is subtracted from every surviving snake unconditionally.

**01-REQ-046b (Hazard damage)**: If a surviving snake's head occupies a Hazard cell, the configured `hazardDamage` (default 15) is subtracted from its health. Entering a hazard cell is a disruption; if the snake is an active potion collector, schedule cancellation per 01-REQ-031.

**01-REQ-046c (Food consumption)**: If a surviving snake's head occupies a food cell, the food is consumed: `ateLastTurn` is set to `true` and `health` is restored to `MaxHealth`. If the cell is simultaneously a Hazard cell, hazard damage from 01-REQ-046b is applied first (a disruption in its own right), then food healing (net health after tick, hazard, and food: `MaxHealth`). Eating food is *not* a disruption; the hazard entry on the same cell still is.

**01-REQ-046d (Starvation death)**: After all health modifications in Phase 5 are applied, any snake with health ≤ 0 dies of starvation. Starvation death is a disruption (subcase of "death from any cause" in 01-REQ-030). If the dead snake is an active potion collector, schedule cancellation per 01-REQ-031.

**01-REQ-047 (Phase 6 — Potion Collection)**: For each surviving snake whose head occupies a potion cell after Phase 2 movement: the potion is consumed and new potion effects are added to `pendingEffects` per 01-REQ-026 or 01-REQ-027. Potion collection is not a disruption (01-REQ-030); re-collecting a potion type the snake already holds does not cancel the earlier stack — it adds an independent stack per 01-REQ-028.

**01-REQ-048 (Phase 7 — Food Spawning)**: Food shall spawn each turn. The expected count is the configured `foodSpawnRate` (a non-negative decimal). The guaranteed count is `floor(foodSpawnRate)` items, with probability `foodSpawnRate mod 1` of one additional item. Spawn locations are chosen randomly using the turn seed from eligible cells: inner, non-Wall, non-Hazard, and not currently occupied by a snake, food, or potion. If fertile ground is enabled, eligible cells are further restricted to Fertile cells.

**01-REQ-049 (Phase 8 — Potion Spawning)**: If InvulnPotions are enabled, they spawn independently using `invulnPotionSpawnRate` by the same probabilistic mechanism and eligible-cell criteria as food. If InvisPotions are enabled, they spawn independently using `invisPotionSpawnRate` by the same mechanism.

**01-REQ-050 (Phase 9 — Effect Application and Expiry)**: All pending effect cancellations and new effect additions scheduled during Phases 4–6 shall be applied. All active effects whose expiry condition has been reached shall be removed. Each snake's `invulnerabilityLevel` and `visible` field shall be recomputed from remaining active effects per 01-REQ-022 and 01-REQ-023.

**01-REQ-051 (Phase 10 — Win Condition Check)**: Win conditions shall be evaluated as specified in Section 1.9 after Phase 9 effect application.

**01-REQ-052 (Phase 11 — Event Emission)**: Events shall be emitted for all significant outcomes of the current turn. The emitted event types are a closed set covering: snake movements (direction, growth, identity of who staged the move), deaths (cause, location), severing events, food consumption, potion collection (collector and affected teammates), food spawning, potion spawning, effect applications, and effect cancellations.

**01-REQ-062 (Growth from food consumption)**: If a snake consumes food during turn T (via 01-REQ-025 or 01-REQ-046c) and is still alive at the start of turn T+1, the snake's body length (segment count) at the end of turn T+1's Phase 2 shall be exactly one greater than its body length at the end of turn T's Phase 2. A snake that dies before completing Phase 2 of turn T+1 does not grow. This requirement is the observable-behaviour contract of food consumption; the `ateLastTurn` tail-retention mechanism in 01-REQ-043 is the implementation mechanism by which it is satisfied. See resolved 01-REVIEW-008.

---

### 1.9 Win Conditions and Scoring

**01-REQ-053**: A team's **score** at any game-end moment is the sum of the body lengths (number of segments) of all alive snakes belonging to that team at that moment.

**01-REQ-054 (Last team standing)**: The game ends when all snakes of every team except one are dead. The surviving team wins. Scores are computed from alive snake lengths at that turn.

**01-REQ-055 (Simultaneous elimination)**: If all remaining alive snakes across all teams die in the same turn, the game ends. Each team's score is their combined alive snake lengths from the immediately preceding turn. The team with the highest score wins; if two or more teams tie, the result is a draw.

**01-REQ-056**: For the simultaneous elimination case where the game ends on turn 0 (all snakes die on the first turn), scores shall be computed from the initial snake lengths at game start.

**01-REQ-057 (Turn limit)**: If the configured `maxTurns` is reached and the game has not ended by another condition, the game ends. Scores are computed from alive snake lengths at that turn. The team with the highest score wins; ties are permitted.

**01-REQ-058**: A `maxTurns` of zero or absent means no turn limit; the game continues until last-team-standing or simultaneous elimination.

---

### 1.10 Randomness

**01-REQ-059**: All random operations during game setup (hazard placement, fertile tile generation, territory angular offset, snake starting positions, parity choice, initial food placement) shall use a randomness source seeded from a per-game seed. This seed shall not be accessible to any game client.

**01-REQ-060**: All random operations during turn resolution (food spawn locations, potion spawn locations) shall use a randomness source seeded from a per-turn seed. This seed shall not be accessible to any game client.

---

## REVIEW Items

### 01-REVIEW-001: Apparent redundancy between Phase 4 cancellation rules — **RESOLVED**

**Type**: Ambiguity
**Context**: Phase 4 lists two distinct bullets: (1) "if a snake with frozen invulnerabilityLevel < 0 dies in Phase 3, schedule cancellation of all invuln_buffs on its alive teammates" and (2) "if a potion collector suffers any interaction in Phase 3, schedule cancellation of that potion's effects." Since invuln_debuff is only acquired by collecting an InvulnPotion, any snake with an active invuln_debuff is necessarily an active potion collector. A vulnerable snake dying in Phase 3 satisfies both rules simultaneously — rule (1) schedules ally invuln_buff cancellation, and rule (2) schedules the same plus removal of the collector's own debuff. The requirements originally captured both rules faithfully, but the human resolution confirmed that the collector's own debuff should also be removed. This means rule (1) is fully subsumed by rule (2) for the death case.
**Question**: Is rule (1) intentionally belt-and-suspenders, or does it exist to cover a case where invuln_debuff can exist without the holder being an active collector (e.g., via a future mechanic or edge case in current rules)?
**Options**:
- A: Rule (1) is redundant; requirements collapse both rules to 01-REQ-031 alone.
- B: Rule (1) is intentionally separate and both rules are stated for clarity.
**Informal spec reference**: Section 5, Phase 4.

**Decision**: Option A (collapse).
**Rationale**: In the current rule set, `invuln_debuff` is only acquired by collecting an InvulnPotion, so "vulnerable snake dies in Phase 3" is a strict subset of "active collector suffers an interaction in Phase 3". Rule (1) adds no behavioural content that 01-REQ-031 via 01-REQ-045 doesn't already schedule. Collapsing reduces the number of places the intent is duplicated, which limits drift risk. **Revisit if**: a future rule change introduces a source of `invuln_debuff` not mediated by InvulnPotion collection — at that point the separate buff-cancellation rule would need to be reinstated.
**Affected requirements**: 01-REQ-045 (revised to schedule only via 01-REQ-031).

---

### 01-REVIEW-002: Body segments of Phase-3-dying snakes as collision targets — **RESOLVED**

**Type**: Gap
**Context**: Phase 3 evaluates all collisions simultaneously after Phase 2 movement. A snake dying from a wall collision or self-collision still has body segments at their Phase-2 positions at the moment of evaluation. The spec did not originally state whether another snake's head colliding with those segments in the same Phase 3 pass constitutes a valid body collision (01-REQ-044c).
**Question**: Do body segments of snakes that are simultaneously dying in Phase 3 from wall or self-collision count as valid collision targets for other snakes in the same Phase 3 evaluation?
**Options**:
- A: Yes — all body segments are present during the simultaneous Phase 3 evaluation regardless of what else is killing their owner.
- B: No — wall/self-collision deaths remove the snake from body-collision consideration before other snakes' collisions are checked (implying a sub-ordering within Phase 3).
**Informal spec reference**: Section 5, Phase 3.

**Decision**: Option A.
**Rationale**: "Simultaneously" admits no sub-ordering. Introducing an implicit ordering (wall/self deaths applied first) would contradict the plain reading and create a hidden precedence that needs its own justification. 01-REQ-044 now explicitly states the simultaneity semantics so a future reader can't unintentionally reintroduce the sub-ordering.
**Clarifying example (to carry into Phase 2 design)**: Snake A moves into a Wall cell in Phase 2; Snake A dies (01-REQ-044a). Simultaneously, Snake B's head moves into a non-head body segment of Snake A. Because Phase 3 is evaluated against the single post-Phase-2 board state, Snake B experiences a body collision against Snake A's body per 01-REQ-044c, resolved using Snake B's and Snake A's frozen invulnerability levels. If B's frozen level > A's frozen level, B severs A's tail-ward segments (irrelevant to A since A is already dying) and B survives; otherwise B also dies. A's wall death is not a precondition that prevents B's body-collision outcome.
**Affected requirements**: 01-REQ-044 (added explicit simultaneity clarification).

---

### 01-REVIEW-003: Effect duration semantics (`expiryTurn` interpretation) — **RESOLVED**

**Type**: Ambiguity
**Context**: Effects have a "3 turn duration" and an `expiryTurn` field. Phase 9 removes "all effects whose expiry turn has been reached." If a potion is collected on turn T, its effects start next turn (T+1). "3 turns duration" presumably means the effect is active on turns T+1, T+2, T+3. The requirements use "3-turn duration" without committing to an `expiryTurn` value, deferring to Design.
**Question**: Is `expiryTurn` the last turn on which the effect is active (removed in Phase 9 of turn T+4), the turn on which it is removed (removed in Phase 9 of turn T+3, active for T+1 and T+2 only), or something else?
**Options**:
- A: `expiryTurn = T + 4`; Phase 9 removes when `currentTurn >= expiryTurn`; effect active on T+1, T+2, T+3.
- B: `expiryTurn = T + 3`; Phase 9 removes when `currentTurn >= expiryTurn`; effect active on T+1, T+2 only (2 turns).
- C: `expiryTurn = T + 3`; Phase 9 removes when `currentTurn > expiryTurn`; effect active on T+1, T+2, T+3 (3 turns).
**Informal spec reference**: Sections 4.3, 4.4, Phase 9.

**Decision**: Custom resolution — closest to Option A in effect but with a different sentinel value. `expiryTurn` stores the *last turn on which the effect is active*. For a potion collected on turn T, effects activate at the start of T+1 (via the pendingEffects→activeEffects transition in Phase 9 of T and the frozen-state snapshot at start of T+1), `expiryTurn = T + 3`, and Phase 9 removes the effect on turn T+3 itself with the condition `currentTurn >= expiryTurn`. The effect is active on T+1, T+2, T+3.
**Rationale**: Original Option B's "2 turns active" interpretation was wrong: Phase 9's removal only affects *subsequent* turns' start-of-turn frozen state, because the current turn's frozen state was captured at start-of-turn before Phase 9 runs. So removing at Phase 9 of T+3 leaves T+3 fully in-scope for the effect and correctly excludes T+4 onward. The agent's initial lean toward Option A was an over-complication — the field name "expiryTurn" reads most naturally as "last active turn", and that interpretation composes correctly under the effect-immutability rule (01-REQ-033) without the T+4 sentinel. **Revisit if**: the effect-immutability rule (Phase 9 after frozen-state consumption) is ever changed, in which case the removal condition's interaction with active turns would need re-derivation.
**Affected requirements/design**: None yet in Phase 1 requirements — the sentinel value and removal condition will be encoded in the Phase 2 (Design) section of this module.

---

### 01-REVIEW-004: Dual-collector cancellation scope — **RESOLVED**

**Type**: Ambiguity
**Context**: 01-REQ-029 (now retired) explicitly permitted a snake to be an active collector for both potion types simultaneously (one InvulnPotion and one InvisPotion, neither yet cancelled). 01-REQ-031 specified that when an active collector suffers any interaction, "the collector's own `invuln_debuff` and/or `invis_collector` effects shall be removed (for each type held), and all alive teammates' corresponding `invuln_buff` and/or `invis_buff` effects shall be removed." A literal reading is that one interaction burns both potion stacks at once. The informal spec (Section 4.8) uses the singular phrase "that potion's effect", which reads as though the authors were only picturing the single-collector case. The two readings diverge in behaviour when a dual collector suffers one interaction: either both stacks are cancelled, or only the stack causally associated with the triggering interaction is cancelled (and identifying which stack that is, for an interaction like eating food or taking hazard damage, is itself ill-defined).
**Question**: When a dual-collector suffers a single interaction during turn resolution, is it (a) both potion stacks that are cancelled, or (b) only one stack (and if so, which)?
**Options**:
- A: Both stacks are cancelled unconditionally. Simpler; consistent with treating "interaction" as a single atomic event rather than a potion-specific event. Dual-collector states are rare enough that the edge case simplicity wins.
- B: Only the stack of the same potion type as the interaction, where an analysis of the interaction picks a specific type — e.g., eating food cancels nothing potion-specific (but then which stack?); collecting a new InvulnPotion cancels the Invuln stack; collecting a new InvisPotion cancels the Invis stack; death cancels both. This requires defining a mapping from interaction kind to affected stack(s), which adds rule surface.
- C: Only one stack, chosen by a rule like "the most recently collected". Low complexity but arbitrary and likely to produce surprising game states.
**Informal spec reference**: Section 4.8.

**Decision**: Option A — a single disruption cancels every potion-collector stack the snake holds, regardless of type or quantity.
**Rationale**: Simplest rule. Treats a disruption as a single atomic event affecting the snake as a whole rather than trying to causally attribute it to a specific potion stack. Option B would require defining a mapping from disruption kind to affected potion type, which has no natural basis (hazard damage and starvation are potion-agnostic). Option C is arbitrary and would produce surprising game states. Under 01-REVIEW-005's resolution, stacking becomes unbounded, so Option A also has the clean property of "one disruption = lose everything" — strategically this makes disruption-avoidance the dominant consideration for stacked collectors, which is consistent with the thematic "concentration breaks all at once" reading.
**Affected requirements**: 01-REQ-031 (now explicitly states "every stack of every type"). 01-REVIEW-005's resolution renamed "interaction" to "disruption" throughout; that rename is recorded there.

---

### 01-REVIEW-005: Re-collection cross-contamination of unrelated potion stack — **RESOLVED**

**Type**: Ambiguity
**Context**: 01-REQ-032 (now retired) specified that collecting potion type P while already holding an active collector status for P cancels the earlier P-stack before scheduling the new P-stack. Independently, per the original 01-REQ-030(g), any potion collection was an interaction, so if the collector also held an active stack of a different type Q, 01-REQ-031 implied Q was also cancelled by the interaction. Whether the Q-stack was cancelled when re-collecting P depended on the resolution of 01-REVIEW-004.
**Question**: If a snake holds active collector stacks for both InvulnPotion and InvisPotion, and collects a *new* InvulnPotion, does the InvisPotion stack get cancelled as a side effect of the collection being an interaction?
**Options**:
- A: Yes — cancelled via 01-REQ-031 because collection is an interaction. Consistent with "both stacks cancelled on any interaction" (01-REVIEW-004 Option A).
- B: No — only the P-stack re-collected is cancelled (per the retired 01-REQ-032), and cross-type cancellation is explicitly suppressed for re-collection interactions. Requires carving out an exception to 01-REQ-031.
**Informal spec reference**: Section 4.8; Phase 6.

**Decision**: Neither A nor B as originally framed. The question is resolved by a deeper change: item collection (both food and potions) is *removed* from the class of events that cancel potion effects, and the class itself is renamed from "interaction" to **disruption**. Re-collecting a potion type the snake already holds simply adds another independent stack of pending effects, with no cancellation of any prior stack, same-type or cross-type.
**Rationale**: The original framing assumed item collection had to remain in the class. Dropping that premise is strictly simpler and opens a design space the original rules didn't support: a snake can accumulate multiple stacks of either potion type, becoming (for example) an extra-vulnerable collector with extra-invulnerable teammates, or a collector of both potion types simultaneously making teammates both invulnerable *and* invisible. Under the new rules, stacked potion effects on a team can only be built up via repeated voluntary collection, because 01-REQ-031 strips the entire collector stack on any disruption. Food consumption also loses its disruption status — eating food now grows and heals the snake with no effect on potion state, which is more intuitive.

The rename from "interaction" to "disruption" reflects the narrower class: violent or damaging events that break the collector's concentration on the potion's magic. "Interaction" was too broad and generic; "disruption" reads naturally across severing, being severed, receiving body collisions, entering hazards, and death from any cause. Item collection is voluntary and non-violent, so it falls outside the disruption class by design.

**Revisit if**: gameplay testing shows stacking produces degenerate strategies (e.g., one team farms potions to stack `invis_buff` indefinitely and becomes uncatchable). A cap on stacks per type, or a diminishing-returns formula, would be natural counter-balances to add without reintroducing cancellation-on-collect.

**Affected requirements**:
- 01-REQ-025: stripped the "eating food is an interaction" clause.
- 01-REQ-026, 01-REQ-027: stripped "collecting a potion is an interaction"; added explicit stacking language.
- 01-REQ-028: rewritten to define "active potion collector" as holding *one or more* stacks of either type; stacking unbounded.
- 01-REQ-029: retired (subsumed by new 01-REQ-028).
- 01-REQ-030: renamed concept from "interaction" to "disruption"; removed (f) eating food and (g) item collection from the closed set; added explicit note that item collection is *not* a disruption.
- 01-REQ-031: renamed; clarified that *all* stacks of *both* types are cancelled on any disruption (per 01-REVIEW-004).
- 01-REQ-032: retired.
- 01-REQ-033: renamed "interaction" → "disruption".
- 01-REQ-044: cross-reference to resolved 01-REVIEW-002 added.
- 01-REQ-045: renamed "interaction" → "disruption".
- 01-REQ-046b: renamed.
- 01-REQ-046c: stripped "eating food is an interaction"; clarified that hazard entry on the same cell remains a disruption.
- 01-REQ-046d: renamed; simplified (the "vulnerable snake dying triggers ally buff cancellation" branch is subsumed by "active collector suffers a disruption", per resolved 01-REVIEW-001).
- 01-REQ-047: simplified — re-collection no longer branches on existing stacks; potion collection is never a disruption.

---

### 01-REVIEW-006: Phase 1 turn-0 fallback direction — **RESOLVED**

**Type**: Proposed Addition
**Context**: The informal spec (Section 5, Phase 1) said on turn 0 with no staged move the snake moves "to the first available non-lethal adjacent cell, using deterministic tie-breaking by priority: Up → Right → Down → Left." The informal spec was silent on what happens if *all four* adjacent cells are lethal. 01-REQ-042(c) as originally drafted resolved this by adding a final unconditional "else Up" clause. This was a silent addition during Phase 1 extraction, surfaced here rather than resolved in-place.
**Question**: Should the Phase 1 fallback include a final unconditional direction when all four adjacent cells are lethal, and if so, what?
**Argument for keeping "else Up"**: Phase 1 must produce a direction for every alive snake. Without a final fallback, the rule is incomplete on the edge case. The edge case should be unreachable under normal configurations given wall-border + territory-constrained placement, but a defensive fallback removes an undefined behaviour class from the spec. "Else Up" is the deterministic default consistent with the priority order and causes an immediate wall death in Phase 3, which is a well-defined outcome.
**Argument against**: Adding content not in the informal spec is scope creep; we should instead treat "all four lethal" as an invariant violation and specify that game configuration must guarantee it's unreachable.
**Informal spec reference**: Section 5, Phase 1.

**Decision**: Replace the informal spec's deterministic Up → Right → Down → Left + defensive "else Up" scheme entirely. On turn 0, a snake with no staged move chooses its direction **uniformly at random from {Up, Right, Down, Left}** using the turn seed (01-REQ-060). The random choice is not constrained to non-lethal cells; if it happens to pick a wall or self-collision direction, the snake dies in Phase 3, same as any other fatal move. From turn 1 onward, the fallback remains "continue in `lastDirection`" as already specified.
**Rationale**: The informal spec's statement of intent is treated as a draft under the newly clarified precedence in SPEC-INSTRUCTIONS.md — the formal module is free to diverge with human approval, which this decision is. Random choice is strictly simpler than the deterministic priority scheme, eliminates the "all four lethal" edge case cleanly (randomness is total over the four directions regardless of lethality), and introduces a small element of unpredictability on turn 0 that feels more natural than a priority bias toward Up. Dropping the non-lethality filter removes a special case and keeps Phase 1 purely concerned with *choosing* a direction, leaving death determination to Phase 3 where it belongs. The turn seed is the natural randomness source because Phase 1 is a turn-resolution operation (01-REQ-060 governs turn-resolution randomness).
**Affected requirements**: 01-REQ-042 (rewritten).
**Meta note**: This resolution prompted the clarification in SPEC-INSTRUCTIONS.md that completed formal module content supersedes the informal spec wherever it covers the same ground, while the informal spec remains authoritative for anything not yet formally captured. The informal spec is a draft statement of intent, not a binding rulebook.

---

### 01-REVIEW-007: Parity × territory feasibility (gap) — RESOLVED

**Type**: Gap
**Context**: 01-REQ-014 assigns inner cells to team territories by angular-sector overlap. 01-REQ-015 places each snake's starting head on a non-Wall, non-Hazard inner cell within its team's territory. 01-REQ-016 requires all starting heads across all teams to share the same parity (`(x + y) mod 2`), with the parity value chosen randomly. No requirement currently guarantees that every team's territory contains enough eligible cells of the chosen parity to seat `snakesPerTeam` heads. On small boards with many teams, high hazard percentage, and unlucky angular offset, a given team's territory could contain zero eligible cells of a particular parity.
**Question**: How should game setup handle configurations where the parity choice + territory assignment + hazard placement combine to produce insufficient eligible cells for some team?
**Options**:
- A: Deterministic retry: constrain the parity choice to parities for which every team's territory contains ≥ `snakesPerTeam` eligible cells; if no parity satisfies, regenerate the angular offset (and/or hazard layout) using the next random value from the game seed and retry.
- B: Reject the game configuration at provisioning time as infeasible; surface the failure to the room host with guidance to change parameters.
- C: Ordered resolution: generate hazards, assign territories, enumerate parity feasibility, pick parity; if infeasible, fall back to a hazard regeneration step. (Essentially A with explicit ordering spelled out.)
**Informal spec reference**: Section 4.4.

**Decision**: Hybrid of A and B with a bounded retry budget. Board generation (the full sequence from hazard placement through initial food placement) is treated as a single atomic attempt. On failure, the entire generation sequence is retried under a fresh deterministic sub-seed derived from the game seed plus an attempt counter. Up to 3 retries are performed (4 attempts total). If all attempts fail, the game is reported infeasible with a machine-readable error and left in an unplayable state; the room owner must modify game configuration and re-provision. Codified as new requirement **01-REQ-061**.

**Rationale**:
- Rejecting immediately (pure B) is hostile to the common case: a single unlucky angular offset or hazard layout under otherwise-fine settings should self-heal without operator intervention.
- Unbounded retry (pure A) risks silent infinite loops on genuinely infeasible configurations (e.g., hazard percentage so high that no valid layout exists for the given team/snake counts). A bounded budget forces the failure mode to surface promptly.
- Retrying the whole generation sequence (rather than selectively regenerating individual phases) is simpler and avoids having to reason about partial state consistency across failed sub-phases. The cost is a handful of extra random draws per retry, which is negligible at setup time.
- Failing into an unplayable-but-reconfigurable state (rather than destroying the room) preserves the room owner's context and lets them iterate on configuration until a feasible combination is found.
- "Up to 3 retries" was interpreted as 3 retries beyond the initial attempt (4 attempts total). If the intended reading was "3 attempts total", this should be flagged and 01-REQ-061 adjusted.
- The sub-seed derivation mechanism is deferred to the design phase; the requirement only constrains that each attempt's seed be deterministically derivable from the game seed plus attempt index, so the full sequence of attempts is reproducible from the game seed alone.
- The failure conditions enumerated in 01-REQ-061 (hazard connectivity + per-team parity feasibility) are the two currently-known ways board generation can fail. If future requirements introduce additional generation constraints, 01-REQ-061's failure-condition list should be extended accordingly.

**Affected requirements**: 01-REQ-061 (new).

---

### 01-REVIEW-008: Snake growth never explicitly required (proposed addition) — RESOLVED

**Type**: Proposed Addition
**Context**: Neither 01-REQ-025 (food consumption) nor 01-REQ-046c (Phase 5 food consumption) states that the snake grows by one segment. Growth is implicit via 01-REQ-043's "if `ateLastTurn` is true, the tail segment is retained", which causes the next Phase 2 movement to preserve the tail. Functionally this is correct, but growth-as-observable-behaviour is not captured as a direct testable requirement. A future editor modifying Phase 2's tail-handling logic could break growth without failing any requirement's literal wording.
**Question**: Should growth be captured as an explicit requirement independent of the `ateLastTurn` mechanism?
**Proposed requirement**: "A snake that consumes food in Phase 5 shall have its body length increase by exactly one segment on its next Phase 2 movement, unless the snake has died in the intervening period."
**Informal spec reference**: Section 4.3.

**Decision**: Add an explicit growth requirement framed in terms of observable length change on the turn *after* consumption. Codified as **01-REQ-062**: if a snake consumes food on turn T and is alive at the start of turn T+1, its length at the end of T+1's Phase 2 shall be exactly one greater than its length at the end of T's Phase 2. The existing `ateLastTurn` / tail-retention mechanism in 01-REQ-043 is explicitly identified as the implementation mechanism satisfying 01-REQ-062, not as a competing requirement.

**Rationale**:
- Observable-behaviour requirements should live alongside the implementation-mechanism requirements that satisfy them, not be inferred from them. This protects against silent regressions where a future edit to 01-REQ-043's tail-handling logic breaks growth without tripping any literal requirement.
- Framing in terms of "turn T+1's Phase 2" rather than "the next Phase 2 movement" is unambiguous under the turn pipeline: it specifies both *when* the growth is observable and that it's tied to exactly one Phase-2 movement after consumption (no double-counting across multiple consumptions of food in close succession — each food event is a distinct obligation on the next turn's movement).
- The "still alive at the start of turn T+1" guard covers the edge case where a snake eats in Phase 5 of turn T but dies before its Phase 2 on turn T+1 (e.g., a collision where it was going to die regardless). Dead snakes don't have a length to grow.
- Phrasing in terms of end-of-Phase-2 length comparison (rather than "grows by one segment") avoids ambiguity about *when* the change is observable and makes the requirement directly testable against turn-end state snapshots.

**Affected requirements**: 01-REQ-062 (new).

---

### 01-REVIEW-009: Initial food under-supply (gap) — RESOLVED

**Type**: Gap
**Context**: 01-REQ-017 mandates spawning one food item per snake on eligible cells at game start (inner, non-Wall, non-Hazard, not occupied by snake body; additionally Fertile if fertile ground enabled). No requirement states the behaviour when eligible cells are fewer than the snake count. This is plausible on small boards with high hazard percentages and fertile-only mode enabled at low density. An implementation that naively samples without replacement would fail or loop indefinitely.
**Question**: How should initial food placement handle the case where eligible cells < snake count?
**Options**:
- A: Graceful degradation: spawn as many food items as possible (one per eligible cell), accepting that some snakes begin the game without a dedicated food item.
- B: Reject the configuration at provisioning time as infeasible.
- C: Relax eligibility: if Fertile-only eligibility is insufficient, fall back to non-Fertile eligible cells for initial placement only (with a note that Phase 7 spawning remains Fertile-only).
**Informal spec reference**: Section 4.5.

**Decision**: Fold into the existing bounded-retry mechanism codified in **01-REQ-061**. Insufficient initial-food eligibility is added as a third failure condition in 01-REQ-061's failure list. A shortfall triggers a full board-generation retry under a fresh sub-seed; after the configured retry budget is exhausted, the game is reported infeasible and the room owner reconfigures — identical failure-surfacing path as the other two failure conditions.

**Rationale**:
- Options A and C were both considered and rejected:
  - **A (graceful degradation)** silently weakens the one-food-per-snake invariant established by 01-REQ-017. Some snakes would start food-disadvantaged through no fault of their own, introducing asymmetry at setup that isn't part of the intended game design. Players would have no signal that this happened.
  - **C (relax fertile-only eligibility at setup)** creates a special-case divergence between initial food placement and Phase 7 food spawning (01-REQ-048). The fertile-ground rule exists to shape where food appears; bypassing it at setup partially defeats the point, and introduces a bifurcation that design-phase code and tests would have to track forever.
- Treating the shortfall as a feasibility failure (rather than degrading or specially relaxing) keeps 01-REQ-017 strict and unifies all board-generation feasibility failures under one mechanism. The room owner is presented with a clear signal that their combination of board size, hazard percentage, fertile density, and snake count is infeasible, and can adjust any of those dimensions to fix it.
- Reusing 01-REQ-061's retry-with-new-sub-seed covers the case where the shortfall was caused by unlucky hazard placement or unlucky starting-position assignment (both consume eligible cells) rather than by structurally infeasible configuration. If the next attempt's randomness produces enough eligible cells, the game proceeds normally.
- The failure condition is evaluated *after* starting-position assignment within the same attempt, because occupied starting cells reduce the eligible-cell pool. This ordering matches the order in 01-REQ-010 through 01-REQ-017.
- No additional machinery is introduced: the same "machine-readable error identifying which constraint failed on the final attempt" contract from 01-REQ-061 now covers this case as well.

**Affected requirements**: 01-REQ-061 (failure-condition list extended).
