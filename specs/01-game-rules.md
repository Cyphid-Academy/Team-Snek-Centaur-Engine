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
- `centaurTeamId`: owning CentaurTeam
- `body`: ordered list of cell positions, head first, tail last; length = number of segments
- `health`: integer
- `activeEffects`: collection of active potion effects, each with shape `{ family, state, expiryTurn }` where `family ∈ {invulnerability, invisibility}` and `state ∈ {buff, debuff}`. A snake holds at most one active effect per family (see 01-REQ-028).
- `pendingEffects`: collection of pending potion effects with the same shape as `activeEffects`, scheduled for application in Phase 9 of the collecting turn and becoming observable from the next turn onward. At most one pending effect per family per snake at any point (see 01-REQ-047).
- `lastDirection`: nullable Direction
- `alive`: boolean
- `ateLastTurn`: boolean

`invulnerabilityLevel` and `visible` are *not* fields of `SnakeState`. They are derived from `activeEffects` per 01-REQ-022 and 01-REQ-023 respectively and computed on demand; the design section specifies the functions.

**01-REQ-005**: The system shall define an `ItemType` with values: `Food`, `InvulnPotion`, `InvisPotion`.

**01-REQ-006**: The system shall define a potion `EffectFamily` with values `invulnerability` and `invisibility`, and an `EffectState` with values `buff` and `debuff`. A potion effect is a `(family, state, expiryTurn)` triple. The four combinations are the exhaustive set of potion effects a snake can hold.

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

**01-REQ-018**: Each snake shall be assigned a unique letter designation within its team, assigned consecutively starting from `A`. A snake's display name is `{centaurTeamName}.{letter}` (e.g., `Red.A`).

**01-REQ-019**: The number of snakes each team fields per game shall be equal across all teams and is determined by the configured `snakesPerTeam` parameter (1–10).

**01-REQ-020**: At game start, every snake shall have length 3 with all three body segments positioned on the snake's starting cell.

**01-REQ-021**: At game start, every snake shall have `health = MaxHealth`, `activeEffects = []`, `pendingEffects = []`, `ateLastTurn = false`, `lastDirection = null`, `alive = true`. Because `activeEffects` is empty, the derived `invulnerabilityLevel` is `0` and the derived `visible` is `true` for every snake at game start.

---

### 1.4 Items and Derived Effect Fields

**01-REQ-022**: A snake's `invulnerabilityLevel` is a derived value in `{-1, 0, +1}` computed from its `activeEffects`:
- `+1` if the snake holds an active effect with `family = invulnerability` and `state = buff`
- `-1` if the snake holds an active effect with `family = invulnerability` and `state = debuff`
- `0` otherwise (no active invulnerability effect)

Because a snake holds at most one active effect per family (01-REQ-028), these cases are exhaustive and mutually exclusive. `invulnerabilityLevel` is used exclusively for collision outcome resolution in 01-REQ-044c and 01-REQ-044d; it is not a stored field.

**01-REQ-023**: A snake's `visible` value is derived: `visible = false` if and only if the snake holds an active effect with `family = invisibility` and `state = buff`; otherwise `visible = true`. A snake holding an active `(invisibility, debuff)` effect — the invisibility collector — **remains visible**, so that opponents can target them for disruption. `visible` is not a stored field.

**01-REQ-024**: Invisible snakes (visible = false) shall not be observable by connections belonging to opponent teams. All game mechanics (collision, severing, health, scoring) apply to invisible snakes identically to visible snakes. Invisibility is an information asymmetry only.

**01-REQ-025**: When a surviving snake's head occupies a food cell during turn resolution, the food item is consumed: `ateLastTurn` is set to `true` and `health` is restored to `MaxHealth`. Item collection (food or potions) is *not* a disruption — see 01-REQ-030.

**01-REQ-026**: When one or more surviving snakes belonging to a team T collect one or more InvulnPotions during Phase 6 of the same turn, a single team rebuild of the `invulnerability` family is scheduled via `pendingEffects`: every alive member of T receives one pending effect `(family = invulnerability, state, expiryTurn = currentTurn + 3)` where `state = debuff` if the member collected a potion this turn and `state = buff` otherwise. This rebuild *replaces* any existing active or pending invulnerability-family effect on every member of T in Phase 9 (see 01-REQ-047 and 01-REQ-050).

**01-REQ-027**: When one or more surviving snakes belonging to a team T collect one or more InvisPotions during Phase 6 of the same turn, a single team rebuild of the `invisibility` family is scheduled via `pendingEffects` analogously to 01-REQ-026: every alive member of T receives one pending `(family = invisibility, state, expiryTurn = currentTurn + 3)`, where `state = debuff` for snakes that collected this turn and `state = buff` otherwise. An invisibility-family `debuff` holder remains visible per 01-REQ-023. This rebuild replaces any existing active or pending invisibility-family effect on every member of T in Phase 9.

---

### 1.5 Disruptions and Potion Effect Cancellation

**01-REQ-028**: A snake holds at most one active effect per family and at most one pending effect per family. This is a structural invariant maintained by Phase 6's team rebuild semantics (01-REQ-047) and Phase 9's replace-semantics effect application (01-REQ-050); no phase inserts an effect of a family already present without first removing the prior one. A snake is the **active collector for family F** if and only if it currently holds an active effect `(family = F, state = debuff)`. A snake may simultaneously be the active collector for both families (one debuff of each); the two families are independent.

**01-REQ-029**: *(Retired. ID not reused. See resolved 01-REVIEW-015.)*

**01-REQ-030**: A **disruption** is any of the following events experienced by a snake during turn resolution. This set is closed:
- (a) Death from any cause
- (b) Severing another snake's body
- (c) Being severed by another snake
- (d) Receiving a body collision — a foreign snake's head enters a cell occupied by this snake's body
- (e) Entering a hazard cell

Item collection (food, InvulnPotion, InvisPotion) is explicitly *not* a disruption.

**01-REQ-031**: If a snake that is the active collector for family F (01-REQ-028) suffers any disruption during turn resolution, a team-wide, family-scoped cancellation shall be scheduled for Phase 9: every active effect of family F shall be removed from every alive member of the collector's team. Other families are untouched. If the disrupted snake is the active collector for both families simultaneously, both families cancel independently. Cancellation removes active effects only; pending effects scheduled by a Phase 6 rebuild in the same turn (01-REQ-047) are not discarded and proceed to application in Phase 9 step (b) normally. A same-turn re-collection therefore supersedes a disruption-triggered cancellation of the same family.

**01-REQ-032**: *(Retired. ID not reused. See resolved 01-REVIEW-015.)*

---

### 1.6 Effect Immutability

**01-REQ-033**: All reads of `activeEffects` (and the values derived from it — `invulnerabilityLevel` per 01-REQ-022 and `visible` per 01-REQ-023) during collision detection and disruption evaluation within a turn shall return each snake's start-of-turn values. Any effect gained, cancelled, or expired during the current turn's resolution shall have no observable influence on that turn's collision or disruption outcomes; such changes become observable no earlier than Phase 9 and are reflected in subsequent turns' start-of-turn values. See resolved 01-REVIEW-014.

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

**01-REQ-044 (Phase 3 — Collision Detection)**: After all snakes have moved in Phase 2, the following collision types shall be evaluated simultaneously, reading each snake's start-of-turn effect state per 01-REQ-033. "Simultaneously" means no sub-ordering within Phase 3: the post-Phase-2 board configuration (all moved heads and all body segments of all snakes, including snakes that are themselves dying from wall or self-collision within this same Phase 3) is the single reference state against which every collision rule is evaluated. A snake dying from wall or self-collision in Phase 3 does not have its body removed from Phase 3's evaluation; its segments remain valid body-collision targets for other snakes in the same pass. See resolved 01-REVIEW-002 for a worked example.

**01-REQ-044a (Wall collision)**: A snake whose head occupies a Wall cell after Phase 2 dies.

**01-REQ-044b (Self-collision)**: A snake whose head occupies a cell containing any other segment of its own body after Phase 2 dies. (The just-vacated tail cell is not included, as the tail is removed in Phase 2 before this check.)

**01-REQ-044c (Body collision)**: A snake (attacker) whose head occupies a cell containing a non-head body segment of another snake (victim) after Phase 2 shall be resolved using each snake's start-of-turn `invulnerabilityLevel` (per 01-REQ-033): if the attacker's start-of-turn level exceeds the victim's start-of-turn level, the victim is **severed** — all body segments from the contact segment through the tail are removed from the victim, and the attacker survives; otherwise the attacker dies.

**01-REQ-044d (Head-to-head collision)**: When two or more snake heads occupy the same cell after Phase 2, resolution uses each involved snake's start-of-turn `invulnerabilityLevel` (per 01-REQ-033): snakes whose start-of-turn level is below the maximum start-of-turn level among the involved snakes die; among the remaining snakes (those at the maximum start-of-turn level), shorter snakes (fewer body segments after Phase 2) die; if two or more snakes at the maximum level have equal length, all of them die.

**01-REQ-045 (Phase 4 — Pending Effect Recording)**: For each snake that suffers any disruption in Phase 3 (death, severing, being severed, receiving a body collision) and is the active collector for at least one family per 01-REQ-028, the team-wide, family-scoped cancellation specified in 01-REQ-031 shall be scheduled for application in Phase 9, based on Phase 3 outcomes read against each snake's start-of-turn effect state (per 01-REQ-033). Cancellation scope is determined by which families the disrupted snake holds a `debuff` of at start-of-turn.

**01-REQ-046 (Phase 5 — Health, Hazards, and Food)**: The following are applied to each surviving snake in order. All health modifications shall be calculated before any starvation deaths are evaluated.

**01-REQ-046a (Health tick)**: 1 health point is subtracted from every surviving snake unconditionally.

**01-REQ-046b (Hazard damage)**: If a surviving snake's head occupies a Hazard cell, the configured `hazardDamage` (default 15) is subtracted from its health. Entering a hazard cell is a disruption; if the snake is an active potion collector, schedule cancellation per 01-REQ-031.

**01-REQ-046c (Food consumption)**: If a surviving snake's head occupies a food cell, the food is consumed: `ateLastTurn` is set to `true` and `health` is restored to `MaxHealth`. If the cell is simultaneously a Hazard cell, hazard damage from 01-REQ-046b is applied first (a disruption in its own right), then food healing (net health after tick, hazard, and food: `MaxHealth`). Eating food is *not* a disruption; the hazard entry on the same cell still is.

**01-REQ-046d (Starvation death)**: After all health modifications in Phase 5 are applied, any snake with health ≤ 0 dies of starvation. Starvation death is a disruption (subcase of "death from any cause" in 01-REQ-030). If the dead snake is an active potion collector, schedule cancellation per 01-REQ-031.

**01-REQ-047 (Phase 6 — Potion Collection)**: For each surviving snake whose head occupies a potion cell after Phase 2 movement, the potion is consumed. Phase 6 then aggregates by team and by potion family: for each team T and each family F such that at least one member of T consumed a potion of family F this turn, schedule the single team rebuild specified in 01-REQ-026 (for invulnerability) or 01-REQ-027 (for invisibility). The rebuild is recorded as per-member `pendingEffects` entries with a "replace on apply" marker at the family level, meaning Phase 9 (01-REQ-050) will remove any prior active or pending entry of the same family on each affected member before inserting the new one. Simultaneous multi-collection by the same team of the same family is collapsed into a single coherent rebuild: every collector-of-this-turn gets `state = debuff`, every non-collector alive teammate gets `state = buff`, and all affected members receive the same `expiryTurn = currentTurn + 3`. Potion collection is not a disruption (01-REQ-030).

**01-REQ-048 (Phase 7 — Food Spawning)**: Food shall spawn each turn. The expected count is the configured `foodSpawnRate` (a non-negative decimal; 0 means no food ever spawns). The guaranteed count is `floor(foodSpawnRate)` items, with probability `foodSpawnRate mod 1` of one additional item. Spawn locations are chosen randomly using the turn seed from eligible cells: inner, non-Wall, non-Hazard, and not currently occupied by a snake, food, or potion. When `fertileGroundEnabled(board)` is true (Section 3.2), eligible cells are further restricted to Fertile cells.

**01-REQ-049 (Phase 8 — Potion Spawning)**: InvulnPotions shall spawn each turn using `invulnPotionSpawnRate` by the same probabilistic mechanism and eligible-cell criteria as food; a spawn rate of 0 results in no invulnerability potions spawning. InvisPotions shall spawn independently each turn using `invisPotionSpawnRate` by the same mechanism; a spawn rate of 0 results in no invisibility potions spawning.

**01-REQ-050 (Phase 9 — Effect Application and Expiry)**: All pending effect cancellations and new effect additions scheduled during Phases 4–6 shall be applied in the following order: (a) cancellations scheduled under 01-REQ-031 remove all active effects of the cancelled families on every alive team member; (b) pending team rebuilds scheduled under 01-REQ-047 are applied with replace-semantics — for each affected `(snake, family)` pair, any remaining active effect of that family on that snake is removed and the rebuild's pending entry becomes active; (c) all active effects whose expiry condition has been reached (`currentTurn >= expiryTurn`) are removed. The per-family single-effect invariant of 01-REQ-028 holds at the end of Phase 9. `invulnerabilityLevel` and `visible` are derived values per 01-REQ-022/023 and require no separate recomputation step.

**01-REQ-051 (Phase 10 — Win Condition Check)**: Win conditions shall be evaluated as specified in Section 1.9 after Phase 9 effect application.

**01-REQ-052 (Phase 11 — Event Emission)**: Events shall be emitted for all significant outcomes of the current turn. The emitted event types are a closed set covering: snake movements (direction, growth, identity of who staged the move), deaths (cause, location), severing events, food consumption, potion collection (collector and affected teammates), food spawning, potion spawning, effect applications, and effect cancellations.

**01-REQ-062 (Growth from food consumption)**: If a snake consumes food during turn T (via 01-REQ-025 or 01-REQ-046c) and is still alive at the start of turn T+1, the snake's body length (segment count) at the end of turn T+1's Phase 2 shall be exactly one greater than its body length at the end of turn T's Phase 2. A snake that dies before completing Phase 2 of turn T+1 does not grow. See resolved 01-REVIEW-008.

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

### 1.11 Game Configuration Parameter Ranges

**01-REQ-063 (Board size range)**: `boardSize` shall be one of `Small`, `Medium`, `Large`, or `Giant` as defined by the `BoardSize` enum (01-REQ-003). No additional constraint beyond the type is required.

**01-REQ-064 (Snakes per team range)**: `snakesPerTeam` shall be an integer in the range 1–10, default 5 (consistent with 01-REQ-019).

**01-REQ-065 (Max health range)**: `maxHealth` shall be an integer in the range 1–500, default 100. The lower bound ensures snakes can take at least one hit; the upper bound prevents degenerate immortality configurations.

**01-REQ-066 (Max turns range)**: `maxTurns` shall be 0 (disabled, per 01-REQ-058) or an integer in the range 1–1000, default 100. The upper bound prevents excessively long games.

**01-REQ-067 (Hazard percentage range)**: `hazardPercentage` shall be an integer in the range 0–30, default 0 (informal spec §9.3).

**01-REQ-068 (Hazard damage range)**: `hazardDamage` shall be an integer in the range 1–100, default 15 (informal spec §9.3).

**01-REQ-069 (Fertile ground density range)**: `fertileGround.density` shall be an integer in the range 0–90, default 30 (informal spec §9.3). A value of 0 disables fertile ground (no cell is marked `CellType.Fertile` during board generation and food spawning is not restricted to Fertile cells); any positive value enables it with the specified density percentage. See resolved **01-REVIEW-017**.

**01-REQ-070 (Fertile ground clustering range)**: `fertileGround.clustering` shall be an integer in the range 1–20, default 10 (informal spec §9.3). Has no effect when `fertileGround.density` is 0.

**01-REQ-071 (Food spawn rate range)**: `foodSpawnRate` shall be a number in the range 0–5, default 0.5 (informal spec §9.3).

**01-REQ-072 (Invulnerability potion spawn rate range)**: `invulnPotionSpawnRate` shall be a number in the range 0–0.2, default 0.15 (informal spec §9.3). A value of 0 disables invulnerability potions (none ever spawn); any positive value within [0.01, 0.2] yields the standard probabilistic spawn mechanic of 01-REQ-049. Values in `(0, 0.01)` are permitted by the type but operationally indistinguishable from a very rare rate. See resolved **01-REVIEW-017**.

**01-REQ-073 (Invisibility potion spawn rate range)**: `invisPotionSpawnRate` shall be a number in the range 0–0.2, default 0.1 (informal spec §9.3). A value of 0 disables invisibility potions (none ever spawn); any positive value within [0.01, 0.2] yields the standard probabilistic spawn mechanic of 01-REQ-049. See resolved **01-REVIEW-017**.

**01-REQ-074 (Initial time budget range)**: `clock.initialBudgetMs` shall be an integer in the range 0–600000 (0–10 minutes), default 60000 (informal spec §9.3). Zero means no initial budget.

**01-REQ-075 (Budget increment range)**: `clock.budgetIncrementMs` shall be an integer in the range 100–5000, default 500 (informal spec §9.3).

**01-REQ-076 (First turn time range)**: `clock.firstTurnTimeMs` shall be an integer in the range 1000–300000, default 60000. The lower bound of 1000ms is higher than `maxTurnTimeMs`'s 100ms floor because the first turn involves initial orientation and should not be blitz-constrained.

**01-REQ-077 (Max turn time range)**: `clock.maxTurnTimeMs` shall be an integer in the range 100–300000, default 10000. The lower bound of 100ms supports blitz-style play configurations.

See resolved **01-REVIEW-012**.

---

## Design

The Design section specifies *how* the requirements are satisfied. It cites requirement IDs throughout. Type definitions here are drafts that the Exported Interfaces section then elevates to the module's contract; where a type appears in both, the Exported Interfaces version is authoritative.

### 2.1 Domain Type Vocabulary

Implements 01-REQ-001 through 01-REQ-007.

```typescript
// 01-REQ-001
export const enum Direction { Up = 0, Right = 1, Down = 2, Left = 3 }

// 01-REQ-002. Fertile is an overlay on Normal — a cell is never simultaneously
// Fertile and Wall/Hazard — but is represented as a distinct CellType so that
// every inner cell sits in exactly one category and board lookups are O(1).
export const enum CellType { Normal = 0, Wall = 1, Hazard = 2, Fertile = 3 }

// 01-REQ-005
export const enum ItemType { Food = 0, InvulnPotion = 1, InvisPotion = 2 }

// 01-REQ-006. Potion effects are a `(family, state, expiryTurn)` triple.
// String values rather than numeric to keep event-stream and database rows
// human-readable; the perf cost is negligible because effect operations are
// low frequency compared to collision detection.
export type EffectFamily = 'invulnerability' | 'invisibility'
export type EffectState  = 'buff' | 'debuff'

// Coordinate convention: (0,0) is the top-left wall cell. x is column, y is row.
export interface Cell { readonly x: number; readonly y: number }

// Branded ID types so that SnakeId, CentaurTeamId, ItemId, and TurnNumber cannot be
// accidentally mixed at call sites.
export type SnakeId    = number & { readonly __brand: 'SnakeId' }
export type CentaurTeamId     = string & { readonly __brand: 'CentaurTeamId' }
export type ItemId     = number & { readonly __brand: 'ItemId' }
export type TurnNumber = number & { readonly __brand: 'TurnNumber' }

// 01-REQ-006 potion effect entry. A snake holds at most one active effect
// per family per 01-REQ-028; the collection shape is retained (rather than
// flat per-family slots) so that the family is carried on the member and
// iteration is uniform across families. `expiryTurn` is the last turn on
// which the effect is active; see resolved 01-REVIEW-003.
export interface PotionEffect {
  readonly family:     EffectFamily
  readonly state:      EffectState
  readonly expiryTurn: TurnNumber
}

// 01-REQ-004, 01-REQ-020, 01-REQ-021. Note: `invulnerabilityLevel` and
// `visible` are NOT stored fields — they are derived values computed from
// `activeEffects` by the functions in Section 3.1.
export interface SnakeState {
  readonly snakeId: SnakeId
  readonly letter: string             // single alphabetic char, 'A' + index within team
  readonly centaurTeamId: CentaurTeamId
  readonly body: ReadonlyArray<Cell>  // head at index 0, tail at last index
  readonly health: number
  readonly activeEffects:  ReadonlyArray<PotionEffect>   // ≤1 per family (01-REQ-028)
  readonly pendingEffects: ReadonlyArray<PotionEffect>   // ≤1 per family (01-REQ-047)
  readonly lastDirection: Direction | null
  readonly alive: boolean
  readonly ateLastTurn: boolean
}

// 01-REQ-007
export interface ItemState {
  readonly itemId: ItemId
  readonly itemType: ItemType
  readonly cell: Cell
  readonly consumed: boolean
}
```

**Invisibility as information asymmetry only** (01-REQ-024). `isVisible(snake) = false` has no effect on collision detection, severing, health ticks, or any other turn-resolution mechanic — those phases operate against the full live state. The derived value exists exclusively to support filtering at the observation boundary: module 04's RLS rules use it to hide invisible snakes from opponent-team subscribers, and module 09's spectator views respect the same filter. The turn-resolution pseudocode in Section 2.8 never computes `isVisible(snake)` during Phases 1–8; it is only consulted by observation-boundary code.

**Derived values, not stored fields** (01-REQ-022, 01-REQ-023). `invulnerabilityLevel ∈ {-1, 0, +1}` and `isVisible` are pure O(k) functions over `activeEffects` with k ≤ 2 per 01-REQ-028; consumers call the exported `invulnerabilityLevel(snake)` and `isVisible(snake)` helpers from Section 3.1. See resolved **01-REVIEW-014** and **01-REVIEW-015**.

**Invisibility collector remains visible** (01-REQ-023). The active collector of the invisibility family holds `(invisibility, debuff)` and is therefore `isVisible(snake) = true`. Their teammates who hold `(invisibility, buff)` are invisible to opponents. The collector is the visible "weak link" opponents can target to disrupt their team's invisibility — this is the whole point of the collector role and is symmetric to the invulnerability collector's `invulnerabilityLevel = -1` vulnerability. See resolved **01-REVIEW-016**.

### 2.2 Board Geometry

Implements 01-REQ-003, 01-REQ-008, 01-REQ-009.

```typescript
export const enum BoardSize { Small = 0, Medium = 1, Large = 2, Giant = 3 }

// Fixed per 01-REQ-003
export const BOARD_DIMENSIONS: Readonly<Record<BoardSize, { total: number; playable: number }>> = {
  [BoardSize.Small]:  { total: 11, playable: 9  },
  [BoardSize.Medium]: { total: 13, playable: 11 },
  [BoardSize.Large]:  { total: 17, playable: 15 },
  [BoardSize.Giant]:  { total: 21, playable: 19 },
}

// Flat row-major cell array. Flat layout chosen over nested arrays for
// cache locality — collision detection and hazard lookup are the hot path.
export interface Board {
  readonly size: BoardSize
  readonly width: number                       // = total
  readonly height: number                      // = total (boards are square)
  readonly cells: ReadonlyArray<CellType>      // length = width * height
}

export function cellIndex(board: Board, cell: Cell): number {
  return cell.y * board.width + cell.x
}

export function isInner(board: Board, cell: Cell): boolean {
  return cell.x > 0 && cell.x < board.width - 1
      && cell.y > 0 && cell.y < board.height - 1
}

export function parityOf(cell: Cell): 0 | 1 {
  return ((cell.x + cell.y) & 1) as 0 | 1
}

export function fertileGroundEnabled(board: Board): boolean {
  return board.cells.includes(CellType.Fertile)
}
```

`fertileGroundEnabled(board)` is the canonical predicate for whether fertile-ground food-eligibility restriction applies. Runtime consumers (Phase 7 food spawning per [01-REQ-048]) must derive the answer from the board rather than the config because `config.orchestration.fertileGround.density` is not forwarded to SpacetimeDB (see resolved [01-REVIEW-017]) — the board itself is the authoritative record of whether fertile-ground generation ran. The predicate is a pure function of `Board` and `Board.cells` is static for the lifetime of a game, so implementations may cache the result at init time; the observable value never changes across turns.

Direction semantics:

| Direction | Δx | Δy |
|-----------|----|----|
| `Up`      |  0 | −1 |
| `Right`   | +1 |  0 |
| `Down`    |  0 | +1 |
| `Left`    | −1 |  0 |

### 2.3 Randomness & Seed Derivation

Implements 01-REQ-059, 01-REQ-060, 01-REQ-061.

**PRNG**: Xoshiro256++. Chosen over `Math.random` (non-reproducible), Mulberry32 (32-bit state, insufficient for thousands of turns of per-turn reseeding), and SplitMix64 (acceptable but weaker statistical quality than Xoshiro). Xoshiro256++ has a 256-bit state that maps naturally to a 32-byte seed.

**Game seed**: 32 bytes, generated at game provisioning time, stored in the module-04 static configuration, not exposed to any client (01-REQ-059).

**Sub-seed derivation** (resolving 01-REVIEW-007's explicit deferral): given a parent seed `s` (32 bytes) and a UTF-8 context tag `t`, the sub-seed is

```
subSeed(s, t) = BLAKE3(key = s, input = t).firstBytes(32)
```

BLAKE3's keyed-hash mode gives a PRF whose output has strong uniformity properties, making it suitable for reseeding both Xoshiro and the Perlin noise offset. The requirement is only that the derivation be deterministic and reproducible from the game seed plus attempt index; BLAKE3 is a specific choice rather than the only valid one (see DOWNSTREAM IMPACT note 4).

Defined context tags:

| Context tag                | Purpose                                                          |
|----------------------------|------------------------------------------------------------------|
| `"board-attempt:{0..3}"`   | Per-retry board-generation seed (01-REQ-061)                     |
| `"hazards"`                | Hazard placement within an attempt                               |
| `"fertile"`                | Fertile tile noise sampling                                      |
| `"territory-angle"`        | Angular offset for team territories (01-REQ-014)                 |
| `"territory-tiebreak"`     | Tie-break for boundary cells on sector edges                     |
| `"parity"`                 | Parity choice (01-REQ-016)                                       |
| `"starting-positions"`     | Per-team head placement                                          |
| `"initial-food"`           | Initial food placement (01-REQ-017)                              |
| `"turn:{N}"`               | Per-turn seed for turn N (01-REQ-060)                            |
| `"phase-1-random"`         | Turn-0 random direction choice (01-REQ-042)                      |
| `"phase-7-food"`           | Food spawning randomness                                         |
| `"phase-8-potions"`        | Potion spawning randomness                                       |

The per-turn seed is derived as `subSeed(gameSeed, "turn:" + turnNumber)`; phase-level sub-seeds within a turn are then derived from that per-turn seed.

```typescript
export interface Rng {
  nextU32(): number
  nextFloat(): number                  // [0, 1)
  nextIntExclusive(maxExclusive: number): number
  pick<T>(items: ReadonlyArray<T>): T
  shuffle<T>(items: T[]): void         // in place, Fisher–Yates
}

export function rngFromSeed(seed: Uint8Array): Rng
export function subSeed(parent: Uint8Array, tag: string): Uint8Array
```

### 2.4 Board Generation Pipeline

Implements 01-REQ-010 through 01-REQ-017 and 01-REQ-061. A single *attempt* runs the six stages below using the current attempt's sub-seed; the attempt either succeeds or fails atomically.

**Stage 1 — Hazards** (01-REQ-010, 01-REQ-011). Using `subSeed(attemptSeed, "hazards")`:

1. `hazardCount = floor(innerCellCount * config.hazardPercentage / 100)`.
2. Sample `hazardCount` inner cells uniformly without replacement. Mark them `CellType.Hazard`.
3. Run BFS from any non-hazard inner cell over the graph of non-hazard, non-wall inner cells (4-connectivity). If BFS does not visit every non-hazard inner cell, the attempt **fails** with code `HAZARD_CONNECTIVITY`.

**Stage 2 — Fertile tiles** (01-REQ-012, 01-REQ-013): only runs if `config.fertileGround.density > 0`. Per Section 2.5 below. Marks selected cells `CellType.Fertile`. A fertile cell is never simultaneously a hazard because the candidate pool excludes hazards.

**Stage 3 — Territory angular offset** (01-REQ-014). Using `subSeed(attemptSeed, "territory-angle")`: sample `theta0 ∈ [0, 2π)` uniformly. For an N-team game the sector boundaries are `theta0 + k·(2π/N)` for `k = 0..N-1`. Each inner cell is assigned to the sector containing the point `(x + 0.5, y + 0.5)` (the cell centre). The "overlaps most" phrasing of 01-REQ-014 simplifies here to "sector containing the centre" because sectors have straight-line boundaries and inner cells are unit squares — the sector containing the centre is always the one with the largest overlap. Boundary-centre ties (measure-zero but possible under exact rational arithmetic) are broken using `subSeed(attemptSeed, "territory-tiebreak")`.

**Stage 4 — Parity choice** (01-REQ-016). Using `subSeed(attemptSeed, "parity")`: sample parity ∈ {0, 1} uniformly.

**Stage 5 — Starting positions** (01-REQ-015). Using `subSeed(attemptSeed, "starting-positions")`:

1. For each team `t`, build candidate set `C_t` = inner cells in team `t`'s territory that are (a) not Wall, (b) not Hazard, (c) of the chosen parity.
2. If any `|C_t| < config.snakesPerTeam`, the attempt **fails** with code `TERRITORY_PARITY_SHORTAGE` and records the offending team ID.
3. Otherwise, for each team sample `snakesPerTeam` distinct cells from `C_t` without replacement; these become head starting positions.

**Stage 6 — Initial food placement** (01-REQ-017). Using `subSeed(attemptSeed, "initial-food")`:

1. `E` = inner cells that are (a) not Wall, (b) not Hazard, (c) not occupied by any snake body segment. (At game start each snake's three segments all stack on the starting cell, so that single cell is marked occupied.)
2. If `config.fertileGround.density > 0`, restrict `E` further to Fertile cells.
3. If `|E| < totalSnakeCount`, the attempt **fails** with code `INITIAL_FOOD_SHORTAGE`.
4. Otherwise sample `totalSnakeCount` distinct cells from `E` and spawn one Food item per cell.

**Retry loop** (01-REQ-061): `attemptIndex` starts at 0. On failure, increment and re-derive `attemptSeed = subSeed(gameSeed, "board-attempt:" + attemptIndex)`, then rerun stages 1–6 from scratch. The loop runs up to 4 attempts (`attemptIndex ∈ {0, 1, 2, 3}`). If attempt 3 fails, surface:

```typescript
export interface BoardGenerationFailure {
  readonly code: 'HAZARD_CONNECTIVITY' | 'TERRITORY_PARITY_SHORTAGE' | 'INITIAL_FOOD_SHORTAGE'
  readonly attemptsUsed: 4
  readonly details: {
    readonly centaurTeamId?: CentaurTeamId
    readonly innerCellCount: number
    readonly eligibleCellCount?: number
  }
}
```

This structure satisfies the "machine-readable error identifying which constraint failed" obligation of 01-REQ-061. The room owner can then reconfigure and re-provision.

### 2.5 Fertile Tile Noise Spec

Implements 01-REQ-013. Given clustering `C ∈ [1, 20]` and density `D ∈ [1, 90]`:

1. **Base frequency** via log-linear mapping from `C`:
   ```
   baseFreq = 2 ** lerp(log2(1.0), log2(1/32), (C - 1) / 19)
   ```
   At `C = 1`, base period ≈ 1 cell (high frequency → scattered flecks). At `C = 20`, base period ≈ 32 cells (low frequency → contiguous blobs). Log-linear because human perception of spatial frequency is logarithmic; a linear mapping would visually compress most of the slider range into the low-clustering half.

2. **Noise score per inner non-Wall non-Hazard cell `(x, y)`**:
   - Derive a random 2D offset `(dx, dy) ∈ [0, 1024) × [0, 1024)` from `subSeed(attemptSeed, "fertile")` so the noise field shifts every game.
   - 4-octave fractal Perlin:
     ```
     sum = 0; amp = 1; freq = baseFreq; norm = 0
     for i in 0..3:
       sum  += amp * perlin((x + dx) * freq, (y + dy) * freq)
       norm += amp
       amp  *= 0.5
       freq *= 2
     score = sum / norm                 // ≈ [-1, 1]
     ```
   Each octave doubles frequency and halves amplitude per 01-REQ-013.

3. **Candidate pool**: all inner cells that are not Wall and not Hazard. Sort by score descending. Tie-break deterministically by `(y, x)` ascending.

4. **Selection**: take the top `ceil(|candidates| * D / 100)` cells. `ceil` rather than `floor` so that `D = 1` on small boards still yields at least one fertile cell, matching the intuitive meaning of a non-zero density knob.

**Perlin vs. alternatives**: Value noise produces visibly grid-aligned patches; simplex noise is advantageous only in ≥3 dimensions. 2D Perlin is the right level of complexity for this use case.

### 2.6 Snake Initialization

Implements 01-REQ-018 through 01-REQ-021.

1. For each team in team-registration order, assign letters consecutively starting at `'A'`. Display name is `${centaurTeamName}.${letter}` (01-REQ-018).
2. Assign the starting cells produced by Section 2.4 Stage 5 to the team's snakes in an order determined by a per-team Fisher–Yates shuffle drawn from the same `"starting-positions"` sub-seed.
3. For each snake:
   - `body = [startCell, startCell, startCell]` (length 3 with all segments stacked, per 01-REQ-020).
   - `health = config.maxHealth`.
   - `activeEffects = []`, `pendingEffects = []` — derived `invulnerabilityLevel(snake) = 0` and `isVisible(snake) = true`.
   - `lastDirection = null`.
   - `alive = true`, `ateLastTurn = false`.

### 2.7 Effect State Machine

Implements 01-REQ-022, 01-REQ-023, 01-REQ-028, 01-REQ-031, 01-REQ-033, 01-REQ-050, and the expiry semantics resolved in 01-REVIEW-003.

**Effect model: symmetric buff/debuff states**. Each potion family (`invulnerability`, `invisibility`) has two possible states on a snake: `buff` or `debuff`. A snake holds at most one active effect per family (01-REQ-028). The two families are independent; a snake can hold any combination of `{none, buff, debuff} × {none, buff, debuff}` across the two families. Effects are stored as members of an `activeEffects` collection on `SnakeState`, with each member carrying `(family, state, expiryTurn)`. The flat collection form supports uniform iteration over all current effects. See resolved **01-REVIEW-015**.

The per-family single-effect invariant is maintained by two mechanisms:

1. **Phase 6 team rebuild** (01-REQ-047): when any member of a team collects a potion of family F, the entire team's family-F state is rewritten as a single coherent pending rebuild — every alive member gets exactly one pending `(F, state)` entry. This replaces whatever family-F state the team previously had.
2. **Phase 9 replace-semantics application** (01-REQ-050): when the rebuild is applied, Phase 9 first removes any existing active-F effect on each affected snake before inserting the new one. This preserves the "≤1 per family" invariant even if the snake's previous effect hadn't yet expired.

**Derived values, not stored fields** (01-REQ-022, 01-REQ-023):

```
invulnerabilityLevel(snake) =
  +1  if snake.activeEffects has (invulnerability, buff)
  -1  if snake.activeEffects has (invulnerability, debuff)
   0  otherwise

isVisible(snake) =
  false  if snake.activeEffects has (invisibility, buff)
  true   otherwise  // including the case of (invisibility, debuff)
```

These are the *only* reads used by collision resolution in Phase 3. No cached fields, no denormalisation.

**Effect immutability as a structural invariant** (01-REQ-033). The design satisfies 01-REQ-033 structurally: no phase between start-of-turn and Phase 9 writes to `activeEffects`. The live `activeEffects` list therefore equals its start-of-turn value throughout Phases 1–8 by invariant. The derived `invulnerabilityLevel(snake)` and `isVisible(snake)` helpers called during Phase 3 and Phase 9a consequently return start-of-turn values by construction. See resolved **01-REVIEW-014**.

**Correctness-critical invariant**:

> During Phases 1–8 of turn resolution, no code path may write to `snake.activeEffects`. Phase 6 writes to `snake.pendingEffects` only; `pendingEffects` is a separate list that does not influence any effect read. Phase 9 is the sole writer of `activeEffects`.

Future edits that need to mutate effect state mid-turn must either (a) be placed at or after Phase 9, or (b) explicitly take an effect snapshot at the start of Phase 1 and reroute pre-mutation reads through it, reintroducing the snapshot at that point. See DOWNSTREAM IMPACT note 9.

**Effect duration encoding** (resolving 01-REVIEW-003). For a potion collected on turn T:

1. Phase 6 of turn T: the collecting team's family-F pending rebuild is scheduled, with every member receiving `PotionEffect { family: F, state, expiryTurn: T + 3 }` in `pendingEffects`.
2. Phase 9 of turn T: cancellations from 9a apply first (see below), then the pending rebuild is applied to `activeEffects` with replace-semantics — the effect becomes live but doesn't influence same-turn behaviour because turn T's collision and disruption reads have already completed.
3. Phase 9 of turn T+3: the expiry pass removes any effect where `currentTurn >= expiryTurn`. Here `currentTurn = T+3` and `expiryTurn = T+3`, so the effect is removed. Because the removal happens *after* turn T+3's Phases 1–8 have already read `activeEffects`, the effect is active on turns T+1, T+2, T+3 — three turns as required.

**Re-collection refreshes, does not stack**. If a team already holds an active invulnerability-family rebuild from turn T₀ and re-collects on turn T₁ > T₀, the new rebuild's `expiryTurn = T₁ + 3` unconditionally replaces the previous family-F state on every team member. This is consistent with the "replace on apply" semantics in 01-REQ-047. A debuff-holder who re-collects the same family remains the debuff-holder (their name appears in this turn's `collectorsInTurn` set).

**Cancellation semantics** (01-REQ-031). When a snake holding `(family = F, state = debuff)` suffers a disruption during turn T:

- Phase 4 records the cancellation obligation for family F on that snake's team.
- Phase 9a applies the cancellation before the rebuild/expiry passes: every active family-F effect is removed from every alive member of the team, and every pending family-F entry scheduled this turn for that team is discarded. Other families are untouched.
- If the disrupted snake holds both `(invulnerability, debuff)` and `(invisibility, debuff)` simultaneously, both families are cancelled independently.

See resolved **01-REVIEW-010** and **01-REVIEW-015** for the rationale behind the family-scoped, attribution-free cancellation model.

**Disruption buffer**. Phases 3, 5, and 6 append to a `disruptionBuffer: DisruptionRecord[]`:

```typescript
interface DisruptionRecord {
  readonly snakeId: SnakeId
  readonly cause:
    | 'wall_death'     | 'self_death'    | 'body_collision_death'
    | 'severed'        | 'severing_other'| 'body_collision_received'
    | 'head_to_head_death' | 'hazard_entry' | 'starvation'
}
```

Phase 9a reads this buffer to compute cancellation scope.

### 2.8 Turn Resolution Pipeline

Implements 01-REQ-041 through 01-REQ-052 and 01-REQ-062. Pseudocode below; `state` is the mutable game state, `T` is the current turn number, `turnSeed = subSeed(gameSeed, "turn:" + T)`.

```text
function resolveTurn(state, T, turnSeed):
  # Per Section 2.7's structural invariant, `activeEffects` (and the
  # derived `invulnerabilityLevel` / `isVisible`) equal their
  # start-of-turn values throughout Phases 1–8.
  disruptions = []

  # ---------- Phase 1: Move Collection (01-REQ-042) ----------
  # Each entry in `moves` carries both the chosen direction and the Agent
  # that staged it, or null when Phase 1 fell through to a fallback. Phase 11
  # reads `stagedBy` when emitting `snake_moved` events (01-REQ-052).
  moves = {}   # snakeId → { direction: Direction, stagedBy: Agent | null }
  rngP1 = rngFromSeed(subSeed(turnSeed, "phase-1-random"))
  for snake in aliveSnakes(state):
    if stagedMoves.has(snake.snakeId):
      sm = stagedMoves.get(snake.snakeId)
      moves[snake.snakeId] = { direction: sm.direction, stagedBy: sm.stagedBy }
    elif snake.lastDirection != null:
      moves[snake.snakeId] = { direction: snake.lastDirection, stagedBy: null }
    else:                                           # turn 0, no staged move
      moves[snake.snakeId] = { direction: rngP1.pick([Up, Right, Down, Left]),
                               stagedBy: null }

  # ---------- Phase 2: Snake Movement (01-REQ-043) ----------
  for snake in aliveSnakes(state):
    dir     = moves[snake.snakeId].direction
    newHead = advance(snake.body[0], dir)
    if snake.ateLastTurn:
      snake.body = [newHead, ...snake.body]                      # retain tail → grow
      snake.ateLastTurn = false
    else:
      snake.body = [newHead, ...snake.body.slice(0, -1)]         # drop tail
    snake.lastDirection = dir

  # ---------- Phase 3: Collision Detection (01-REQ-044) ----------
  # All evaluations run against a single post-Phase-2 snapshot of the board
  # (resolved 01-REVIEW-002).
  heads  = { snakeId → body[0]  for alive snakes }
  bodies = { snakeId → body[1:] for alive snakes }
  deaths = set()
  severings = []

  # 3a. Wall (01-REQ-044a) and self (01-REQ-044b) collisions
  for snake in aliveSnakes(state):
    head = heads[snake.snakeId]
    if cellAt(board, head) === Wall:
      deaths.add(snake.snakeId); disruptions.push({snake, 'wall_death'}); continue
    if head in snake.body.slice(1):
      deaths.add(snake.snakeId); disruptions.push({snake, 'self_death'}); continue

  # 3b. Body collisions (01-REQ-044c). Reads `invulnerabilityLevel(snake)`,
  #     a derived function over `activeEffects`, which equals start-of-turn
  #     per Section 2.7's invariant.
  for (attacker, victim, contactIndex) in bodyCollisionPairs(heads, bodies):
    attLvl = invulnerabilityLevel(attacker)
    vicLvl = invulnerabilityLevel(victim)
    if attLvl > vicLvl:
      # Sever (01-REQ-044c)
      segmentsLost = victim.body.length - contactIndex
      severings.push({attacker, victim, contactCell: victim.body[contactIndex], segmentsLost})
      victim.body = victim.body.slice(0, contactIndex)
      disruptions.push({attacker, 'severing_other'})
      disruptions.push({victim,   'severed'})
    else:
      deaths.add(attacker.snakeId)
      disruptions.push({attacker, 'body_collision_death'})
      disruptions.push({victim,   'body_collision_received'})

  # 3c. Head-to-head (01-REQ-044d). Reads `invulnerabilityLevel(snake)`,
  #     a derived function over `activeEffects`, which equals start-of-turn
  #     per Section 2.7's invariant.
  for cell, heads_here in groupBy(heads):
    if heads_here.length < 2: continue
    maxLvl  = max(invulnerabilityLevel(s) for s in heads_here)
    topTier = [s for s in heads_here if invulnerabilityLevel(s) === maxLvl]
    for s in heads_here:
      if s not in topTier:
        deaths.add(s.snakeId); disruptions.push({s, 'head_to_head_death'})
    # within the top tier, shorter snakes die
    if topTier.length >= 2:
      maxLen = max(s.body.length for s in topTier)
      atMax  = [s for s in topTier if s.body.length === maxLen]
      if atMax.length >= 2:
        for s in atMax:
          deaths.add(s.snakeId); disruptions.push({s, 'head_to_head_death'})
      else:
        for s in topTier:
          if s not in atMax:
            deaths.add(s.snakeId); disruptions.push({s, 'head_to_head_death'})

  markDead(state, deaths)

  # ---------- Phase 4: Pending Effect Recording (01-REQ-045) ----------
  # Intentionally minimal — the disruption buffer already contains every
  # Phase-3 disruption; scheduling of cancellations is applied in Phase 9.
  # Phase 4 exists as a phase boundary for event ordering parity with the
  # informal spec's numbering (01-REQ-041) and performs no state mutation.

  # ---------- Phase 5: Health, Hazards, and Food (01-REQ-046) ----------
  for snake in aliveSnakes(state):
    snake.health -= 1                                            # 5a: health tick (01-REQ-046a)
    if cellAt(board, snake.body[0]) === Hazard:                  # 5b
      snake.health -= config.hazardDamage
      disruptions.push({snake, 'hazard_entry'})
    foodAt = findFoodAt(state, snake.body[0])                    # 5c
    if foodAt != null:
      consumeFood(state, foodAt)
      snake.health = config.maxHealth
      snake.ateLastTurn = true
  for snake in aliveSnakes(state):                               # 5d: starvation
    if snake.health <= 0:
      markDead(state, snake.snakeId)
      disruptions.push({snake, 'starvation'})

  # ---------- Phase 6: Potion Collection (01-REQ-047) ----------
  # Collect-and-aggregate: first identify all (team, family, collectorSet)
  # triples for this turn, then schedule a single team rebuild per triple.
  # This collapses simultaneous multi-collection into one coherent rebuild
  # rather than producing multiple overlapping pending entries.
  collectorsByCentaurTeamFamily = {}  # (centaurTeamId, family) → set(snakeId)
  for snake in aliveSnakes(state):
    potionAt = findPotionAt(state, snake.body[0])
    if potionAt == null: continue
    consumePotion(state, potionAt)
    family = (potionAt.itemType === InvulnPotion) ? 'invulnerability' : 'invisibility'
    key = (snake.centaurTeamId, family)
    collectorsByCentaurTeamFamily.setdefault(key, set()).add(snake.snakeId)

  for (centaurTeamId, family), collectorIds in collectorsByCentaurTeamFamily.items():
    expiry = T + 3
    for mate in aliveMembersOf(state, centaurTeamId):
      state_ = (mate.snakeId in collectorIds) ? 'debuff' : 'buff'
      # `pendingEffects` is written exactly once per mate per family per
      # turn by the two-pass structure above. Phase 9b removes any
      # active-family entry on `mate` before applying the pending one.
      removePendingOfFamily(mate, family)
      pushPending(mate, { family, state: state_, expiryTurn: expiry })

  # ---------- Phase 7: Food Spawning (01-REQ-048) ----------
  # `eligibleFoodCells(state)` restricts to Fertile cells iff
  # `fertileGroundEnabled(state.board)` is true (Section 3.2). The derived
  # predicate is a pure function of the board and may be cached at init time
  # since the board never changes post-generation.
  rngP7 = rngFromSeed(subSeed(turnSeed, "phase-7-food"))
  spawnItems(state, ItemType.Food, config.foodSpawnRate, rngP7, eligibleFoodCells(state))

  # ---------- Phase 8: Potion Spawning (01-REQ-049) ----------
  # spawnRate == 0 is the disabled sentinel; spawnItems with expected count 0
  # is a no-op, so no explicit branch is needed.
  rngP8 = rngFromSeed(subSeed(turnSeed, "phase-8-potions"))
  spawnItems(state, ItemType.InvulnPotion, config.invulnPotionSpawnRate,
             rngP8, eligiblePotionCells(state))
  spawnItems(state, ItemType.InvisPotion, config.invisPotionSpawnRate,
             rngP8, eligiblePotionCells(state))

  # ---------- Phase 9: Effect Application and Expiry (01-REQ-050) ----------
  # Order: cancel → apply pending rebuilds (with replace semantics) → expire.
  # Collector identification in 9a reads live `activeEffects`, which per
  # Section 2.7's invariant still equals start-of-turn state here because
  # 9a runs *before* 9b/9c mutate it.

  # 9a. Team-wide, family-scoped cancellation for every disrupted debuff-holder.
  cancelledByCentaurTeamFamily = set()  # (centaurTeamId, family) pairs
  for d in disruptions:
    snake = state.snakeById(d.snakeId)
    for e in snake.activeEffects:
      if e.state === 'debuff':
        cancelledByCentaurTeamFamily.add((snake.centaurTeamId, e.family))
  for (centaurTeamId, family) in cancelledByCentaurTeamFamily:
    for mate in aliveMembersOf(state, centaurTeamId):
      removeActiveOfFamily(mate,  family)
      removePendingOfFamily(mate, family)
    # (Dead team members' remaining effects are irrelevant going forward; the
    # family state is reset for everyone, including implicit cleanup on any
    # snake that died this turn and still has a dangling entry.)

  # 9b. Apply pending rebuilds with replace-semantics. Any pending entry that
  #     survived 9a is applied; it overwrites any prior active entry of the
  #     same family on the same snake. Because Phase 6 writes at most one
  #     pending entry per family per snake per turn, this loop processes at
  #     most two pending entries per snake.
  for snake in allSnakes(state):
    for pe in snake.pendingEffects:
      removeActiveOfFamily(snake, pe.family)
      snake.activeEffects = [...snake.activeEffects, pe]
    snake.pendingEffects = []

  # 9c. Expire effects whose last-active turn has been reached.
  for snake in allSnakes(state):
    snake.activeEffects = snake.activeEffects.filter(e => T < e.expiryTurn)

  # ---------- Phase 10: Win Condition Check (01-REQ-051) ----------
  outcome = checkWinConditions(state, T)

  # ---------- Phase 11: Event Emission (01-REQ-052) ----------
  emitEvents(turnEventBuffer)

  return { nextState: state, events: turnEventBuffer, outcome }
```

**Phase 9 ordering rationale**. The sequence is *cancel (9a) → apply pending rebuilds with replace-semantics (9b) → expire (9c)*. Alternative orderings were considered:

- **Apply-then-cancel** would expose newly-pending effects from Phase 6 collection to cancellation by same-turn disruption. 01-REQ-033 requires debuff-holder identification against start-of-turn state; a snake that collected for the first time this turn holds no debuff at start-of-turn and is therefore not a cancellation trigger. Per Section 2.7's invariant, `snake.activeEffects` still equals its start-of-turn value at step 9a, so the cancellation pass reads it directly. Cancelling before applying rebuilds is what preserves that equality at 9a's read sites.
- **Expire-then-cancel** would wrongly skip cancellation for a debuff-holder whose debuff expires the same turn as the disruption: the expiry pass would strip the debuff before 9a could read it. The pseudocode avoids this by running 9a first.
- **Cancel-then-expire-then-apply** (swapping 9b and 9c) would be observably equivalent to the chosen order in all cases because (i) the rebuild's `expiryTurn = T + 3` is always strictly greater than the current turn `T`, so the new entry cannot be expired by 9c regardless of position, and (ii) 9a's cancellation already stripped any family-F entries the rebuild replaces, so the `removeActiveOfFamily` in 9b is a no-op for freshly-cancelled families. Chosen order is cleaner to read.

**Phase 3 simultaneity** (resolved 01-REVIEW-002). The body-collision loop iterates against the post-Phase-2 `bodies` snapshot regardless of which snakes are being added to `deaths` in the same phase; this means snake B can sever or body-collide with snake A's body even if A is itself dying from a wall or self-collision in the same Phase 3. The pseudocode achieves this by computing `heads`/`bodies` once at phase start and not mutating them as deaths accumulate.

**Growth observability** (01-REQ-062). `ateLastTurn = true` set in Phase 5c of turn T causes Phase 2 of turn T+1 to retain the old tail. The body-length comparison `end-of-Phase-2(T+1) − end-of-Phase-2(T) === +1` is directly observable via the `snake_moved.grew` boolean in the turn event stream.

**Food-on-hazard coexistence** (01-REQ-046c). The pseudocode applies hazard damage (5b) before food healing (5c); the net health after a snake enters a food-on-hazard cell with health `h` is `max(h - 1 - hazardDamage, ...) → MaxHealth` via the food heal overriding the damaged value. Importantly, the hazard *entry disruption* is still recorded in 5b, so a collector entering a food-on-hazard cell still loses its stacks at Phase 9 (01-REQ-046c's explicit note).

### 2.9 Chess Timer

Implements 01-REQ-034 through 01-REQ-040. Per-team clock state:

```typescript
export interface CentaurTeamClockState {
  readonly centaurTeamId: CentaurTeamId
  readonly budgetMs: number          // persistent across turns (01-REQ-034, 01-REQ-035)
  readonly perTurnMs: number         // current turn only (01-REQ-037)
  readonly declaredTurnOver: boolean
}
```

**At turn start** for each team (01-REQ-036, 01-REQ-037):

```
budgetMs  += config.clock.budgetIncrementMs
cap        = (T === 0) ? config.clock.firstTurnTimeMs : config.clock.maxTurnTimeMs
perTurnMs  = min(cap, budgetMs)
declaredTurnOver = false
```

**On explicit declare-turn-over** (01-REQ-038):

```
budgetMs += perTurnMs      # credit unspent time back to the budget
perTurnMs = 0
declaredTurnOver = true
```

**On clock expiry** (01-REQ-039): automatically invoke the declare-turn-over sequence when real-time elapsed causes `perTurnMs` to reach zero; the credit-back is a no-op because `perTurnMs === 0`.

**Turn resolution trigger** (01-REQ-040): `resolveTurn(...)` is invoked when every team has `declaredTurnOver === true`.

Module 01 only specifies the *arithmetic* of the clock. The physical mechanism — how real-time elapsing mutates `perTurnMs` — is a module-04 concern. This is **DOWNSTREAM IMPACT** note 6.

### 2.10 Win Condition Evaluation

Implements 01-REQ-053 through 01-REQ-058. Phase 10 at the end of turn T:

```
aliveTeams = teams with ≥1 alive snake after Phase 9 of turn T
scores(t)  = sum of body.length over alive snakes in team t

if aliveTeams.length === 0:
  # Simultaneous elimination (01-REQ-055, 01-REQ-056)
  if T === 0:
    # Every snake began at length 3 (01-REQ-020). `initialSnakeCount(t)` is the
    # number of snakes team `t` had at game start, derived from the initial
    # GameState that STDB was initialized with; `snakesPerTeam` is an
    # orchestration-side parameter (GameOrchestrationConfig) and is not
    # retained at runtime. See resolved 01-REVIEW-017.
    initialScores(t) = 3 * initialSnakeCount(t)
    return winnerOrDraw(initialScores)
  else:
    return winnerOrDraw(previousTurnScores)

if aliveTeams.length === 1:
  return { kind: 'victory', winnerCentaurTeamId: aliveTeams[0], scores }  # 01-REQ-054

if config.maxTurns > 0 and T === config.maxTurns - 1:
  return winnerOrDraw(scores)                                      # 01-REQ-057

return { kind: 'in_progress' }                                     # 01-REQ-058 (no limit)
```

Where `winnerOrDraw(scoreMap)` returns `{kind: 'victory', ...}` if there is a unique maximum, else `{kind: 'draw', tiedCentaurTeamIds: [...]}`.

**Previous-turn scores**: before Phase 1 of every turn, the engine snapshots the current team scores (computed from alive snakes at start-of-turn, which equals end-of-previous-turn) into `previousTurnScores` for use by the simultaneous-elimination branch. Module 01 specifies the arithmetic; the storage location is a module-04 concern.

**Turn limit boundary**: `maxTurns` is the count of turns played, so the game ends at the end of turn `maxTurns - 1`. `maxTurns = 0` means no limit (01-REQ-058).

### 2.11 Turn Event Schema

Implements 01-REQ-052. Closed discriminated union:

```typescript
export type DeathCause =
  | 'wall' | 'self_collision' | 'body_collision' | 'head_to_head' | 'starvation' | 'hazard'

export type TurnEvent =
  | {
      readonly kind: 'snake_moved'
      readonly snakeId: SnakeId
      readonly from: Cell
      readonly to: Cell
      readonly direction: Direction
      readonly grew: boolean
      // null when no move was staged this turn — i.e. Phase 1 fell through
      // to `lastDirection` or, on turn 0, to the deterministic random pick.
      // Team attribution is not carried on the event because it is derivable
      // from `snakeId` via `SnakeState.centaurTeamId`.
      readonly stagedBy: Agent | null
    }
  | {
      readonly kind: 'snake_died'
      readonly snakeId: SnakeId
      readonly cause: DeathCause
      readonly killerSnakeId: SnakeId | null
      readonly location: Cell
    }
  | {
      readonly kind: 'snake_severed'
      readonly attackerSnakeId: SnakeId
      readonly victimSnakeId: SnakeId
      readonly contactCell: Cell
      readonly segmentsLost: number
    }
  | {
      readonly kind: 'food_eaten'
      readonly snakeId: SnakeId
      readonly cell: Cell
      readonly healthRestored: number
    }
  | {
      readonly kind: 'potion_collected'
      readonly snakeId: SnakeId
      readonly cell: Cell
      readonly potionType: ItemType.InvulnPotion | ItemType.InvisPotion
      readonly affectedTeammateIds: ReadonlyArray<SnakeId>
    }
  | {
      readonly kind: 'food_spawned'
      readonly itemId: ItemId
      readonly cell: Cell
    }
  | {
      readonly kind: 'potion_spawned'
      readonly itemId: ItemId
      readonly cell: Cell
      readonly potionType: ItemType.InvulnPotion | ItemType.InvisPotion
    }
  | {
      readonly kind: 'effect_applied'
      readonly snakeId: SnakeId
      readonly family: EffectFamily
      readonly state: EffectState
      readonly expiryTurn: TurnNumber
    }
  | {
      readonly kind: 'effect_cancelled'
      readonly snakeId: SnakeId
      readonly family: EffectFamily
      readonly reason: 'collector_disruption' | 'expiry' | 'replaced'
    }
```

**Ordering**: events are emitted in phase order (1 → 11), and within a phase in ascending `snakeId` order. This determinism lets replay viewers render without re-sorting.

**Scoping note**. Module 01 owns the *closed enumeration of event kinds and their payload shapes* because these trace directly from turn-resolution semantics (01-REQ-052). Module 04 owns the storage representation (append-only `turn_events` table, keyed by `(turn, eventIndex)`). Downstream modules that see a concrete identity type (most notably module 04's SpacetimeDB `Identity`) are responsible for mapping that identity to an `Agent` variant before passing staged moves into `resolveTurn`. See resolved **01-REVIEW-011**.

---

## Exported Interfaces

This section is the minimal contract module 01 exposes to downstream modules. Any type not listed here is a module-internal detail and may change without a version bump.

### 3.1 Enums and Branded Types

Motivated by 01-REQ-001, 01-REQ-002, 01-REQ-003, 01-REQ-005, 01-REQ-006.

```typescript
export const enum Direction { Up = 0, Right = 1, Down = 2, Left = 3 }
export const enum CellType  { Normal = 0, Wall = 1, Hazard = 2, Fertile = 3 }
export const enum ItemType  { Food = 0, InvulnPotion = 1, InvisPotion = 2 }
export const enum BoardSize { Small = 0, Medium = 1, Large = 2, Giant = 3 }

// 01-REQ-006. Potion effect taxonomy: two independent families, each with
// two states. At most one active effect per family per snake (01-REQ-028).
export type EffectFamily = 'invulnerability' | 'invisibility'
export type EffectState  = 'buff' | 'debuff'

export interface Cell { readonly x: number; readonly y: number }

export type SnakeId    = number & { readonly __brand: 'SnakeId' }
export type CentaurTeamId     = string & { readonly __brand: 'CentaurTeamId' }
export type ItemId     = number & { readonly __brand: 'ItemId' }
export type TurnNumber = number & { readonly __brand: 'TurnNumber' }
export type UserId    = string & { readonly __brand: 'UserId' }

// Agent: the actor that staged a move. Module 01 distinguishes two kinds —
// CentaurTeam (a Centaur Team's bot acting on the team's collective behalf,
// incorporating human and AI heuristics) and Operator (an individual human
// member of a Centaur Team, identified via Google OAuth).
// The `CentaurTeamId` and `UserId` id spaces are disjoint and opaque to
// module 01; the mapping from a concrete deployment identity (e.g. module
// 04's SpacetimeDB `Identity`) to an `Agent` is owned by the downstream
// module that has visibility into that identity namespace.
export type Agent =
  | { readonly kind: 'centaur_team'; readonly centaurTeamId: CentaurTeamId }
  | { readonly kind: 'operator';    readonly operatorUserId: UserId }

export const BOARD_DIMENSIONS: Readonly<Record<BoardSize, { total: number; playable: number }>>

// Derived values over `SnakeState.activeEffects`. Defined per 01-REQ-022
// and 01-REQ-023. These are pure functions with no side effects and no
// cached state; call-site cost is O(k) with k ≤ 2 per 01-REQ-028.
export function invulnerabilityLevel(snake: SnakeState): -1 | 0 | 1
export function isVisible(snake: SnakeState): boolean
```

### 3.2 State Shapes

Motivated by 01-REQ-004, 01-REQ-007, 01-REQ-008–009, 01-REQ-022, 01-REQ-023, 01-REQ-031.

```typescript
// 01-REQ-006. Potion effect held on SnakeState. At most one active per family.
export interface PotionEffect {
  readonly family:     EffectFamily
  readonly state:      EffectState
  readonly expiryTurn: TurnNumber
}

export interface SnakeState {
  readonly snakeId: SnakeId
  readonly letter: string
  readonly centaurTeamId: CentaurTeamId
  readonly body: ReadonlyArray<Cell>
  readonly health: number
  readonly activeEffects:  ReadonlyArray<PotionEffect>   // ≤1 per family
  readonly pendingEffects: ReadonlyArray<PotionEffect>   // ≤1 per family
  readonly lastDirection: Direction | null
  readonly alive: boolean
  readonly ateLastTurn: boolean
  // `invulnerabilityLevel` and `visible` are NOT fields. Derive via
  // `invulnerabilityLevel(snake)` and `isVisible(snake)` from Section 3.1.
}

export interface ItemState {
  readonly itemId: ItemId
  readonly itemType: ItemType
  readonly cell: Cell
  readonly consumed: boolean
}

export interface Board {
  readonly size: BoardSize
  readonly width: number
  readonly height: number
  readonly cells: ReadonlyArray<CellType>
}

export interface CentaurTeamClockState {
  readonly centaurTeamId: CentaurTeamId
  readonly budgetMs: number
  readonly perTurnMs: number
  readonly declaredTurnOver: boolean
}
```

### 3.3 Game Configuration

Motivated by 01-REQ-003, 01-REQ-010, 01-REQ-013, 01-REQ-019, 01-REQ-034–040, 01-REQ-046b, 01-REQ-048, 01-REQ-049, 01-REQ-057, 01-REQ-063–077. Numeric ranges are pinned by canonical range requirements 01-REQ-063–077 (see resolved **01-REVIEW-012**) drawing from the informal spec's §9.3 game configuration table. The split between `GameOrchestrationConfig` and `GameRuntimeConfig` traces the boundary between fields consumed only on the platform side (board generation and lifecycle orchestration) and fields consumed by the per-turn engine (see resolved **01-REVIEW-017**).

```typescript
export interface GameOrchestrationConfig {
  readonly boardSize: BoardSize                  // 01-REQ-003, 01-REQ-063
  readonly snakesPerTeam: number                 // 1–10, default 5, 01-REQ-019, 01-REQ-064
  readonly hazardPercentage: number              // 0–30, default 0, 01-REQ-010, 01-REQ-067
  readonly fertileGround: {
    readonly density: number                     // 0–90, default 30, 01-REQ-013, 01-REQ-069
                                                 //   (0 = no fertile cells generated)
    readonly clustering: number                  // 1–20, default 10, 01-REQ-013, 01-REQ-070
  }
}

export interface GameRuntimeConfig {
  readonly maxHealth: number                     // 1–500, default 100, 01-REQ-065
  readonly maxTurns: number                      // 0 (disabled) or 1–1000, default 100, 01-REQ-058, 01-REQ-066
  readonly hazardDamage: number                  // 1–100, default 15, 01-REQ-046b, 01-REQ-068
  readonly foodSpawnRate: number                 // 0–5, default 0.5, 01-REQ-048, 01-REQ-071
  readonly invulnPotionSpawnRate: number         // 0–0.2, default 0.15, 01-REQ-049, 01-REQ-072
                                                 //   (0 = no invuln potions ever spawn)
  readonly invisPotionSpawnRate: number          // 0–0.2, default 0.1, 01-REQ-049, 01-REQ-073
                                                 //   (0 = no invis potions ever spawn)
  readonly clock: {
    readonly initialBudgetMs: number             // 0–600000, default 60000, 01-REQ-035, 01-REQ-074
    readonly budgetIncrementMs: number           // 100–5000, default 500, 01-REQ-036, 01-REQ-075
    readonly firstTurnTimeMs: number             // 1000–300000, default 60000, 01-REQ-037, 01-REQ-076
    readonly maxTurnTimeMs: number               // 100–300000, default 10000, 01-REQ-037, 01-REQ-077
  }
}

export interface GameConfig {
  readonly orchestration: GameOrchestrationConfig
  readonly runtime: GameRuntimeConfig
}
```

**Schema-mirroring constraints**. The three types above are the canonical TypeScript schema. To make the same shape declarable in both SpacetimeDB (`@type` classes mirroring each interface) and Convex (`v.object({…})` validators with `Infer<typeof v> ≡ GameConfig`) without translation, the following constraints hold throughout: every numeric field is `number` (no `bigint`/`Int64`); no field is `null` or absent in value position (sentinels — `maxTurns: 0`, `fertileGround.density: 0`, `foodSpawnRate: 0`, `invulnPotionSpawnRate: 0`, `invisPotionSpawnRate: 0` — encode "disabled"); enums are string-literal unions (`BoardSize`); time values are milliseconds; nested object grouping carries semantic meaning rather than syntactic optionality (e.g., `fertileGround` bundles the two board-gen knobs that parameterise one feature; `clock` bundles the four chess-timer knobs). See resolved **01-REVIEW-017**.

### 3.4 Game Outcome

Motivated by 01-REQ-051, 01-REQ-053–058.

```typescript
export type GameOutcome =
  | { readonly kind: 'in_progress' }
  | {
      readonly kind: 'victory'
      readonly winnerCentaurTeamId: CentaurTeamId
      readonly scores: ReadonlyMap<CentaurTeamId, number>
    }
  | {
      readonly kind: 'draw'
      readonly tiedCentaurTeamIds: ReadonlyArray<CentaurTeamId>
      readonly scores: ReadonlyMap<CentaurTeamId, number>
    }
  | {
      readonly kind: 'error'
      readonly reason: string
    }
```

### 3.5 Turn Event Schema

Motivated by 01-REQ-052. Full type as defined in Section 2.11 (`TurnEvent`, `DeathCause`).

### 3.6 Board Generation Failure

Motivated by 01-REQ-061.

```typescript
export interface BoardGenerationFailure {
  readonly code: 'HAZARD_CONNECTIVITY' | 'TERRITORY_PARITY_SHORTAGE' | 'INITIAL_FOOD_SHORTAGE'
  readonly attemptsUsed: 4
  readonly details: {
    readonly centaurTeamId?: CentaurTeamId
    readonly innerCellCount: number
    readonly eligibleCellCount?: number
  }
}
```

### 3.7 Randomness Primitives

Motivated by 01-REQ-059, 01-REQ-060, 01-REQ-061.

```typescript
export interface Rng {
  nextU32(): number
  nextFloat(): number
  nextIntExclusive(maxExclusive: number): number
  pick<T>(items: ReadonlyArray<T>): T
  shuffle<T>(items: T[]): void
}

export function rngFromSeed(seed: Uint8Array): Rng
export function subSeed(parent: Uint8Array, tag: string): Uint8Array
```

### 3.8 Entry Points

Motivated by 01-REQ-010–017 + 01-REQ-061 (board gen) and 01-REQ-041–052 + 01-REQ-062 (turn resolution).

```typescript
export function generateBoardAndInitialState(
  config: GameOrchestrationConfig,
  teams: ReadonlyArray<{ readonly centaurTeamId: CentaurTeamId; readonly name: string }>,
  gameSeed: Uint8Array,
): { readonly board: Board; readonly snakes: ReadonlyArray<SnakeState>;
     readonly items: ReadonlyArray<ItemState> }
  | BoardGenerationFailure

export interface StagedMove {
  readonly direction: Direction
  readonly stagedBy: Agent   // never null on input; absence is represented by
                             // omitting the entry from the `stagedMoves` map
}

export function resolveTurn(
  state: GameState,
  stagedMoves: ReadonlyMap<SnakeId, StagedMove>,
  turnNumber: TurnNumber,
  turnSeed: Uint8Array,
): {
  readonly nextState: GameState
  readonly events: ReadonlyArray<TurnEvent>
  readonly outcome: GameOutcome
}

```

```typescript
export interface GameState {
  readonly board: Board
  readonly snakes: ReadonlyArray<SnakeState>
  readonly items: ReadonlyArray<ItemState>
  readonly clocks: ReadonlyArray<CentaurTeamClockState>
}
```

`GameState` is the concrete aggregate of the four game-state components. It is the input and output type for `resolveTurn` and is exported so that downstream modules (especially Module 04) use a single canonical shape rather than defining their own aggregates independently. See resolved **01-REVIEW-013**.

### 3.9 Invariants and Constants

- Wall border is exactly 1 cell thick on every side (01-REQ-008).
- Playable area dimensions per `BoardSize` are fixed by `BOARD_DIMENSIONS` (01-REQ-003).
- Snake starting length is exactly 3 segments, all stacked on the starting cell (01-REQ-020).
- `PotionEffect.expiryTurn` is the last turn on which the effect is active; Phase 9 removes when `currentTurn >= expiryTurn` (resolved 01-REVIEW-003).
- A snake holds at most one active and at most one pending effect per family (01-REQ-028, 01-REQ-047). Stacking is not supported.
- `invulnerabilityLevel(snake) ∈ {-1, 0, +1}` and `isVisible(snake)` are pure O(k≤2) functions over `activeEffects`; they are the only reads collision resolution performs (01-REQ-022, 01-REQ-023, 01-REQ-044c, 01-REQ-044d).
- Disruption of a debuff-holder cancels that family team-wide; other families are untouched (01-REQ-031). Both debuff-holders (invulnerability and invisibility) remain visible — the invisibility-family debuff-holder is explicitly visible to opponents as the targetable weak link for their team's invisibility buff.
- Turn event ordering within a turn is deterministic: phase ascending, then `snakeId` ascending.
- `fertileGroundEnabled(board)` is the canonical runtime predicate for whether Phase 7 food eligibility restricts to `CellType.Fertile` cells (01-REQ-048). The predicate is derived from the board — not the game config — because `config.orchestration.fertileGround` is not forwarded to STDB; the board's cells are the authoritative record (resolved 01-REVIEW-017). The value is constant for the lifetime of the game since the board is static after generation.

### 3.10 DOWNSTREAM IMPACT Notes

1. **Event schema is closed.** Modules 04, 08, 09 can rely on the nine `TurnEvent` kinds being exhaustive. Adding a new kind requires a coordinated change across every consumer and a module-01 version bump.

2. **Effect schema is `PotionEffect { family, state, expiryTurn }`, no source attribution.** Module 04's schema must carry exactly these three fields. Adding back per-stack attribution would require reintroducing stacking. See resolved 01-REVIEW-010 and 01-REVIEW-015.

3. **Board cell encoding is specified, not delegated.** Flat `ReadonlyArray<CellType>` with `y * width + x` indexing is fixed here so that the shared engine codebase (per module 02's principles) is binary-compatible across SpacetimeDB, Convex, and the web clients. Downstream modules must not redefine this.

4. **Sub-seed derivation uses BLAKE3 keyed hashing specifically.** Any consumer of `subSeed()` must import the same BLAKE3 implementation; switching hash algorithms breaks replay reproducibility. This is a hard dependency, not a "pick your favourite hash" situation.

5. **Chess timer arithmetic is specified at the game-rules level** (Section 2.9). Module 04's reducer implementations must match the formulas exactly — in particular the "credit unspent clock back to budget on early declare" step, which is easy to miss.

6. **Turn event ordering is deterministic.** Replay viewers (08, 09) can assume events arrive in phase-then-snakeId order and need not re-sort.

7. **Phase 4 is a no-op mutation phase.** Downstream event consumers should not expect any state changes in Phase 4 beyond the disruption buffer accumulation that already happened in Phase 3. Event emission in Phase 11 can skip Phase 4 entirely.

8. **`GameState` aggregate shape is exported** (see resolved 01-REVIEW-013). The canonical shape is `{ board: Board, snakes: ReadonlyArray<SnakeState>, items: ReadonlyArray<ItemState>, clocks: ReadonlyArray<CentaurTeamClockState> }`. Module 04 must assemble this shape from its SpacetimeDB tables when calling `resolveTurn` and must destructure it from the result. Module 07 may continue to consume components individually through its simulation layer but should reference the exported `GameState` type for structural alignment.

9. **Effect-state immutability is a structural invariant, not a snapshot.** 01-REQ-033 is satisfied by the ordering discipline described in Section 2.7: no code path between start-of-turn and Phase 9 writes to `snake.activeEffects`. Because `invulnerabilityLevel(snake)` and `isVisible(snake)` are pure functions over `activeEffects`, they inherit the invariant automatically. Any future phase that needs to mutate effect state mid-turn must either (a) be placed at or after Phase 9, or (b) reintroduce an explicit snapshot taken at the start of Phase 1 and reroute pre-mutation reads through it. Downstream modules that implement `resolveTurn` must preserve this invariant verbatim; violating it silently breaks disruption cancellation semantics.

---

## REVIEW Items

### 01-REVIEW-001: Phase 4 invuln-debuff cancellation rule redundancy — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
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
**Phase**: Requirements
**Context**: Phase 3 evaluates all collisions simultaneously after Phase 2 movement. A snake dying from a wall collision or self-collision still has body segments at their Phase-2 positions at the moment of evaluation. The spec did not originally state whether another snake's head colliding with those segments in the same Phase 3 pass constitutes a valid body collision (01-REQ-044c).
**Question**: Do body segments of snakes that are simultaneously dying in Phase 3 from wall or self-collision count as valid collision targets for other snakes in the same Phase 3 evaluation?
**Options**:
- A: Yes — all body segments are present during the simultaneous Phase 3 evaluation regardless of what else is killing their owner.
- B: No — wall/self-collision deaths remove the snake from body-collision consideration before other snakes' collisions are checked (implying a sub-ordering within Phase 3).
**Informal spec reference**: Section 5, Phase 3.

**Decision**: Option A.
**Rationale**: "Simultaneously" admits no sub-ordering. Introducing an implicit ordering (wall/self deaths applied first) would contradict the plain reading and create a hidden precedence that needs its own justification. 01-REQ-044 now explicitly states the simultaneity semantics so a future reader can't unintentionally reintroduce the sub-ordering.
**Clarifying example (to carry into Phase 2 design)**: Snake A moves into a Wall cell in Phase 2; Snake A dies (01-REQ-044a). Simultaneously, Snake B's head moves into a non-head body segment of Snake A. Because Phase 3 is evaluated against the single post-Phase-2 board state, Snake B experiences a body collision against Snake A's body per 01-REQ-044c, resolved using `invulnerabilityLevel(B)` and `invulnerabilityLevel(A)` computed from their start-of-turn `activeEffects`. If B's level > A's level, B severs A's tail-ward segments (irrelevant to A since A is already dying) and B survives; otherwise B also dies. A's wall death is not a precondition that prevents B's body-collision outcome.
**Affected requirements**: 01-REQ-044 (added explicit simultaneity clarification).

---

### 01-REVIEW-003: Effect duration semantics (`expiryTurn` interpretation) — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
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
**Phase**: Requirements
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
**Phase**: Requirements
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
**Phase**: Requirements
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
**Phase**: Requirements
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
**Phase**: Requirements
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
**Phase**: Requirements
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

---

### 01-REVIEW-010: Effect-source tracking via `sourceCollectorSnakeId` — **RESOLVED**

**Type**: Proposed Addition
**Phase**: Design
**Context**: Writing the Phase 9 cancellation design (Section 2.7 / 2.8) revealed that 01-REQ-031's "cancel this collector's contribution to teammates" can only be implemented if each `EffectInstance` on a teammate records which collector produced it. Consider a team with two active collectors X and Y, each having collected an InvulnPotion on different turns. Their teammate Z holds two `invuln_buff` stacks, one from X and one from Y. If X suffers a disruption, 01-REQ-031 says X's contributions to Z should be cancelled but Y's should persist. Without an origin field on `EffectInstance`, Z's two buffs are indistinguishable and the rule is unimplementable.
**Question**: Is adding a `sourceCollectorSnakeId: SnakeId` field to `EffectInstance` the right way to support 01-REQ-031, or is there a semantic preference for a different approach?
**Options**:
- A: Add `sourceCollectorSnakeId` to `EffectInstance`. Minimal change, directly encodes the provenance needed.
- B: Store collector→effect backlinks in a separate auxiliary structure keyed by `(collectorId, effectType) → Set<(affectedSnakeId, effectInstanceRef)>`. Decouples `EffectInstance` from provenance but adds a second data structure to maintain in lock-step with the main one.
- C: Revise 01-REQ-031 to cancel *every* matching effect on teammates regardless of source (a simpler but strictly stronger rule — disruption to collector X would also strip Y's contributions to teammates, which feels wrong thematically and strategically).

**Decision**: None of A/B/C as originally posed. The question is resolved by a deeper change introduced in 01-REVIEW-015: **stacking is removed entirely** in favour of a symmetric per-family buff/debuff state model. Under the new model a team holds at most one coherent invulnerability-family rebuild and at most one coherent invisibility-family rebuild at any time, so multi-collector attribution is moot — there is only ever one "owner" of a family's active state, namely whichever snake currently holds the family's `debuff`. Disruption of that debuff-holder cancels the family team-wide without needing to discriminate among contributions. Option C was originally rejected as thematically wrong under stacking; under the non-stacking model it becomes structurally trivial (there is only ever one "contribution" per family), not a dilution.

**Rationale**: The original framing assumed stacking was a fixed premise and asked how cancellation attribution should be plumbed through it. Dropping the stacking premise — the deeper change 01-REVIEW-015 resolves — eliminates the attribution question instead of answering it. Removing `sourceCollectorSnakeId` from `PotionEffect` simplifies the schema and removes a load-bearing coupling between Module 01 and Module 04's storage layer.

**Scope of change**: `EffectInstance` renamed to `PotionEffect` with shape `{family, state, expiryTurn}`; no source field. `EffectInstance` type removed from exports. `DOWNSTREAM IMPACT` note 2 rewritten accordingly. 01-REQ-031 now specifies team-wide, family-scoped cancellation triggered by the disruption of a debuff-holder.

**Revisit if**: a future rule reintroduces stacking within a family (e.g. multiple invulnerability buffs of different durations on the same snake). At that point per-contribution attribution becomes necessary again.

**Affected requirements**: 01-REQ-031 (rewritten under 01-REVIEW-015).

---

### 01-REVIEW-011: `snake_moved` stager attribution — module-01-local `Agent` type — **RESOLVED**

**Type**: Contradiction
**Phase**: Design
**Context**: Informal spec §14 defines `snake_moved: {snakeId, from, to, direction, grew: bool, stagedBy: Identity}` where `Identity` is the cross-module identity type (module-03 concept covering human users, Centaur Servers, and game participants). Module 01 must not reference module-03 types (Rule 2: 01 has no dependencies). This design uses `stagedByCentaurTeamId: CentaurTeamId | null` instead, on the reasoning that (a) module 01 can't reference `Identity`, and (b) what downstream animation/replay actually needs is team attribution (to display "Red.C moved by Red team's bot"), not the full human-or-server identity chain.
**Question**: Is team-level attribution sufficient for `snake_moved`, or does a downstream consumer (likely module 08's team replay viewer, per informal spec §13.3) need the full `Identity` for features like "show which operator staged this move"?
**Options**:
- A: Keep `stagedByCentaurTeamId: CentaurTeamId | null` in module 01. If module 08 needs operator-level attribution, it reconstructs it from the Centaur action log (module 06) joined on turn/snake — which is the mechanism the informal spec already describes for sub-turn replay.
- B: Define a second event schema layer in module 04 that wraps module 01's `TurnEvent` and enriches `snake_moved` with a module-03 `Identity`. Module 01's schema stays identity-free.
- C: Move `TurnEvent` ownership out of module 01 entirely and into module 04. Module 01 would only enumerate the *names* of event types in 01-REQ-052; the schemas would live where `Identity` is reachable.
**Informal spec reference**: §14, §13.3.

**Decision**: None of A/B/C as originally posed — a new option (D) was introduced and chosen. Module 01 defines a local `Agent` concept that abstracts over the two kinds of actor that can stage a move in this project: a **Centaur Team** (a Centaur Team's bot acting on the team's collective behalf, incorporating human and AI heuristics) and an **Operator** (an individual human member of a Centaur Team, identified via Google OAuth). These represent different granularities of agency attribution: a Centaur Team-level move is the product of the team's collective intelligence pipeline, while an operator-level move is uniquely attributed to that individual sub-agent of the team. `Agent` is a discriminated union over `{kind: 'centaur_team', centaurTeamId: CentaurTeamId}` and `{kind: 'operator', operatorUserId: UserId}`, with `CentaurTeamId` and `UserId` as opaque branded types owned by module 01. Both are string-based: `CentaurTeamId = string & { readonly __brand: 'CentaurTeamId' }` and `UserId = string & { readonly __brand: 'UserId' }`, reflecting that the concrete values are Convex record `_id`s (see resolved 03-REVIEW-011). The `snake_moved` event carries `stagedBy: Agent | null` (null only when Phase 1 fell through to `lastDirection` or the turn-0 random pick). `resolveTurn`'s `stagedMoves` input is correspondingly retyped from `ReadonlyMap<SnakeId, Direction>` to `ReadonlyMap<SnakeId, StagedMove>` where `StagedMove = {direction, stagedBy}`. Downstream modules that see a concrete identity type (module 04's SpacetimeDB `Identity`, in particular) are responsible for mapping that identity onto an `Agent` variant before calling `resolveTurn` — module 01 never interprets the ids, it just threads them through into the event.

**Rationale for rejecting the originally-posed options**:

- Option A (keep `stagedByCentaurTeamId`) was doubly wrong. First, it is *redundant*: `SnakeState.centaurTeamId` already maps `snakeId → centaurTeamId`, so given any `snake_moved.snakeId` the team is derivable by lookup and needn't be carried on the event. The only non-redundant bit in the original encoding was "was any move staged at all vs. engine fallback", which the `null` sentinel bundled in as a side effect rather than as a deliberate design choice. Second, it does not satisfy 01-REQ-052, which was written post-hoc and explicitly lists "identity of who staged the move" as part of the closed event set. Team identity is not the same concept as operator/centaur identity.

- Options B and C both treat module 01 as if it cannot speak about staged-move attribution at all, and offload the concept to module 04. This is an over-reading of the "module 01 has no dependencies" rule. The rule prohibits module 01 from *depending on* module 03's `Identity`; it does not prohibit module 01 from defining its own local concept of "who staged this move" with its own id types that other modules later map into. Keeping `TurnEvent` schema ownership in module 01 (per the existing design stance) while introducing a module-01-local `Agent` type is strictly cleaner than either wrapper layer (B) or schema-ownership relocation (C).

The framing of the original question ("is team-level attribution sufficient?") was also wrong — it sidestepped the fact that 01-REQ-052's "identity of who staged the move" clause already answered it. A better framing would have been "module 01 needs to emit operator-or-centaur attribution on `snake_moved`, but cannot reference module 03's `Identity`; what is the minimum module-01-local vocabulary that lets it do so?" Option D is the answer to that question.

**Scope of change**:

- **Section 3.1 (Enums and Branded Types)**: `CentaurTeamId` is now a string-branded type (the Convex `centaur_teams._id`); `UserId` is a string-branded type (values are Convex record `_id`s per resolved 03-REVIEW-011); the `Agent` discriminated union uses `centaurTeamId: CentaurTeamId`.
- **Section 2.11 (Turn Event Schema)**: `snake_moved.stagedBy: Agent | null` carries the full agent attribution; inline comment explains that team attribution is derivable from `snakeId` and so is not duplicated on the event.
- **Section 2.11 scoping note**: rewritten to describe the Agent-based resolution instead of the original CentaurTeamId fallback.
- **Section 3.8 (Entry Points)**: `resolveTurn`'s `stagedMoves` parameter retyped from `ReadonlyMap<SnakeId, Direction>` to `ReadonlyMap<SnakeId, StagedMove>`, with `StagedMove = {direction, stagedBy: Agent}` added as an exported interface.
- **Section 2.8 (Turn Resolution Pipeline) — Phase 1 pseudocode**: each `moves[snakeId]` entry now carries `{direction, stagedBy}` where `stagedBy` is `null` in the lastDirection and turn-0 random fallback branches. Phase 2 reads `moves[snakeId].direction`; Phase 11's emission of `snake_moved` reads `moves[snakeId].stagedBy`.

**Downstream impact**: Module 04's deployment-time mapping `Identity → Agent` is now a hard dependency. Its implementation must cover both kinds: Google-authenticated users map to `{kind: 'operator', operatorUserId}`, and Centaur Team bot connections map to `{kind: 'centaur_team', centaurTeamId}`. The id-space discipline (disjoint `CentaurTeamId` and `UserId` spaces) is owned by whichever module populates the mapping — module 01 does not enforce it.

**Revisit if**: the platform introduces a third class of staging actor (e.g. an external API bot that is neither a Centaur Server nor an authenticated human). The `Agent` union would then need a third variant, which is a module-01 version bump.

**Affected requirements**: 01-REQ-052 (now satisfied: "identity of who staged the move" maps to the `stagedBy: Agent | null` field on `snake_moved`). No requirement text change required.

---

### 01-REVIEW-012: Game configuration parameter ranges — **RESOLVED**

**Type**: Gap
**Phase**: Design
**Context**: Several parameters in `GameConfig` (Section 3.3) have ranges stated in the informal spec's §9.3 table and also in individual requirements (e.g., `snakesPerTeam` 1–10 in 01-REQ-019, `hazardPercentage` 0–30 in §9.3). Others are implied but not stated in requirements: `maxHealth` default 100 appears in §9.3 but no requirement pins the range (the draft uses ≥1); `budgetIncrementMs` range 100–5000 appears in §9.3 but no requirement states it. `initialBudgetMs` is listed as "≥0 seconds" in §9.3 but no requirement commits to a range.
**Question**: Should module 01's requirements section be extended with explicit range-setting requirements for every configuration parameter, so that the ranges are part of the requirements contract rather than exclusively derived from the informal spec's table?
**Options**:
- A: Add requirements 01-REQ-063+ pinning the canonical ranges. Strictest interpretation of "requirements state the contract", and protects against informal spec drift.
- B: Leave the ranges as design-phase specification (already captured in Section 3.3 as comments). Accept that the informal spec's §9.3 table is the source of truth for parameter ranges and that module 01's requirements only constrain ranges where they materially affect game rules (e.g., 01-REQ-019's 1–10 for snakesPerTeam is a game rule, but 100–5000 for budgetIncrementMs is an input-validation concern that legitimately belongs elsewhere).
- C: Extract a separate "Configuration" sub-module whose requirements are the ranges. Too heavyweight for what is really a parameter table.
**Informal spec reference**: §9.3.

**Decision**: Option A. New requirements 01-REQ-063 through 01-REQ-077 pin canonical ranges and defaults for every `GameConfig` parameter, grouped in Section 1.11. Ranges are drawn from the informal spec §9.3 table where present; where §9.3 is open-ended (e.g., `maxHealth ≥ 1`, `initialBudgetMs ≥ 0`), upper bounds are proposed to prevent degenerate configurations (500 for `maxHealth`, 600000 for `initialBudgetMs`, 1000 for `maxTurns`). The `maxTurnTimeMs` lower bound is set to 100ms (below §9.3's 1s) to support blitz-style play. The `snakesPerTeam` default is set to 5 (the task-specified default; informal spec §9.3 shows 3).
**Rationale**: Making ranges part of the requirements contract rather than leaving them as design-phase comments protects against informal spec drift and ensures downstream modules (especially Module 04's `DynamicGameplayParams` validation and Module 05's game configuration UI) have a single authoritative source for validation rules. Option B was rejected because dispersed range comments in Section 3.3 are easy to miss and hard to enforce across modules. Option C was rejected as too heavyweight for a parameter table.
**Affected requirements/design elements**: 01-REQ-063–077 (new, Section 1.11), GameConfig interface comments (Section 3.3 updated to reference new requirement IDs).

---

### 01-REVIEW-013: `GameState` aggregate shape not exported — **RESOLVED**

**Type**: Proposed Addition
**Phase**: Design
**Context**: The `resolveTurn` entry point in Section 3.8 takes and returns a `GameState` type, but `GameState`'s aggregate shape is not exported — the design notes that consumers interact with its components (`Board`, `SnakeState[]`, `ItemState[]`, `CentaurTeamClockState[]`) individually. Module 04 (stdb-engine) is the most likely consumer of the aggregate since it needs to serialise state to SpacetimeDB tables. If module 04 defines its own aggregate independently, there is a risk of drift between "module 01's notion of game state" and "module 04's notion of game state" especially as new fields are added.
**Question**: Should `GameState` be an exported aggregate type (either as a plain interface or as a constructor function), or should the "components only" approach persist with module 04 building its own aggregate?
**Options**:
- A: Export `GameState` as a concrete `interface GameState` with readonly fields for each component. Binds module 04 to a specific aggregate shape but eliminates drift risk.
- B: Keep the current "components only" stance. Module 04 builds its own aggregate as it sees fit, possibly different across different deployment contexts. Requires discipline.
- C: Export `GameState` as an opaque type alias with constructor/accessor functions only. Hides the shape but prevents module 04 from adding its own fields without an explicit module-01 change.
**Informal spec reference**: None directly. This is an engineering-scope decision that surfaced during Phase 2 design.

**Decision**: Option A. A concrete `interface GameState` with four readonly fields (`board: Board`, `snakes: ReadonlyArray<SnakeState>`, `items: ReadonlyArray<ItemState>`, `clocks: ReadonlyArray<CentaurTeamClockState>`) is now exported in Section 3.8. DOWNSTREAM IMPACT note 8 is updated to reflect the exported shape.
**Rationale**: Module 04 already assembles `{ board, snakes, items, clocks }` in its `resolve_turn` reducer (§2.7, line ~678) with exactly these four field names and compatible types. Exporting the shape eliminates drift risk — if Module 01 adds a fifth component (e.g., `config`), Module 04 gets a compile-time error rather than a silent divergence. Option B was rejected because it places the burden of alignment on discipline rather than the type system, and Module 04's current assembly already matches the proposed shape so binding it costs nothing. Option C was rejected because the shape is simple (four readonly fields) and opaqueness adds indirection without benefit.
**Affected requirements/design elements**: Section 3.8 (GameState interface added), DOWNSTREAM IMPACT note 8 (updated from "not exported" to "now exported").

---

### 01-REVIEW-014: "Frozen effect state" wording implied an unneeded data structure — **RESOLVED**

**Type**: Ambiguity / Wording
**Phase**: Design
**Context**: Phase 1 requirements 01-REQ-033, 01-REQ-044, 01-REQ-044c, 01-REQ-044d, and 01-REQ-045 were originally written using "frozen" language — "all effect states shall be frozen at the start of each turn's resolution", "resolved using frozen invulnerabilityLevels", etc. This phrasing naturally suggested a concrete snapshot data structure, and Phase 2's first draft followed that lead by introducing a `FrozenEffectState` interface and a `snapshotFrozenEffects()` entry point, threading `frozen[snakeId]` reads through the collision and cancellation pseudocode. On audit during Phase 2 review, no phase between start-of-turn and Phase 9 actually writes `activeEffects`, `invulnerabilityLevel`, or `visible` — Phase 6 writes only `pendingEffects`, which is a separate list that no read consults. That meant the snapshot held a copy of data that equalled the live fields at every read site, making `FrozenEffectState` a structure whose only job was to duplicate unchanged data.
**Question**: Can the semantic intent of 01-REQ-033 (start-of-turn values determine the turn's collision and disruption outcomes) be preserved while removing the implication that a snapshot data structure is required?
**Options**:
- A: Keep the "frozen" wording and the snapshot structure. Cleanest one-to-one mapping from requirement language to design artifact, at the cost of an unused-in-practice type and a pseudocode idiom (`frozen[id].field`) that obscures the fact that the live field would read the same value.
- B: Rewrite the requirement wording to speak of "start-of-turn values" and explicitly permit either a snapshot or an ordering-discipline implementation. Remove `FrozenEffectState` / `snapshotFrozenEffects` from the exported interface and satisfy 01-REQ-033 structurally, via an invariant that no Phase 1–8 code writes the fields. Add a `DOWNSTREAM IMPACT` note warning that any future mid-turn mutation of these fields requires either placing the mutation at/after Phase 9 or reintroducing an explicit snapshot.
- C: Keep the requirement wording as-is ("frozen") and satisfy it structurally in the design, leaving a vocabulary mismatch between requirements and design.

**Decision**: Option B.
**Rationale**: The snapshot is mechanism, not semantics. What 01-REQ-033 actually cares about is the *observable behaviour* — that within-turn effect mutations can't influence the same turn's collision and disruption outcomes — and that behaviour can be guaranteed either by taking a snapshot or by ordering the pipeline so no Phase 1–8 code writes the fields. The ordering discipline is cheaper at runtime (no allocation, no copy) and, arguably, easier to audit: a reviewer can confirm the invariant by grepping for writes to the three fields across Phases 1–8, whereas a snapshot-based design requires trusting that every read site goes through the snapshot. Option C was rejected because keeping "frozen" language in the requirements while the design no longer has a frozen-anything artifact creates exactly the kind of vocabulary drift that later readers stumble on. Option A was rejected because the snapshot adds no behavioural content — it would be dead weight preserved only for symmetry with the original wording.

The rewritten 01-REQ-033 explicitly allows either implementation approach ("This requirement is satisfied whether by an explicit start-of-turn snapshot or by an ordering discipline that defers all in-turn mutation of these fields until Phase 9; Module 01's design may choose either."). This keeps the requirement future-proof against a scenario where some later phase legitimately needs to mutate effect state mid-turn and the snapshot approach becomes the right implementation.

**Scope of change**:
- **Requirement wording** (Phase 1, edited in place): 01-REQ-033, 01-REQ-044, 01-REQ-044c, 01-REQ-044d, 01-REQ-045 now use "start-of-turn value" language and cross-reference 01-REQ-033 as the shared semantic anchor. No behavioural change — the rewording is equivalent in observable outcomes.
- **Design** (Phase 2): Section 2.7 reframed as a structural invariant with a "correctness-critical invariant" block; Section 2.8 pseudocode reads `snake.invulnerabilityLevel` / `snake.activeEffects` directly instead of `frozen[snakeId].*`; Phase 9 ordering rationale updated to justify cancel-before-promote in terms of preserving the invariant rather than a snapshot.
- **Exported interfaces** (Phase 2): `FrozenEffectState` interface and `snapshotFrozenEffects` function export removed from Section 3.2 and Section 3.8 respectively.
- **Downstream impact**: New `DOWNSTREAM IMPACT` note 9 in Section 3.10 documents the invariant and the two allowed escape hatches for future code that wants to mutate effect state mid-turn.

**Revisit if**: a future requirement introduces a phase between Phase 1 and Phase 9 that legitimately needs to mutate `activeEffects`, `invulnerabilityLevel`, or `visible` mid-turn. At that point the ordering-discipline implementation breaks and an explicit start-of-turn snapshot must be reintroduced at Phase 1, with all pre-mutation reads rerouted through it. 01-REQ-033's wording already permits this without a requirement amendment.

**Affected requirements**: 01-REQ-033, 01-REQ-044, 01-REQ-044c, 01-REQ-044d, 01-REQ-045 (wording only; no behavioural change).

### 01-REVIEW-015: Potion-effect stacking removed; symmetric buff/debuff state model adopted — **RESOLVED**

**Type**: Design / Semantics
**Phase**: Design
**Context**: Earlier drafts (Phase 1 through most of Phase 2) modelled potion effects as an unbounded per-snake collection that could stack within a family: a snake could simultaneously carry multiple invulnerability or invisibility effect instances, each with its own expiry and provenance, and each collection of the same potion by a teammate layered additional instances onto the whole team. This created three follow-on problems: (1) cancellation semantics under 01-REQ-031 needed per-instance attribution (the `sourceCollectorSnakeId` field that 01-REVIEW-010 was originally framed around), (2) the invulnerability level and visibility predicates needed reducer semantics over the collection (max? any? sum clamped?) that were never cleanly specified, and (3) the debuff "collector" role was encoded asymmetrically across the two families — invulnerability had a full buff/debuff pair (the collector received `invuln_debuff`, teammates received `invuln_buff`), but invisibility used a distinct `invis_collector` marker type separate from the `invis_buff` teammates received. The asymmetry meant that a single unified effect state machine couldn't be written over both families, and every rule touching effects had to case-split on family. The user flagged all three problems in one directive and asked for a redesign that removes stacking entirely, unifies the two families behind a symmetric buff/debuff state model, and replaces per-family flat slot fields with a single collection-of-effects schema whose members carry `{family, state, expiryTurn}`.
**Question**: What effect model best satisfies the combined constraints of (a) no stacking within a family, (b) symmetric treatment of invulnerability and invisibility, (c) clean cancellation semantics, (d) minimal schema footprint, and (e) preservation of the intended team-wide debuff-holder role where disrupting the collector cancels the team's buff?
**Options**:
- A: Keep the collection-of-effects schema but retain stacking, disambiguate the reducer semantics, and add `sourceCollectorSnakeId` for per-instance cancellation. Preserves the most flexibility for future rules but retains the asymmetry problem and the reducer ambiguity.
- B: Replace the collection with per-family flat slot fields on `SnakeState` (e.g. `invulnState: 'buff' | 'debuff' | null`, `invulnExpiry: TurnNumber | null`, same for invisibility). Maximally explicit at the field level, but pollutes `SnakeState` with family-specific fields and makes adding a third family a schema-breaking change.
- C: Keep a single `activeEffects` collection but enforce a ≤1-per-family structural invariant, where each member is `PotionEffect { family: EffectFamily, state: EffectState, expiryTurn: TurnNumber }` with `EffectFamily = 'invulnerability' | 'invisibility'` and `EffectState = 'buff' | 'debuff'`. Derive `invulnerabilityLevel(snake) ∈ {-1, 0, +1}` and `isVisible(snake)` as pure functions over the collection. Re-collection of a potion by a team whose effect of that family is still active *replaces* the existing effect (refreshing expiry, possibly flipping state). Cancellation under 01-REQ-031 is team-wide and family-scoped — disrupting the debuff-holder cancels the entire team's effect in that family.

**Decision**: Option C.
**Rationale**: Option C satisfies every requirement from the directive simultaneously. The ≤1-per-family invariant eliminates stacking without having to enumerate special cases for each rule that reads an effect. The symmetric `(family, state)` pair lets a single state machine cover both families — the rules for "what disrupts a buff" and "what it means to be a debuff-holder" no longer case-split on family, and adding a future family (e.g. a hypothetical speed potion) becomes a matter of extending the `EffectFamily` union without changing any pseudocode that operates on the collection generically. Deriving `invulnerabilityLevel` and `isVisible` as pure functions instead of storing them as fields on `SnakeState` removes the ≤1-per-family reducer ambiguity and enforces consistency automatically: the derived value can never drift from the collection state. This change also resolves 01-REVIEW-014's concern structurally — since the derived values are recomputed on every read from the activeEffects collection, and since Phases 1–8 don't write activeEffects (only `pendingEffects`, a separate list), the start-of-turn invariant falls out of the schema without any explicit snapshot or ordering audit beyond the one already enforced. Team-wide family-scoped cancellation is the natural semantics for a model where the debuff-holder is the team's "anchor" for the buff: the collector carries the debuff, teammates carry the buff, and if the anchor is disrupted the whole structure collapses atomically. Per-instance attribution (the `sourceCollectorSnakeId` that 01-REVIEW-010 was originally about) disappears because there's at most one effect per family per team — the "source" is implicit in the debuff-holder's identity at cancel-time.

Option A was rejected because it retains the exact asymmetry and reducer problems the user asked to eliminate. Option B was rejected because it bloats `SnakeState` with family-specific fields, making the schema harder to extend and forcing every rule that reads effects to case-split on family (the same pathology as the `invis_collector` marker but pushed into the schema). The collection-with-invariant approach of Option C gives the field-level explicitness of Option B via the derived-value functions while keeping the schema uniform and extensible.

**Scope of change**:
- **Requirements** (Phase 1, edited in place):
  - 01-REQ-004: `SnakeState` field list updated — `invulnerabilityLevel` and `visible` removed as stored fields; `activeEffects`/`pendingEffects` described as collections of `{family, state, expiryTurn}` members with the ≤1-per-family invariant called out.
  - 01-REQ-006: `EffectType` enum replaced with `EffectFamily × EffectState`.
  - 01-REQ-021: Snake-init wording updated to reference the derived-value functions rather than stored fields.
  - 01-REQ-022: Rewritten as a derived function: `invulnerabilityLevel(snake) = +1` if holding `(invulnerability, buff)`, `-1` if holding `(invulnerability, debuff)`, `0` otherwise.
  - 01-REQ-023: Rewritten as a derived predicate: `isVisible(snake) = false` iff the snake holds `(invisibility, buff)`. The invisibility-family debuff-holder (collector) remains visible. See 01-REVIEW-016 for the mistake this corrects.
  - 01-REQ-026, 01-REQ-027: Team rebuild of the relevant family scheduled via `pendingEffects` with replace-on-apply semantics; 01-REQ-027 explicitly notes the collector remains visible.
  - 01-REQ-028: Per-family ≤1 invariant; collector defined as the active debuff-holder for the family.
  - 01-REQ-031: Team-wide family-scoped cancellation; if a snake holds both debuffs and is disrupted, both families cancel independently.
  - 01-REQ-045: Terminology updated to speak of "debuff-holder" rather than "collector marker".
  - 01-REQ-047: Collect-and-aggregate team rebuild; simultaneous multi-collection within a family collapses to a single rebuild via replace-on-apply.
  - 01-REQ-050: Phase 9 ordering restated as cancel (9a) → apply with replace-semantics (9b) → expire (9c); no recompute step is needed because the observable values are derived on read.
- **Design** (Phase 2):
  - Section 2.1: `EffectInstance` interface replaced with `PotionEffect`; `SnakeState` drops `invulnerabilityLevel` and `visible` fields; post-code paragraphs rewritten to describe derived-value semantics and the ≤1-per-family invariant.
  - Section 2.6: Snake init no longer initialises the removed fields.
  - Section 2.7: Full rewrite covering the symmetric buff/debuff model, the ≤1-per-family invariant, derived-value functions, duration encoding, re-collection refresh semantics, team-wide family-scoped cancellation, and disruption buffer behaviour.
  - Section 2.8 pseudocode: Phase 3b/3c read `invulnerabilityLevel(attacker)` / `invulnerabilityLevel(victim)` via the derived function; Phase 6 rewritten as a collect-and-aggregate team rebuild keyed by `(centaurTeamId, family)` with replace-on-pending; Phase 9 restructured into 9a (cancel by team/family for disrupted debuff-holders), 9b (apply pending with replace-semantics against `activeEffects`), 9c (expire), no 9d.
  - Phase 9 ordering rationale and Phase 3 simultaneity clarifying example updated to reference the derived-value functions.
  - Section 2.11: `effect_applied` event carries `{family, state, expiryTurn}`; `effect_cancelled` carries `{family, reason}` with `reason` gaining `'replaced'` alongside the existing disruption cases.
- **Exported interfaces** (Phase 2):
  - Section 3.1: `EffectType` enum replaced with `EffectFamily` / `EffectState` type aliases; `invulnerabilityLevel()` and `isVisible()` functions added to the exported surface.
  - Section 3.2: `EffectInstance` → `PotionEffect`; `SnakeState` drops the two removed fields.
  - Section 3.9: Invariants updated to reference `PotionEffect`, the ≤1-per-family rule, derived-value functions, team-wide family-scoped cancellation, and the "debuff-holders remain visible" clarification.
  - Section 3.10 note 2: Rewritten — the schema no longer carries `sourceCollectorSnakeId`; attribution is unnecessary under the non-stacking model.
  - Section 3.10 note 9: Updated to reference only `activeEffects` (the two removed fields are no longer part of the invariant).
- **REVIEW items**:
  - 01-REVIEW-010 marked RESOLVED with decision "none of A/B/C; question dissolved by 01-REVIEW-015".

**Revisit if**: a future rule reintroduces within-family stacking (e.g. allowing a snake to accumulate multiple concurrent invulnerability buffs whose durations stack additively, or allowing an invulnerability buff and debuff to coexist on the same snake with some interaction rule). At that point the ≤1-per-family invariant breaks and the effect model must either reintroduce reducer semantics over the collection or partition the collection by provenance with `sourceCollectorSnakeId` reinstated. Also revisit if a future family is added that doesn't fit the buff/debuff dichotomy cleanly (e.g. a status effect with three or more mutually exclusive states) — the `EffectState` union would need to become family-parameterised.

**Affected requirements**: 01-REQ-004, 01-REQ-006, 01-REQ-021, 01-REQ-022, 01-REQ-023, 01-REQ-026, 01-REQ-027, 01-REQ-028, 01-REQ-031, 01-REQ-045, 01-REQ-047, 01-REQ-050.

### 01-REVIEW-016: Invisibility-collector visibility — formal-spec-only mistake, informal spec was correct — **RESOLVED**

**Type**: Mistake / Behavioural correction
**Phase**: Design
**Context**: An earlier draft of 01-REQ-023 specified that a snake is invisible iff it holds `invis_buff` *or* `invis_collector` — i.e. the invisibility potion collector itself was invisible along with its teammates. The user flagged this as always-intended-otherwise: the collector has always been meant to *remain visible* as the targetable weak link for the opposing team to disrupt the buff. On closer reading, the informal spec (v2.2) actually states the correct behaviour — the formal-spec error is *not* inherited from an ambiguous source. The decisive sentence is line 169, which describes MVP bot behaviour for invisibility as "Bot code naively simulates next board states with only the invisibility potion collector as the opponent." That phrasing only makes sense if the collector is still on the board as a visible target during the buff window. Consistent with this, line 157 defines `Visible` as "False when under invisibility buff effect" (not under `invis_collector`), and line 167 describes the buff as making "**all alive teammates** become invisible" — wording that separates the collector from "teammates". Line 305's scheduling rule similarly grants `invis_buff` only to teammates, while the collector receives the distinct `invis_collector` marker. What the informal spec lacks is a single sentence in plain language stating "the collector remains visible"; the correct behaviour is derivable from the definitions but never stated outright. The formal spec's first draft added a spurious `or invis_collector` disjunct to the invisibility predicate, which was a misread, not a faithful inheritance. Discovery happened during the 01-REVIEW-015 redesign audit, when unifying the two families under a symmetric buff/debuff model made the asymmetry stark: under the new model the invulnerability-family debuff-holder clearly remains vulnerable-to-body-collision (debuff = `-1` invuln level, strictly worse than teammates), and by symmetry the invisibility-family debuff-holder should remain visible (debuff = targetable, strictly worse than teammates).
**Question**: Should the invisibility-potion collector be visible or invisible during the 3-turn duration of its team's invisibility buff?
**Options**:
- A: Collector is invisible along with teammates. Matches the prior formal-spec draft. Makes the invisibility buff harder for opponents to disrupt (no targetable anchor).
- B: Collector remains visible while teammates are invisible. Matches user's always-intended behaviour. Makes the invisibility buff symmetric with the invulnerability buff — both have a targetable weak link (the debuff-holder) that opponents can disrupt to cancel the whole team effect.

**Decision**: Option B.
**Rationale**: The user confirmed this was the always-intended behaviour and that the informal spec's ambiguity is the root of the error, not a reflection of a different intended design. The symmetric buff/debuff model from 01-REVIEW-015 also makes Option B the only coherent choice — under that model every family's debuff-holder is strictly worse off than its teammates (invulnerability debuff = vulnerable, invisibility debuff = visible), and the team-wide family-scoped cancellation semantics depend on the debuff-holder being a meaningful disruption target. If the invisibility collector were invisible, opponents couldn't target it directly, and the cancellation-on-disruption rule would apply only to incidental collisions — a significant reduction in opposing counterplay that was never part of the design intent. Option A is rejected because it both contradicts the user's intent and breaks the structural symmetry that the redesigned effect model relies on.

**Scope of change**:
- **Requirement 01-REQ-023** rewritten to specify `isVisible(snake) = false` iff the snake holds `(invisibility, buff)` only. The debuff state does not affect visibility.
- **Section 2.1** post-code explanatory paragraphs and **Section 2.7** effect state machine explicitly call out that the invisibility-family debuff-holder remains visible, cross-referencing this REVIEW item.
- **Section 3.9 invariant list** includes "Both debuff-holders (invulnerability and invisibility) remain visible — the invisibility-family debuff-holder is explicitly visible to opponents as the targetable weak link for their team's invisibility buff."
- **Informal spec**: No behavioural change needed — v2.2 already implies the correct behaviour (decisively via line 169's MVP bot-behaviour description, and by definition via lines 157/167/305). A low-priority clarity improvement would add an explicit one-liner in Section 4 stating "the invisibility potion collector remains visible to opponents for the duration of the team's invisibility buff" so the rule doesn't require chaining two separate passages to derive. This is a documentation-hygiene item, not a correction.

**Revisit if**: user intent changes and the invisibility buff should be harder to disrupt by making the collector invisible too. At that point the buff/debuff symmetry breaks and the family needs a distinct "concealed anchor" state, or the cancellation rule needs to apply only to incidental collisions with the hidden collector. Neither is currently planned.

**Affected requirements**: 01-REQ-023 (behavioural correction), 01-REQ-027, 01-REQ-031 (knock-on consistency with corrected visibility).

### 01-REVIEW-017: `GameConfig` realignment to platform boundaries — **RESOLVED**

**Type**: Contradiction / Proposed Addition
**Phase**: Design
**Context**: Module 01's exported `GameConfig` and Module 05's exported `GameConfig` had diverged into two incompatible types with the same name: different nesting (nested vs flat), different field names (`hazardPercentage` vs `hazardPercent`), different units (ms vs seconds), and different encodings of "disabled" (sentinel vs nullable). Compounding this, the type mingled fields consumed only by Convex during board generation (board size, snakes-per-team, hazard %, fertile parameters) with fields that flow to SpacetimeDB at `initialize_game` and govern per-turn behaviour (max health, hazard damage, spawn rates, clock). That mingling forced every consumer to thread an `Omit<>` projection (or its equivalent) at the runtime boundary and produced parallel schemas that drifted independently. Three additional pain points appeared in the same audit: (1) each "optional feature" group (`fertileGround`, `invulnPotions`, `invisPotions`) carried a redundant `enabled` boolean that duplicated the information available from its dependent numeric field being zero; (2) the same shape had to be declarable in three runtimes (SpacetimeDB TypeScript with `@type` decorators, Convex TypeScript with `v.*` validators, shared engine TS) and there was no stated LCD constraint to prevent one runtime's idioms from leaking into the canonical type; (3) the `initialScores` computation in the turn-0 simultaneous-elimination branch referenced `snakesPerTeam`, which on the new boundary is a platform-only parameter not retained at STDB runtime.
**Question**: What is the minimal set of types, boundaries, and sentinel conventions that aligns `GameConfig` with the runtimes that actually consume each field, mirrors cleanly between SpacetimeDB record types and Convex nested `v.object` validators, and eliminates the competing type definition in Module 05?
**Options**:
- A: Keep one flat `GameConfig` owned by Module 01 and have consumers `Omit<>` the subset they don't need. Minimises type count but leaves every downstream reader responsible for knowing which fields are platform-only.
- B: Split by runtime boundary into `GameOrchestrationConfig` (Convex-side, never sent to STDB) and `GameRuntimeConfig` (flows to STDB and governs per-turn behaviour), with a `GameConfig = { orchestration, runtime }` parent. Drop the `enabled` flags in favour of sentinel values (`spawnRate: 0`, `density: 0`) that are structurally indistinguishable from an "off" feature. Module 05 stops redeclaring `GameConfig` and mirrors the canonical type through a Convex `v.object` validator proven equivalent by `Infer<>`/`AssertEqual<>`.
- C: Move to a schema DSL that emits both STDB and Convex definitions from a single declaration. Heaviest option; requires custom tooling.

**Decision**: Option B.
**Rationale**: The split traces the actual runtime boundary — STDB receives the pre-computed initial game state and only the `runtime` subtree, never any board-generation parameters. This makes the "handcrafted initial state" testing/puzzle workflow first-class: a test harness can construct an `InitialGameState` directly and feed STDB `(runtime, initialState)` without inventing board-gen parameters. Moving `snakesPerTeam` to orchestration is safe because the one runtime reference (`initialScores = 3 * snakesPerTeam` in Phase 10's simultaneous-elimination branch) is replaced by `initialScores = 3 * initialSnakeCount(t)`, derived from the initial snakes that STDB already holds — the spec never needed `snakesPerTeam` at runtime, it needed the count of each team's starting snakes, which is a property of the initial state itself. Dropping `enabled` is justified by the sentinel semantics of the adjacent numeric field: `spawnRate: 0` produces zero expected spawns per turn (the Phase 8 pseudocode degrades naturally to a no-op), and `density: 0` produces zero fertile cells at generation time (the Fertile restriction at runtime then conditions on the board rather than the config). The redundant flag added branching in both the schema and the pseudocode without adding expressive power. Once `enabled` left, the single-field nested wrappers `food: {spawnRate}`, `invulnPotions: {spawnRate}`, `invisPotions: {spawnRate}` each held only their rate, so they were flattened to `foodSpawnRate`, `invulnPotionSpawnRate`, `invisPotionSpawnRate` — single-field wrappers add syntactic noise without semantic grouping value. Nesting is retained where the group carries more than one field (`fertileGround: {density, clustering}` and `clock: {initialBudgetMs, budgetIncrementMs, firstTurnTimeMs, maxTurnTimeMs}`). For the tri-runtime mirror, the canonical TypeScript interfaces in Module 01 are the source of truth and must obey these constraints so that `@type` classes in STDB and `v.*` validators in Convex are 1:1 transcriptions: every numeric field is `number` (no `bigint`/`Int64`); no field is `null` or absent in value position — sentinels (`maxTurns: 0`, `fertileGround.density: 0`, `foodSpawnRate: 0`, `invulnPotionSpawnRate: 0`, `invisPotionSpawnRate: 0`) carry "disabled"; enums are string-literal unions (`BoardSize`); all time values are milliseconds; nested object grouping carries semantic meaning rather than syntactic optionality. An `AssertEqual<Infer<typeof gameConfigV>, GameConfig>` check in each adapter module turns any drift between Module 01's interfaces and Module 05's validators (or any future STDB/Convex schema declarations) into a compile-time error.
**Affected requirements/design elements**:
- Section 3.3 (`GameOrchestrationConfig`, `GameRuntimeConfig`, `GameConfig`); Section 3.8 (`generateBoardAndInitialState` takes `GameOrchestrationConfig`); Section 3.2 (new `fertileGroundEnabled(board)` helper).
- 01-REQ-048 (food eligibility keys on `fertileGroundEnabled(board)`); 01-REQ-049 (potion spawning unconditional; zero-rate sentinel).
- 01-REQ-069 (`fertileGround.density` range widened to include `0` as disabled sentinel); 01-REQ-070 (clustering inert when density is `0`).
- 01-REQ-071, 01-REQ-072, 01-REQ-073 (flat `foodSpawnRate` / `invulnPotionSpawnRate` / `invisPotionSpawnRate`; potion range widened to include `0` as disabled sentinel).
- Section 2.4 board-gen pseudocode; Section 2.8 Phase 7 and Phase 8 pseudocode; Section 2.10 turn-0 simultaneous-elimination branch (reads `initialSnakeCount(t)` from state); Section 3.9 invariant list (adds `fertileGroundEnabled` entry).
- Downstream: [02] re-export list and `SpacetimeDbInstanceLifecycle` lifecycle inputs; [04] `GameConfigRow` and `InitializeGameParams`; [05] `gameConfigValidator`, 05-REQ-022, 05-REQ-023 parameter table, 05-REQ-025, 05-REQ-032 step 4, 05-REQ-032d, and §3.3 `GameConfig` re-export; [03] `GameInvitationPayload.gameConfig` commentary.

**Revisit if**: a future rule change decouples "feature exists on this board" from "spawn rate is positive" — for instance, if a fertile-ground variant were introduced that places Fertile cells but suppresses their food-eligibility effect, the `density > 0` sentinel would no longer be a faithful proxy and an explicit feature flag would return.

