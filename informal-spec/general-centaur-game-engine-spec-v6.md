# General Centaur Game Engine & Platform Specification v6

## 1. Vision

Centaur is an educational game platform that trains gifted children to collaborate with AI and each other in novel competitive games where both human and AI strengths offer marginal value even when access to AI is unrestricted.

The thesis: discrete test-based education is dead in the age of AI because AI commoditizes performance in static metrics. The new paradigm entices human talent into an ecosystem of games where humans guide the priorities of AI micromanagers at strategic altitude — analogous to how modern warfare increasingly demands human attention at rising conceptual altitude over AI-controlled hardware.

The platform comprises three layers:

- **Game Engine**: A simultaneous turn-based engine (TypeScript, running as a SpacetimeDB module) with mass-based spatial conflict resolution and a mutation protocol enabling rich game mechanics with Byzantine robustness guarantees.
- **Platform Services**: Persistent cross-team data (user accounts, game history, replays, tournaments, game type specs, rooms) managed by a platform Convex instance.
- **Centaur Servers**: Per-team servers that mediate between human players, bot code, and the game engine. Each team's Centaur server appears to the game engine as a single player. Each team operates its own Convex instance for team-sovereign state (goals, fears, delegation, bot parameters).

---

## 2. Platform Architecture

### Infrastructure Topology

```
┌──────────────────────────────────────────────────┐
│              SpacetimeDB Instance                 │
│         (transient per-game database)             │
│   TypeScript module: engine logic + game state    │
│   Scheduled reducer: turn resolution pipeline     │
│   Tables: staged_actions, game_state, events      │
│   Team membership table for RLS                   │
└───────┬──────────────────────────────────────────┘
        │
        │ Procedure (HTTP: replay snapshots)
        ▼
┌───────────────────────┐
│ Convex (platform)     │──────────────────────────────────┐
│   User accounts       │                                  │
│   Game history        │                                  │
│   Replays             │                                  │
│   Game type specs     │                                  │
│   Tournaments/rooms   │                                  │
└───────────────────────┘                                  │
                                                           │
   Per-Team Layer (identical structure per team)            │
  ┌────────────────────────────────────────────────────┐   │
  │                                                    │   │
  │  ┌──────────────────────────┐                      │   │
  │  │   Convex (team)          │                      │   │
  │  │   Delegation state       │                      │   │
  │  │   Goals/fears config     │                      │   │
  │  │   Bot parameters         │                      │   │
  │  │   Board annotations      │                      │   │
  │  │   Action audit log       │                      │   │
  │  └─────┬──────────┬─────────┘                      │   │
  │        │          │                                │   │
  │        │          │ Reactive subscriptions         │   │
  │        │          │                                │   │
  │        │          ▼                                │   │
  │        │  ┌────────────────────────────────┐       │   │
  │        │  │      Web Clients               │       │   │
  │        │  │  ← SpacetimeDB (game state)    │◄──────┼───┼── SpacetimeDB
  │        │  │  → SpacetimeDB (direct actions) │──────┼───┼─► SpacetimeDB
  │        │  │  ← Team Convex (delegation/UI) │       │   │
  │        │  │  → Team Convex (goals/fears)   │       │   │
  │        │  └────────────────────────────────┘       │   │
  │        │                                           │   │
  │        │ Reactive subscriptions                    │   │
  │        ▼                                           │   │
  │  ┌─────────────────────────────────────────┐       │   │
  │  │      Centaur Server                     │       │   │
  │  │  ← SpacetimeDB (game state via WS)     │◄──────┼───┼── SpacetimeDB
  │  │  → SpacetimeDB (staged moves via WS)   │───────┼───┼─► SpacetimeDB
  │  │  ← Team Convex (delegation/config)     │       │   │
  │  │  → Team Convex (board annotations)     │       │   │
  │  │  ← Platform Convex (game type specs)   │◄──────┼───┘
  │  │     Bot code                            │       │
  │  └─────────────────────────────────────────┘       │
  │                                                    │
  └────────────────────────────────────────────────────┘
```

### Shared Engine Codebase

The engine core is a single TypeScript codebase. TypeScript is chosen over Rust for the SpacetimeDB module to enable a single source of truth for action validation, ActionType definitions, Component System logic, and type definitions — shared across SpacetimeDB module, web client, and Centaur server. The performance characteristics of TypeScript on SpacetimeDB's V8 runtime are more than sufficient for turn-based games with seconds-scale turn durations.

The engine core exports:
- **ActionType definitions**: Shared definitions used by the web client (action UI), Centaur server (bot traversal), and SpacetimeDB module (authoritative validation). The argument provision and interface generation model for ActionTypes is an open question (see Section 5).
- **Component System definitions**: Used by SpacetimeDB module
- **Turn resolution pipeline**: Used by SpacetimeDB module
- **Type definitions**: Game state, actions, mutations, receipts — used everywhere

### SpacetimeDB (Game Runtime)

Each game instance is a transient SpacetimeDB database. The engine core TypeScript is deployed as a SpacetimeDB module. Game state is stored in SpacetimeDB tables. A scheduled reducer fires at the turn interval, reads staged actions, runs the full turn resolution pipeline as a single ACID transaction, and writes results back to state tables.

SpacetimeDB provides automatic real-time synchronization to connected clients via subscription queries. Fog of war is implemented via Row Level Security or Views, ensuring each connection receives only the game state its team is entitled to see.

**Team membership and RLS**: Each Centaur server registers the Google identities of its team members with SpacetimeDB via a team membership table. RLS rules reference this table to grant the same fog-filtered view to all connections belonging to the same team — both the Centaur server and individual human web clients.

**Move staging**: The `staged_actions` table is keyed by object ID. Exactly one staged action exists per object at any time. Writes use last-write-wins semantics. Both human web clients (for direct actions) and the Centaur server (for bot-computed moves) write to this table. The turn resolver consumes and clears staged actions atomically when the turn fires.

**Replay persistence**: After each turn, a SpacetimeDB procedure posts the full state snapshot as JSON to a platform Convex HTTP endpoint. Replays are self-contained state snapshots, not command logs requiring engine version matching.

### Convex (Platform)

A shared Convex instance manages cross-team persistent platform data:

- **User accounts**: Google OAuth identity, profile data, team membership
- **Game history**: Results, scores, statistics
- **Replay snapshots**: Per-turn state snapshots received from SpacetimeDB procedures
- **Game type specifications**: JSON configurations defining object types, maps, scoring rules
- **Tournaments and rooms**: Matchmaking, scheduling, lobby management

Authentication uses Google OAuth as the identity provider with Convex Auth mediating identity management. SpacetimeDB validates the same Google OIDC tokens for game connections.

### Convex (Per-Team)

Each team operates its own Convex instance, storing team-sovereign state:

- **Delegation state**: Which objects are human-controlled vs bot-controlled, and by which team member
- **Goals and fears**: Per-object attention directives configured by humans
- **Bot parameters**: Heuristic weights, search depth preferences, custom configuration
- **Board annotations**: Derived board state enrichments computed by the Centaur server for the web client
- **Action audit log**: Record of direct actions submitted to SpacetimeDB by human clients, logged for analysis

The team Convex instance can be self-hosted and colocated with the Centaur server and SpacetimeDB in the same data centre for minimal latency.

### Centaur Servers (Per-Team)

Each team operates its own Centaur server. The Centaur server:

- Holds a WebSocket subscription to SpacetimeDB for its team's fog-filtered game state
- Contains all the team's bot code within its monorepo
- Subscribes to team Convex queries for delegation state and human configuration (goals, fears, bot parameters)
- Dispatches derived board state to bot subsystems for move computation on non-human-delegated objects
- Stages computed moves in SpacetimeDB's `staged_actions` table via reducer calls
- Writes derived board state annotations back to team Convex for the web client
- Reads from platform Convex for game type specifications

There is no security boundary within a Centaur server — all code running there is selected by the allied team. Security boundaries exist between teams at the game engine level (fog of war, move validation).

### Web Clients

Human players connect to both SpacetimeDB and team Convex:

**SpacetimeDB connection** (direct, low latency):
- Subscribes to fog-filtered game state including all component state for visible objects
- Stages direct actions for human-controlled objects via reducer calls
- Receives real-time updates including teammates' staged moves

**Team Convex connection** (strategic altitude):
- Reads delegation state, board annotations, current goal/fear configurations
- Writes goal/fear assignments, delegation changes (take/release manual control of objects)
- Direct actions submitted to SpacetimeDB are also logged to team Convex for analysis

The delegation state in team Convex determines which interface affordances are active. When an object is delegated to a human, the direct action interface is enabled for that human. When delegated to bot, the human sees bot-staged moves but the direct action affordance is disabled. The Centaur server likewise reads delegation state to know which objects to skip in bot computation.

**Invariant**: SpacetimeDB does not enforce delegation. The `staged_actions` table accepts writes from any team member or the Centaur server, last-write-wins. Delegation discipline is maintained by team Convex controlling which affordances are active on clients and which objects the Centaur server computes for. This keeps SpacetimeDB's concerns purely about game state and move execution.

---

## 3. Centaur Interface

### Design Principles

The Centaur interface is as load-bearing for the educational thesis as the game mechanics. The UX must make human-AI collaboration feel natural and powerful — intervening only when human judgment adds marginal value.

**Default: AI control.** All objects are controlled by bot code by default. Bot subsystems compute moves for all non-human-delegated objects every turn.

**Human override: RTS-style selection.** Players click objects to take/release manual control (delegation change written to team Convex). Manual control enables the direct action interface for that object.

**Two interface layers:**

1. **Direct action interface** (SpacetimeDB-mediated): For a selected human-controlled object, presents the object's available actions and collects the arguments required to submit one. The mechanism by which arguments are collected and validated is an open question (see Section 5). Component state synced directly from SpacetimeDB provides minimum latency and full data for any filtering or validation.

2. **Strategic command interface** (team Convex-mediated): For any object, humans configure goals and fears that bias bot computation. Higher-level than individual moves — attention allocation for the team's AI systems.

### Anytime Algorithm Pattern

The Centaur server implements an anytime algorithm: bot subsystems continuously refine their staged move as computation progresses within each turn. The move staged in SpacetimeDB when the turn timer fires is whatever the best current answer is.

For human-controlled objects, the bot still computes provisional moves as a fallback. If the human doesn't stage a move before the timer fires, the bot's provisional move stands. If the human does stage a move, it overwrites the bot's via last-write-wins. No special arbitration logic required.

Human configuration changes mid-turn (goal/fear updates via team Convex) trigger re-dispatch to affected bot subsystems with updated heuristic weights.

### Goals

A goal is a directive assigned to an object (or group of objects) that biases bot computation toward achieving an outcome. Goals are selected from a repertoire implemented per object type in the Centaur server's bot code. Goals are the positive-reward semantic variant of Drive (see Section 4).

Examples:
- **Kill(target)**: Prioritize moves predicted to lead to target's destruction
- **Capture(zone)**: Prioritize moves that lead to territorial control of a zone
- **Escort(ally)**: Maintain proximity to ally, absorb threats directed at them
- **Harvest(resource_type)**: Seek and collect resources of specified type

Goals accept arguments supplied by the human via mouse interaction — click object, select goal, click target.

### Fears

A fear is a defensive attention directive. It tells the bot system to allocate compute toward detecting and avoiding a specified threat pattern. Fears direct negative-space search: "look for developing threats that haven't materialized yet." Fears are the negative-reward semantic variant of Drive (see Section 4).

Examples:
- **Entrapment(enemy)**: Simulate whether enemy is within tactical range of trapping our objects; propagate negative scores for move branches that lead toward entrapment
- **Ambush(zone)**: Increase suspicion weight for fog-of-war zones where enemy concentration is plausible
- **Overextension**: Penalize moves that advance objects beyond support range of allies

Fears are where human pattern recognition offers the strongest persistent marginal value over unguided search. A human sees a developing threat from board shape; an unguided algorithm would need to explore that branch deeply to discover it and probably won't allocate depth there. The fear annotation says "something bad is brewing here — verify computationally and find avoidance paths."

### Heuristic Architecture

Bot code for each object type implements Drives and Preferences (see Section 4) that collectively define how the object evaluates candidate moves. The bot framework in the reference Centaur server implementation provides the shared infrastructure within which those heuristics execute.

Players and coaches can write custom heuristic functions, goal types, and fear types within their team's Centaur server monorepo.

### Human-Selection Move Preview

When a human selects an object, the bot reruns its evaluation for that object with all currently staged team actions substituted into foreign object positions in the simulated board states. This produces an updated ranked portfolio of candidate moves, colour-coded red-to-green by quality, with the bot's current best move in default position. The human can confirm the bot's choice or override with spacebar / direct interaction.

---

## 4. Bot Framework (Reference Implementation)

The bot framework ships as part of the reference Centaur Server implementation. Teams may use, extend, or replace any part of it. It provides shared infrastructure for per-object AI decision-making so that Centaur Server authors can focus on authoring game-specific heuristic logic.

**Scope note**: The MVP bot framework operates at depth-1 (single-ply lookahead). The architecture is designed to accommodate future multi-ply tree search as a natural extension, but that capability is out of scope for the MVP.

### Heuristic Types

**Drive\<T\>**

A Drive represents a directed motivation toward or away from a future event. It is parameterised by a target type T (an object, zone, event type, or any game-meaningful referent):

```typescript
interface Drive<T> {
  target: T;

  // How much reward reaching the target event is worth given present conditions.
  // Negative values produce fear behaviour (seek to increase distance).
  // Output range: [-1, 1]
  rewardFunc: (self: ObjectState, target: T, board: BoardState) => number;

  // Estimated number of turns until the target event occurs or is reached.
  distanceFunc: (self: ObjectState, target: T, board: BoardState) => number;

  // Combines predicted reward and estimated distance into a heuristic weight.
  // Output range: [-1, 1]
  motivationFunc: (reward: number, distance: number) => number;

  // Priority-ordered list of self-actions this Drive wants considered.
  nominateSelfActions: (self: ObjectState, target: T, board: BoardState) => Action[];

  // Priority-ordered list of (foreign object, action) pairs this Drive
  // wants considered when simulating opponent/ally responses.
  nominateForeignActions: (self: ObjectState, target: T, board: BoardState) => Array<{ objectId: ObjectId; action: Action }>;
}
```

Semantic variants:
- **Goal**: A Drive where `rewardFunc` returns positive values — motivates approach.
- **Fear**: A Drive where `rewardFunc` returns negative values — motivates avoidance.

The distinction is purely semantic. The framework treats all Drives identically.

**Preference**

A Preference is a time-invariant heuristic over board state — a tendency to prefer or avoid the world having certain measurable properties. It does not nominate candidate actions; it is a passenger on the search space that active Drives define.

```typescript
type Preference = (self: ObjectState, board: BoardState) => number; // range [-1, 1]
```

Semantic variants:
- **Like**: A Preference returning positive values.
- **Dislike**: A Preference returning negative values.

### Output Range Convention

All heuristic functions (Drive `rewardFunc`, `motivationFunc`, and Preference) **must output values in [-1, 1]**. These normalized shapes are aggregated by portfolio weights (see below). Calibration of relative influence is concentrated in portfolio weights, not inside heuristic functions.

### Motivation Function Convention

`motivationFunc` receives a reward in [-1, 1] and a non-negative integer distance, and must return a value in [-1, 1]. As distance grows, motivation should asymptotically dampen toward 0. The reference implementation provides two standard constructors:

- **Exponential**: `(reward, distance) => reward * λ^distance` where λ ∈ (0, 1)
- **Hyperbolic**: `(reward, distance) => reward / (1 + k * distance)` where k > 0

Both converge to 0 as distance → ∞ and preserve the sign of reward.

### Object Heuristic Portfolio

Each object instance carries a portfolio of active heuristics — a set of Drives and Preferences, each with a **portfolio weight** (positive real number). Portfolio weights are the single calibration surface for relative heuristic influence.

ObjectType definitions in the Centaur Server specify **default portfolio weights** as priors for each heuristic type. Humans can override these per-object instance at runtime via the strategic command interface.

### Candidate Action Enumeration

Each ObjectType in the Centaur Server defines an `EnumerateCandidateActions` function:

```typescript
type EnumerateCandidateActions = (self: ObjectState, board: BoardState) => Action[];
```

This function is responsible for producing the set of fully-specified candidate actions the bot will evaluate for a given object. How ActionTypes are instantiated into concrete Actions — i.e. how argument values are bound — is an open question (see Section 5). Teams may implement `EnumerateCandidateActions` however they see fit within their Centaur server.

**Self-candidates**: The union of all self-action nominations across active Drives, merged with the output of `EnumerateCandidateActions`. Each candidate action receives a priority weight computed as the sum over all drives that nominated it of `portfolioWeight_d × RANK_DECAY^(rank - 1)` where rank is the 1-based position in that Drive's nomination list and `RANK_DECAY = 0.9`.

**Foreign candidates**: For each visible foreign object, the union of all (object, action) nominations across active Drives. Each (object, action) pair receives a priority weight by the same rank-decay formula.

### World Simulation

For each candidate self-action, the bot simulates partial next-turn board states. A **partial board state** is computed by applying the chosen self-action and one combination of foreign object actions to the current board state, with full mutations resolved — movement, health effects, inventory changes, and all other mutation protocol effects are applied. All non-nominated foreign objects remain at their current positions.

The partial board state tracks per-object turn timestamps. This allows graph algorithms such as multi-headed BFS for Voronoi territory to give objects that have moved an appropriate temporal head start, enabling meaningful positional inference without requiring a full combinatorial game tree.

All allies and enemies are treated symmetrically in the MVP. Foreign action nominations are not distinguished by team membership — the framework applies conservative minimax reasoning uniformly across all foreign objects. Post-MVP team coordination is a planned enhancement (see end of this section).

### Foreign Combination Traversal (Dijkstra-on-Lattice)

Foreign action combinations are traversed in descending order of combined priority weight using Dijkstra's algorithm on the lattice of rank vectors.

**Lattice structure**: Each dimension corresponds to one foreign object. The coordinate along dimension i is the rank index (0-based) into that object's priority-ordered candidate action list. A lattice point represents one combination of foreign actions — one per foreign object.

**Combined weight**: Product of per-object weights at the chosen rank for each foreign object, where each object's weight at rank r is the pre-computed priority weight for the action at that rank.

**Traversal**:
1. Initialize a max-heap with the all-rank-0 point (every foreign object at its highest-weight action).
2. Pop the highest-weight point; simulate the corresponding world.
3. Push all unvisited neighbors (increment any one dimension by 1) into the heap.
4. Repeat until the heap is empty or the turn deadline is reached.

A visited set prevents duplicate enqueuing. This guarantees exact descending weight order with no tie-breaking ambiguity. Combinations that are lower in combined priority may not be reached before the turn deadline — this is handled by the anytime submission system.

### Scoring

For each candidate self-action, the bot maintains a **worst-case score** across all evaluated foreign combinations:

1. For each simulated world (self-action × foreign-combination): evaluate all active heuristics. Each Drive's contribution is `portfolioWeight × motivationFunc(rewardFunc(...), distanceFunc(...))`. Each Preference's contribution is `portfolioWeight × preference(self, board)`. Sum all contributions to produce the world score.
2. The worst-case score for a self-action is the **minimum world score** across all foreign combinations evaluated so far for that self-action.

This implements a conservative minimax: the bot favours moves that maximize the worst-case net reward over the foreign actions it considers worth simulating. A consequence of this conservatism is that bots will be reluctant to commit resources to attacks that could theoretically be blocked, leaving initiative-taking to human players. This is an acceptable MVP limitation.

### Anytime Submission

All object evaluations run in parallel. Each object maintains a `stateMap` of candidate self-actions to their current worst-case scores and a **dirty flag** set whenever any worst-case score changes.

**World processing order**: Self-candidates are processed in round-robin across their priority order, so every self-action receives its highest-priority foreign world before any receives its second. This ensures a meaningful score exists for all self-actions as quickly as possible, so the first submission interval always has something sensible to stage.

**Scheduled submission**: A submission process runs on a fixed interval (e.g. every 100ms for a 500ms turn). Each run iterates only over objects with dirty stateMaps since the last submission. For each such object, it resamples the softmax over current worst-case scores and stages the resulting action in SpacetimeDB. The dirty flag is cleared after submission.

**Final submission**: One last submission run executes immediately before the turn deadline, flushing all remaining dirty objects.

`runBotForObject` is responsible only for updating `stateMap` and setting the dirty flag. The submission process is owned by the Centaur Server scheduler, not by individual object evaluators.

### Softmax Decision

Worst-case scores across a self-action's candidates serve as softmax logits:

```
P(action_i) = exp(score_i / T) / Σ exp(score_j / T)
```

where T is the temperature parameter. A **global temperature** is set at the Centaur Server level. Individual objects may specify a **per-object temperature override**. Lower temperature concentrates probability on the highest-scoring action; higher temperature increases exploratory variance.

### Human-Selection Rerun

When a human selects an object in the UI, the bot immediately reruns evaluation for that object with all currently staged actions from our own team substituted into the corresponding foreign object positions in the simulated board states. This uses the same framework machinery but produces an updated `stateMap` that reflects our team's current committed plan. The resulting candidate move portfolio is displayed to the human colour-coded by quality (worst-case score), with the softmax mode in default position for confirmation or override.

### Future Enhancement: Team Coordination

A high-priority post-MVP enhancement is a coordination system allowing a team's objects to share partial search results and pursue goals via sequenced, jointly-optimised action. This requires resolving dependency hazards — human overrides of one object's staged action invalidating assumptions baked into another object's bot computation — and is substantially more complex than the MVP's independent parallel evaluation. In the MVP, bots compute independently with frozen board state; humans must initiate coordinated risk-taking.

---

## 5. Action Type System

**Open question**: The mechanism by which ActionTypes receive argument values — from both human players and bot code — is under active design and is not specified in this version.

The following properties are settled and independent of the argument provision model:

- ActionTypes are named, shared definitions in the engine core, available to the web client, Centaur server, and SpacetimeDB module.
- ActionTypes declare dependencies on Component Systems to access component state during validation.
- ActionType validation runs against the fog-filtered board state the player sees. Both client-side pre-validation and server-side authoritative validation use the same fog-filtered state by construction.
- A staged action submitted to SpacetimeDB contains at minimum the object ID, action type identifier, and whatever argument representation is chosen. The SpacetimeDB module performs authoritative validation before accepting the action into the turn pipeline.

Questions left open include: how argument values are collected from humans (GUI model), how argument values are enumerated or sampled for bot traversal, whether validation is expressed as a single function or a structured chain, and what the wire format for staged actions looks like.

---

## 6. Core Engine Abstractions

### Component

An abstract data structure storing state for a specific behavioural domain. Examples: Health, Burn, MassDistribution, Inventory, ThreatTable, ZoneOccupancy, Composite.

Components are pure data with no behaviour attached.

### Component System

Owns exactly one Component type (1:1 relationship). Responsibilities:

- Define Component's data schema
- Define initialization function (in terms of dependent components' state)
- Define validation functions for each supported MutationRequest type
- Process MutationRequests targeting its Component during resolution
- Emit MutationReceipts
- Run per-turn evolution logic on active Components
- Register death listeners and process death reaction callbacks
- Optionally uninitialize Component when no longer applicable

Component Systems declare dependencies on foreign Components at registration time. Dependencies grant:
- Read access to foreign Component state
- Subscription to MutationRequests targeting those Components

A Component System never writes to Components it does not own.

Dependency cycles between Component Systems are permitted. A dependent component may be null when a system's validation function runs, and validation must handle this. During Mutation.Resolution, systems operate in isolation from dependencies — resolution is a function only of already-validated incoming mutation requests targeting the system's own component.

**Circular dependency and initialization**: A dependency is *strong* if the system's validation function requires it to be active (non-null); otherwise it is *weak*. Weak dependencies tolerate absence; strong dependencies enforce presence. Dynamic Component Activation succeeds only when all strong dependencies are already active on the target object. Mutual strong dependencies require co-initialization via the ObjectType definition — they cannot be independently acquired at runtime.

**Component initialization**: Components are initialized at object creation time with starting state specified by the ObjectType. Dynamic Component Activation (mid-game initialization triggered by a MutationRequest) is also possible, but the activating system can only initialize *its own* component on the target object. System A cannot initialize system B.

### Object

A runtime entity with:
- Unique ObjectID
- Set of active Components
- Spatial state: **Embodied** (occupies a cell), **Contained** (inside another object), or **Abstract** (off-grid)
- Composition role: **Independent**, **Composite parent**, or **Composite part**
- Controller: reference to owning player
- Time step `s` and time step offset `o`

Spatial states are mutually exclusive:
- **Embodied**: Directly occupies a cell. Appears in cell occupancy. Participates in movement bidding.
- **Contained**: Inside another object. Does not occupy a cell. May bid for a cell to leave containment.
- **Abstract**: Off-grid. May bid for a cell to become embodied.

**Containment**: Objects can contain other objects. Nested containment supported with no depth limit (algorithms O(n) on depth). When a container is destroyed, its contents are destroyed unless the container's event behavior specifies otherwise.

**Composition**: A composite parent controls movement and actions for all its parts. Only the composite parent has actions. Parts do not independently bid — the composite parent does on their behalf. The Composite Component System manages parts and integrity.

**Control (Ownership)**: Determines which player submits actions. Orthogonal to containment and composition.

### Composite Component System

A dedicated Component System managing composite object integrity. Owns the Composite component storing:
- Set of part objects and their spatial relationships (body blueprint)
- Integrity rules (rigid, flexible, partial damage tolerance)

**Constraint**: Composite parts may not themselves be composite parents. Nested composition is not supported.

The Composite Component System:
- Can modify the set of component parts
- Can receive mutation requests to add or remove parts
- Broadcasts mutation requests targeting any part's Composite component to all systems on the composite
- Enforces integrity during Move.React (Phase 6): detects part loss from movement resolution and triggers self-destruct of affected parts or the entire composite

### ObjectType

A data-driven template defining:
- Which Components an Object starts with (and their initial state)
- Available Actions (referencing ActionType definitions)
- Default movement behaviour (invoked during Move.Bid and Move.Commit if action doesn't override)
- Movement event behaviours: OnDevoured, OnCollision, OnSelfDestruct (selected from finite repertoire)
- OnDevour behaviour
- OnDeath behaviour (for mutation-phase health death)

Event behaviours are finite repertoires, not open callback functions. ObjectTypes are data-driven artifacts that select from a fixed menu of engine-supported behaviours, enabling safe assembly of arbitrary object types into custom games.

Every ObjectType must define a default movement bid that deterministically selects a committed move. Self-destruct is always available in the bid portfolio.

ObjectTypes are design-time artifacts; Objects are runtime instances.

### Action

A fully-specified action ready for submission. Contains the structured data that informs mutation request construction through the turn pipeline. Defined by:
- Resource costs (withdrawn in Action Validation phase)
- Death listener registration function
- MutationRequests to emit during Mutation.Initiative
- Action Finality callback (processes MutationReceipts, emits MutationRequests including to foreign components)
- Death Reaction callback (self-mutations only)

How an Action is constructed from an ActionType and argument values is an open question (see Section 5).

---

## 7. Turn Resolution Pipeline

Each turn proceeds through ordered phases. Within each phase, operations parallelize as specified.

| Phase | Parallelism | Summary |
|-------|-------------|---------|
| 1. Action Validation | per-object | Validate staged action against fog-filtered board state. Withdraw resource costs (locked in regardless of outcomes). |
| 2. Death Listener Registration | per-object, per-system | Actions and systems declare objects to monitor for death events |
| 3. Move.Bid | per-object, then per-cell | Objects allocate mass to candidate cells; cells broadcast strongest competitor. Bids below terrain impedance disallowed. |
| 4. Move.Commit | per-object | Objects choose which bid to commit to, or self-destruct. |
| 5. Move.Resolve | per-cell, then per-object | Cells determine winner; losers processed via OnDevoured/OnCollision/OnSelfDestruct; Collision objects created for ties |
| 6. Move.React | per-object | Objects observe post-resolve state. May self-destruct self or owned parts. Single pass. |
| 7. Spatial Validation | per-object | Check spatial preconditions (e.g., range) using post-movement positions |
| 8. Mutation.Initiative | per-object | Actions and Component Systems emit MutationRequests (includes contained object systems) |
| 9. Mutation.Reaction | per-(object, system) | Systems respond to subscribed requests with additional requests (single pass) |
| 10. Mutation.Resolution | per-(object, system) | Systems resolve requests, emit receipts, may initialize new components. May register additional death listeners. |
| 11. Action Finality | per-object | Actions observe receipts, emit MutationRequests (may target foreign components) |
| 12. System Finality | per-(object, system) | Systems process mutation requests from Phase 11 and may directly modify own component state. Collision objects from turn n-1 self-destruct. |
| 13. Death Resolution | per-object | Health-death triggers OnDeath; populate Graveyard |
| 14. Action Death Reaction | per-object | Actions with death listeners receive killed-target set, emit self-mutations only |
| 15. System Death Reaction | per-(object, system) | Systems with death listeners process death events and mutation requests from Phase 14; emit self-mutations only |

### Phase Invariants

- **Costs are locked in**: Resource costs withdrawn in Phase 1 are never refunded.
- **Single-pass reactions**: Mutation.Reaction (Phase 9) runs exactly once. Deliberate constraint for Byzantine robustness.
- **Move.React is self-only, single-pass, and snapshot-based**: Objects may only destroy themselves or parts they control. All reactions read from a shared snapshot of post-Move.Resolve state and execute in parallel — no reaction observes another's output. Dropped objects enter as Abstract and bid next turn.
- **Death reactions are self-only**: No foreign mutations permitted in response to death events.
- **Movement events precede mutations**: All movement-phase events resolve before any mutation phases begin.
- **Contained objects can act**: Contained objects emit mutation requests during Mutation.Initiative via their component systems.

---

## 8. Movement System

Movement is the only domain requiring cross-object constraint resolution within a phase.

### Phase Details

**Move.Bid**: Each object (or composite parent on behalf of parts) allocates mass across candidate cells. Bids below terrain impedance are disallowed. Default movement behaviour invoked if action doesn't specify. After all bids placed, each cell broadcasts the highest competing bid to all bidders.

**Move.Commit**: Objects observe competing bids and choose one bid or self-destruct. Commit to a new cell requires total bid mass (own + push) meets terrain impedance. Default movement behaviour invoked if action doesn't specify.

**Move.Resolve**: Per-cell outcomes:
- **Unique highest mass**: Winner occupies cell. All others devoured.
- **Tied highest mass**: Collision object created. All bidders trigger OnCollision.
- **Self-destruct**: OnSelfDestruct triggered. Drops land in vacated cell.

**Move.React**: Objects observe post-resolution state. Any object may self-destruct. Composite parents may destroy parts. Primary mechanism for composite integrity enforcement. Single pass — no cascading. Dropped objects enter as Abstract and bid next turn. All reactions read from a snapshot of post-Move.Resolve state; reactions execute in parallel and are independent of each other's outputs.

### Core Concepts

**Mass**: Total and available. Bids consume available mass. Can split across cells but commit to one.

**Bidding**: (cell, mass) pair. Higher mass wins. Bidding on current cell = hold position. Below-impedance bids disallowed.

**Self-destruct**: Always in portfolio. Triggers OnSelfDestruct.

**Commitment**: Choose one bid or self-destruct after observing competition. New cell requires total mass meets impedance.

**Zero-mass objects**: Hold cell until contested by any bid.

### Terrain Impedance

Minimum mass for a valid bid on a cell. Holding position is exempt. Push mass contributes to threshold. High impedance creates impassable terrain for low-mass objects, swamp-like trapping terrain with mass-splitting movement rules.

### Push Mechanic

Allocate mass to push foreign objects during Move.Bid. Pushed object retains agency in commit phase. Push mass contributes to impedance threshold, enabling cooperative pushes.

**Composite parts**: Push bids on parts visible to composite parent. Integrity breaches resolved in Move.React.

### Composite Object Movement

Composite parents bid and commit for all parts with full knowledge of all bids including pushes.

### Containment and Movement Bidding

Contained objects may bid to leave containment with own intrinsic mass. Abstract objects may bid to become embodied. Any object can bid on any cell regardless of distance — practical constraints are game design choices.

### Collision Objects

Zero mass. Contain all dropped objects from tied bidders. Contained objects can emit mutation requests and bid next turn. Self-destruct at end of turn n+1, destroying remaining contents. Two-turn lifespan creates tactical pressure.

### Movement Variants

1. **Full commit**: All mass on target, always commit.
2. **Cautious advance**: 50:50 target/origin, commit to winner.
3. **Bid control, default commit**: User allocates, system commits to best margin.
4. **Full bid and commit control**: Maximum expressiveness.

### Mass Distribution Component

Manages mass state. Pro-rata dampening for over-allocation. Movement effects via mutation affect next turn's Move.Bid portfolio (forced march, root/snare) — no within-turn cascading.

---

## 9. Mutation Request/Receipt Protocol

### MutationRequest

```typescript
type MutationRequest = {
  id: RequestId;
  sourceObject: ObjectId;
  sourceAction: ActionTypeId;
  targetObject: ObjectId;
  targetComponent: ComponentTypeId;
  mutationType: string;
  parameters: unknown;
};
```

### MutationReceipt

Information hiding: reveals effective impact without exposing target's actual state.

```typescript
type MutationReceipt = {
  requestId: RequestId;
  effectiveImpact: unknown;
};
```

### Conflict Resolution Strategies

Per Component System: Health sums damage (can go negative, allowing healing to prevent death). MassDistribution dampens pro-rata. Buff uses priority stacking with caps. Others case-by-case.

### Dynamic Component Activation

MutationRequest targets inactive Component → validation → initialize own Component if strong dependencies met → apply request → active for subsequent turns. A system can only initialize its own Component.

---

## 10. Death Listener Protocol

Actions and component systems react when specific objects die during Death Resolution (Phase 13). Health-system death only — not movement events.

**Phase 2**: Register based on action parameters or component state from previous turn.

**Phase 10**: Additional registration for components initialized mid-turn.

**Death notifications** include final location for spatial filtering.

**Phases 14-15**: Self-mutations only. System Death Reaction also receives mutation requests from Action Death Reaction.

---

## 11. Movement Event Behaviours

| Event | Trigger | Cell Winner | Behavior Selector |
|-------|---------|------------|-------------------|
| Devoured | Lose cell contest to unique winner | The winner | OnDevoured (loser), OnDevour (winner) |
| Collision | Tie for cell | Collision object | OnCollision (all bidders) |
| Self-Destruct | Commit or Move.React destruction | N/A | OnSelfDestruct |

### Repertoires

**OnDevoured / OnCollision**: Drop self, drop loot bag, drop new instance, recursive destroy, lose embodiment to abstract object.

**OnSelfDestruct**: Drop loot bag, drop new instance, recursive destroy, lose embodiment to abstract object.

**OnDevour**: Add to inventory, recursively consume mass (configurable loss factor), recursively destroy.

### Drop Recipients

| Event | Recipient |
|-------|-----------|
| OnDevoured | Cell winner (via OnDevour) |
| OnCollision | Collision object |
| OnSelfDestruct | Origin cell: devoured by winner if contested, collision if tied, bids next turn if uncontested |
| OnDeath | Cell occupant if present, else bids next turn |

### Contained Effect Objects

Contained objects emit mutation requests during Mutation.Initiative. Containment grants spatial proximity, not behavioral control. Primary mechanism for payload effects.

---

## 12. Object Model

### Spatial States and Composition

```
Embodied: Directly occupies a cell
Contained: Inside another object (nested allowed)
Abstract: Off-grid
```

Only embodied objects appear in cell occupancy.

### Object IDs

Deterministic from turn seed. 60+ bits entropy.

### Time Steps and Offsets

Time step `s`, offset `o`. Action eligible when `(turn - o) mod s = 0`. All phases run every turn regardless. Component systems run every turn. Only action submission gated.

**Fast AI, slow human**: `s=1` (500ms) vs `s=10` (5s). **Alternating play**: `s=2`, offset 0 vs 1. **Mixed cadences**: Chess at `s=10` alongside snakes at `s=1`.

Cooldowns and action points via resource costs.

### Player Objects

Abstract objects. Owned object set, resources, team membership. Non-localized ActionTypes attach to Player objects.

---

## 13. Object Lifecycle

| Category | Trigger | Phase | Behaviour |
|----------|---------|-------|-----------|
| Devoured | Lose movement contest | Move.Resolve (5) | OnDevoured |
| Collision | Tie | Move.Resolve (5) | OnCollision |
| Self-Destruct (commit) | Null bid | Move.Resolve (5) | OnSelfDestruct |
| Self-Destruct (react) | Move.React destruction | Move.React (6) | OnSelfDestruct |
| Death | Health below threshold | Death Resolution (13) | OnDeath |

**OnDeath**: Drop loot bag, drop new instance, recursive destroy, or lose embodiment. Cannot emit MutationRequests — deliberate constraint against cascading death. Dropped effect objects activate following turn.

**Death**: May persist (spirit realm). Enters Graveyard. **Destruction**: Recursive deletion, terminal.

Component Systems have no cleanup hooks — stateless function of component state each turn.

---

## 14. Design Patterns

### Snake (Composite Movement)
Abstract composite parent, embodied head/body/tail. Full-commit head bid, body follows. Move.React: head loss → self-destruct all; severing → self-destruct disconnected parts. Growth via mass exceeding length.

### Baneling (Explosive Payload)
OnDevoured/OnCollision/OnDeath: Drop ExplosiveSpore. Spore emits AOE damage during Mutation.Initiative. Movement-death spores act same turn; mutation-death spores act next turn.

### Brawler (Collision Survival)
OnCollision: Drop self. Stun Component System → stunned state. Next turn bids out. Collision self-destructs turn n+1.

### Poisonous Creature
OnDevoured: Drop PoisonSpore (DOT from within). Poison only triggers when eaten.

### Potion of (In)vulnerability
OnDevoured: Drop VulnerabilitySpore. Applies Vulnerability to collector (up to 3 turns), Invulnerability to allies (up to 3 turns). Vulnerable snakes lose all collisions; invulnerable snakes win all, severing targets. Both end on any vulnerable collision. Forces cooperation.

### Chess (Composite Army)
Abstract general, mass 1000 pieces, hold default 500. Multi-argument ActionType: piece → filtered cell → optional promotion. Castling via composite bidding. Pawn promotion: instantiate + bid + self-destruct. En passant: 500-mass temp → tie → mutual destruction. Alternating via `s=2, o=0/1`.

### Push/Swarm Battles
Equal-mass units. Diplomacy-style ally push. Surrounding blocks escapes. Heavy units vs coordinated light.

### Block Pushing
Default movement "accept pushes, else hold." Player allocates push mass.

---

## 15. Data Structures

Double-indexed maps (objects ↔ cells) for O(1) access. Sparse cell representation. Fog of war via RLE. Deterministic randomness from turn seed (backend secret).

---

## 16. SpacetimeDB Game State Schema

### Tables

**objects** (public, RLS-filtered per team):
`id` (PK), `objectType`, `spatialState`, `containedBy`, `compositeParent`, `controller`, `x`, `y`, `mass`, `availableMass`, `timeStep`, `timeStepOffset`

**components** (public, RLS-filtered):
`objectId`, `componentType`, `state` (serialized)

**staged_actions** (RLS-filtered per team):
`objectId` (PK), `actionType`, `actionPayload` (serialized — format TBD, see Section 5), `stagedBy` (Identity), `stagedAt`

**team_membership** (public):
`teamId`, `memberIdentity`

**game_config** (public):
Static game configuration JSON

**turn_state** (public):
`turn`, `nextResolveAt`

**events** (transient event table):
Movement events, mutation events, graveyard entries

### Scheduled Reducer

```typescript
export const resolveTurn = spacetimedb.reducer({}, (ctx) => {
  // Read staged_actions for all objects
  // Validate each action against fog-filtered board state (mechanism TBD, see Section 5)
  // Run 15-phase pipeline
  // Write updated objects, components
  // Emit events
  // Clear staged_actions
  // Schedule next turn
  // Trigger replay snapshot procedure
});
```

Entire pipeline runs as a single ACID transaction.

---

## 17. Scoring Rules

One scoring rule per game. Pure function at game end:

```typescript
type ScoringRule = {
  dependencies: ComponentTypeId[];
  evaluate: (player: PlayerObject, queries: ComponentQuerySet) => number;
};
```

---

## 18. Configuration and Extensibility

### Adding New Component Systems
Define schema, initialization, validation, resolution, receipt semantics, death listeners. Register with dependencies. No modification to existing code.

### Adding New ObjectTypes (Data-Driven)
Select Components and initial state, select ActionTypes, define default movement, select event behaviours from repertoire.

**MVP constraint**: Game type specifications are authored manually as JSON. A no-code GUI for game configuration is a post-MVP feature.

### Adding New ActionTypes
Declare Component dependencies. Define resource costs, death listeners, MutationRequests, Finality callback, Death Reaction callback. The mechanism for argument provision and validation is an open question (see Section 5).

---

## 19. Replays

Full state snapshots posted to platform Convex after each turn via SpacetimeDB procedure. Self-contained JSON — no version coupling.

Includes: per-turn game state, per-turn events, game configuration, final scores/outcome. Replayable without engine running.

---

## 20. Open Questions

1. **Game Instance Lifecycle**: Programmatic creation/teardown of transient SpacetimeDB databases from platform Convex.

2. **Event Streaming for Animations**: Event schema beyond graveyard and movement events.

3. **Validation Failure Messages**: Human-readable feedback for invalid action submissions.

4. **Component System Registration API**: TypeScript interface definitions and registration mechanics.

5. **Cross-Game Component Compatibility**: Versioning when Component Systems evolve.

6. **SpacetimeDB Procedure Beta Status**: Replay posting dependency. Fallback: external subscriber service.

7. **ActionType Argument System**: How ActionTypes receive argument values from both humans and bots — including the GUI model, bot enumeration mechanism, validation expression, and staged action wire format. This is the primary open design question for the next iteration (see Section 5).
