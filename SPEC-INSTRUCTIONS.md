# Modular Specification Development Instructions

## Purpose

This document governs how the Team Snek Centaur Platform specification is authored across multiple chat sessions. It defines the module structure, dependency graph, authoring phases, and the rules for how context is managed when working on each module.

**Source precedence (authoritative order, highest first)**:

1. **Completed formal module content** — requirements, design, and exported interfaces in the nine spec modules once authored. A formal module section, once written and human-approved, supersedes anything in the informal spec that it covers.
2. **The informal specification** (`informal-spec/team-snek-centaur-platform-spec-v2.2.md`) — a draft statement of intent and the source of truth for anything not yet covered by formal module content. The formal modules are being extracted from and refined out of this document, and it remains the reference for behaviour and design not yet captured in a module.
3. **The general engine spec** (`general-centaur-game-engine-spec-v6.md`) — background context only, superseded by both the Team Snek informal spec and the formal modules wherever they differ. The Team Snek spec scopes the system to a single game with snake-specific mechanics, removing the general engine's ObjectType/Component System/ActionType/MutationRequest abstractions.

The informal spec is explicitly a **draft statement of intent**, not an authoritative rulebook. Where the human author and the formal module authoring process produce a different decision than what the informal spec says, the formal module wins and the informal spec is considered to have been refined in that area. The informal spec is not edited during the formal authoring process; instead, divergences are recorded as decisions in the affected module (e.g., in a resolved REVIEW item).

---

## Module Structure

The specification is decomposed into nine modules, each a separate markdown file. Every module contains three sections in fixed order:

### Section 1: Requirements

Testable behavioral assertions using "shall" language. Each requirement has a stable identifier: `{MODULE_ID}-REQ-{NNN}`. Requirements reference dependency modules' requirements by ID when traceability matters.

**Rules:**
- Requirements state *what*, never *how*.
- Every requirement must be testable — either by automated test, manual verification, or inspection.
- Requirements must not reference implementation artifacts (table names, reducer names, specific libraries). They reference domain concepts defined in dependency modules.
- Negative requirements ("the system shall not...") are encouraged where boundaries matter.
- Where a requirement has preconditions, state them explicitly.

### Section 2: Design

Implementation decisions, algorithms, schemas, data structures, rationale for choices. This is the technical specification.

**Rules:**
- Every design decision must trace to one or more requirements it satisfies (by ID).
- Design sections may reference dependency modules' **Exported Interfaces** freely.
- Design sections must never reference peer or downstream modules' internals.
- Rationale should be included for non-obvious decisions — especially where alternatives were considered and rejected.
- TypeScript type definitions, table schemas, and algorithm pseudocode belong here.

### Section 3: Exported Interfaces

The coupling surface other modules consume. Schemas, type signatures, function signatures, invariant guarantees. This section is the **contract** — changing it has downstream impact.

**Rules:**
- Exported interfaces must be minimal. Only export what downstream modules actually need.
- Every exported interface element should state which requirement(s) motivate its existence.
- Exported interfaces are versioned implicitly by the module file's git history. Breaking changes require reviewing all downstream modules.

---

## Module Dependency Graph

```
01-game-rules
 ↑
02-platform-architecture ← 01
 ↑
03-auth-and-identity ← 02
 ↑           ↑
 │           │
04-stdb-engine ← 01, 02, 03
05-convex-platform ← 02, 03
06-centaur-state ← 02
 ↑
07-bot-framework ← 01, 06
 ↑
08-centaur-server-app ← 05, 06, 07
09-platform-ui ← 04, 05
```

### Dependency Table

| Module | File | Dependencies |
|--------|------|-------------|
| 01 | `specs/01-game-rules.md` | None |
| 02 | `specs/02-platform-architecture.md` | 01 |
| 03 | `specs/03-auth-and-identity.md` | 02 |
| 04 | `specs/04-stdb-engine.md` | 01, 02, 03 |
| 05 | `specs/05-convex-platform.md` | 02, 03 |
| 06 | `specs/06-centaur-state.md` | 02 |
| 07 | `specs/07-bot-framework.md` | 01, 06 |
| 08 | `specs/08-centaur-server-app.md` | 05, 06, 07 |
| 09 | `specs/09-platform-ui.md` | 04, 05 |

### Module Scope Summaries

**01-game-rules**: Domain model and game behavior. Defines the shared type vocabulary (snake state shape, item types, direction enum, cell types, board geometry, effect types) and all game rules: board construction (sizes, wall border, hazards, fertile tiles, starting positions, parity constraint), snake movement and growth, collision detection with invulnerability modifiers, severing, health, starvation, hazard damage, food and potion mechanics, the interaction definition (closed set), effect immutability principle, turn resolution phases 1–11 in full, win conditions, spawning algorithms, chess timer semantics. This module defines game behavior with no reference to storage, networking, or UI. Its exported interfaces include the domain type definitions that all other modules reference. Corresponds to informal spec Sections 4, 5.

**02-platform-architecture**: Three-runtime topology (SpacetimeDB, Convex, Centaur Server). What each runtime is responsible for. Data ownership boundaries. Shared engine codebase: what it exports, who consumes it. Principles: SpacetimeDB is transient per-game; Convex is persistent; selection discipline lives in Convex not SpacetimeDB; last-write-wins for move staging. Centaur Server is a framework teams must use, with extension points limited to Drive/Preference implementations and optional UI customization. The boundary between the Game Platform (Svelte app for cross-team concerns) and the Centaur Server web application (team-internal competitive operation). Corresponds to informal spec Section 2.

**03-auth-and-identity**: Three identity types (human, Centaur Server, game participant). Google OAuth for humans. Challenge-callback protocol for Centaur Servers. JWT/HMAC infrastructure for admission tickets. Move staging permissions scoped to team membership. How identities map across Convex and SpacetimeDB. Spectator read-only admission tickets. Corresponds to informal spec Section 3.

**04-stdb-engine**: SpacetimeDB schema (static tables, turn-keyed append-only tables, mutable working tables). Reducer definitions (initialize_game, register, stage_move, declare_turn_over, resolve_turn). RLS rules for snake invisibility. Chess timer implementation within SpacetimeDB. Turn resolution as a single ACID transaction. Subscription query patterns. Client query patterns for current board, history scrubbing, animation. The append-only log structure enabling replay without per-turn posting. Turn event schema (closed enumeration of event types and payloads, including `stagedBy` capture in `snake_moved`). Corresponds to informal spec Sections 10, 14.

**05-convex-platform**: Platform-wide Convex schema (users, rooms, games, centaur_teams, centaur_servers, centaur_team_members, game_teams, replays, api_keys, webhooks). Game lifecycle orchestration (provisioning SpacetimeDB instances, seeding, teardown). HTTP API endpoints (Bearer-token auth via API keys, CRUD for teams/rooms/games, webhook registration). Webhook delivery with game_start/game_end events. Replay data flow (how Convex reads the SpacetimeDB log at game end). Room and game configuration. Game configuration parameter table with types, defaults, and ranges. Tournament mode lifecycle. Corresponds to informal spec Sections 9, 11 (platform-wide tables), 12, 13.1.

**06-centaur-state**: Convex tables for the Centaur subsystem: snake_config, snake_drives, heuristic_config, snake_heuristic_overrides, bot_params, centaur_action_log (unified discriminated union with enumerated action types). Opinionated Convex function contracts enforcing selection invariants (at most one operator per snake, at most one snake per operator). Drive management mutations. The data contract between bot framework, Centaur Server web application, and the action log schema enabling sub-turn replay reconstruction. All Centaur parameter configuration (heuristic defaults, bot parameters) is written by the Centaur Server web application — not by the Game Platform. Corresponds to informal spec Section 11 (centaur-specific tables).

**07-bot-framework**: Drive\<T\> and Preference type signatures. Target types (Snake, Cell). Portfolio model (weights, defaults, per-snake overrides). Heuristic configuration initialization from global defaults at game start. Candidate direction enumeration. Game tree cache: structure, three reactive inputs (interest map, commitment state, portfolio weights), active/dormant branch toggling. Dijkstra-on-lattice foreign combination traversal. Scoring with cached normalized outputs and cheap weight rescanning. Anytime submission pipeline (round-robin, 100ms interval, dirty flags). Softmax decision. Compute scheduling (automatic > selected-manual > unselected-manual). Human-selection rerun. The API contract that Drive/Preference authors program against. Corresponds to informal spec Section 6.

**08-centaur-server-app**: The full Centaur Server web application served to team operators. Multi-page application with navigation. Pages: heuristic config (persistent defaults for Drives and Preferences), bot parameters (temperature, operator mode, time allocations), game history (list of completed games), team replay viewer (read-only operator interface with sub-turn timeline scrubbing, data source abstraction for live vs replay, invisible viewer selection). Live operator interface: header layout, board display, snake selection model, move interface, manual mode toggle, Drive management UX (targeting modes, Tab cycling, eligibility filtering), worst-case world preview, decision breakdown table, operator modes (Centaur vs Automatic), timekeeper controls. Corresponds to informal spec Sections 7, 13.3.

**09-platform-ui**: The Game Platform Svelte web application. Home/navigation, team management (identity, server registration, member management — no bot/heuristic configuration), room browser and creation, room lobby (game config, ready check, board preview), live spectating (SpacetimeDB subscription with read-only admission ticket, scoreboard, timeline scrubber), platform replay viewer (turn-level board state, event log, timeline scrubber), player profiles, team profiles, leaderboard. Corresponds to informal spec Sections 8, 13.2.

---

## Authoring Phases

Each module passes through two phases sequentially. A module's Phase 1 must be complete before its Phase 2 begins. Modules should be authored in dependency order — a module's phase cannot begin until all its dependencies have completed that same phase.

### Phase 1: Requirements

Write the Requirements section. This phase defines *what* the module must do.

**Inputs available to the agent:**
- The informal spec (`informal-spec/team-snek-centaur-platform-spec-v2.2.md`) — full document
- All dependency modules — full files (whatever sections are complete)
- This instructions document

**Process:**
1. Extract behavioral requirements from the informal spec's coverage of this module's scope.
2. Assign stable IDs: `{MODULE_ID}-REQ-{NNN}` (e.g., `01-REQ-017`).
3. Ensure every requirement is testable.
4. Trace upstream: where a requirement derives from or depends on a dependency module's requirement, note the dependency by ID.
5. Identify requirements that are implicit in the informal spec but not explicitly stated — flag these for review.
6. Identify ambiguities or contradictions in the informal spec — flag these as **REVIEW** items at the end of the Requirements section rather than silently resolving them.

**Completion criteria:**
- All behavioral content from the informal spec relevant to this module's scope has been captured as requirements.
- No requirement references implementation artifacts.
- All REVIEW items have been explicitly listed.
- The author (human) has reviewed and approved.

### Phase 2: Design + Exported Interfaces

Write the Design and Exported Interfaces sections. This phase defines *how* the module satisfies its requirements and *what contract* it exposes.

**Inputs available to the agent:**
- The informal spec — full document
- This module's completed Requirements section
- All dependency modules — full files (all three sections, since dependencies are fully complete)
- This instructions document

**The agent must NOT load** peer or downstream modules. If the agent needs to know what a downstream module expects, that expectation should be captured as a requirement in the current module or negotiated by the human across modules.

**Process:**
1. For each requirement (or logical group of requirements), write the design that satisfies it. Cite requirement IDs.
2. Define schemas, type signatures, algorithms, and data structures.
3. State rationale for non-obvious decisions.
4. Extract the minimal exported interfaces that downstream modules will need.
5. For each exported interface element, note which requirement(s) motivate it.
6. Identify design decisions that constrain downstream modules — flag these as **DOWNSTREAM IMPACT** notes.

**Completion criteria:**
- Every requirement has at least one design element that satisfies it.
- All exported interfaces are defined with TypeScript type signatures or schema definitions.
- No design element references peer or downstream module internals.
- DOWNSTREAM IMPACT notes have been reviewed by the human.

---

## Context Management Rules

These rules govern what the AI agent should have loaded in context when working on a given module. The goal is to keep context focused and within the agent's effective attention budget.

### Rule 1: Always Load

Every session loads:
- This instructions document (`SPEC-INSTRUCTIONS.md`)
- The informal spec (`informal-spec/team-snek-centaur-platform-spec-v2.2.md`)

### Rule 2: Dependency Loading

When working on module X:
- Load all of X's **direct** dependency modules in full.
- For **transitive** dependencies (dependencies of dependencies), load only the **Exported Interfaces** section unless the agent requests more context for a specific question.

Example: when working on module 08 (centaur-server-app), load:
- 05-convex-platform (direct dependency) — full file
- 06-centaur-state (direct dependency) — full file
- 07-bot-framework (direct dependency) — full file
- 01-game-rules (transitive via 07) — Exported Interfaces only
- 02-platform-architecture (transitive via 05, 06) — Exported Interfaces only
- 03-auth-and-identity (transitive via 05) — Exported Interfaces only

### Rule 3: No Downstream Loading

Never load modules that depend on the current module. The agent must design against the current module's own requirements, not against assumptions about what downstream modules will need. If a design decision in the current module will constrain downstream modules, note it as a DOWNSTREAM IMPACT item for the human to propagate.

### Rule 4: Phase-Appropriate Loading

During Phase 1 (Requirements) of module X:
- Dependency modules may be at any stage of completion. Load whatever exists.
- The agent should note if a dependency's requirements are not yet written, as this may leave gaps in traceability.

During Phase 2 (Design) of module X:
- All dependency modules must have completed both phases. Load full files.
- If a dependency is not yet complete, stop and flag this as a blocker.

### Rule 5: Informal Spec as Starting Point, Formal Modules as Binding

During Phase 1, the informal spec is the starting point for extraction — requirements are *derived from* it rather than invented. However, the informal spec is a draft statement of intent, not an authoritative rulebook. If the agent encounters an ambiguity, contradiction, or apparent gap, it must flag this as a REVIEW item rather than silently resolving it; the human's resolution may confirm, refine, or diverge from the informal spec's language, and the formal module's text is what binds going forward.

Additions beyond what the informal spec says must be flagged as **Proposed Addition** REVIEW items for the human to evaluate — not silently included.

Completed formal module content supersedes the informal spec for anything it covers. When authoring module X and referencing dependency module Y, Y's completed sections are authoritative over any corresponding informal spec language. The informal spec remains the reference for behaviour and design not yet captured in any module.

During Phase 2, the informal spec provides design guidance and can be referenced for implementation details, but the module's own Requirements section is now the binding contract the design must satisfy.

---

## Authoring Order

The dependency graph constrains the order. Within those constraints, the recommended sequence is:

### Phase 1 (Requirements) Pass

1. **01-game-rules** — Largest module. The behavioral core plus domain model.
2. **02-platform-architecture** — Architectural principles and boundaries.
3. **03-auth-and-identity** — Can proceed once 02 is done.
4. **04-stdb-engine**, **05-convex-platform**, **06-centaur-state** — These three are independent of each other and can be done in any order (or in parallel across sessions). All require 02; 04 and 05 also require 03.
5. **07-bot-framework** — Requires 01 and 06.
6. **08-centaur-server-app**, **09-platform-ui** — Independent of each other. 08 requires 05, 06, and 07. 09 requires 04 and 05.

### Phase 2 (Design + Exported Interfaces) Pass

Same dependency-respecting order. However, there is a critical sequencing concern:

**06-centaur-state should be designed before 04 and 05** even though it doesn't depend on them. Module 06 defines the Convex schema that the Centaur Server app (08) and bot framework (07) consume. Getting its exported interfaces locked down early prevents rework. Modules 04 and 05 don't depend on 06 but benefit from knowing its schema shape to avoid redundancy or conflict in the Convex schema design.

Recommended Phase 2 order:
1. 01
2. 02
3. 03
4. **06** (before 04 and 05)
5. 04, 05 (either order)
6. 07
7. 08, 09 (either order)

---

## Cross-Cutting Concerns

### Game Lifecycle Orchestration

The provisioning, seeding, and teardown of SpacetimeDB instances is a collaboration between modules 04 and 05. Module 04 exports the `initialize_game` reducer signature. Module 05's design consumes it. Neither module owns the full lifecycle alone. Handle this by:
- Module 04 exports `initialize_game`'s expected parameters as an interface.
- Module 05's design describes the orchestration sequence referencing 04's exported interface.
- Both modules' requirements include their respective lifecycle obligations.

### Shared Engine Codebase

The turn resolution logic, move validation, and game state types are shared across SpacetimeDB module, Centaur Server, and web client. Module 01 defines the behavioral requirements. Module 04 defines how they're implemented authoritatively in SpacetimeDB. Module 07 defines how the bot framework uses them for simulation. The shared codebase itself is an implementation concern, not a spec module — but module 02's requirements should include the principle that a single TypeScript codebase is shared, and its exported interfaces should define what that codebase exports.

### Convex Schema Partitioning

Modules 05 and 06 both define Convex tables. Module 05 owns platform-wide tables. Module 06 owns Centaur-subsystem tables. The Convex schema is a single deployment artifact, so these must be compatible. Handle this by:
- Each module's exported interfaces include its table schemas.
- During Phase 2, when authoring 05 after 06 (per recommended order), the agent should load 06's exported interfaces to verify no naming collisions or structural conflicts.
- This is an **exception** to Rule 3 (no downstream loading) — when authoring 05, load 06's Exported Interfaces section only. This is justified because they share a deployment artifact.

### Replay System

The replay system spans four modules:
- **04** defines the SpacetimeDB append-only log schema that constitutes the game state record.
- **05** defines how Convex reads and stores the log at game end (informal spec Section 13.1), and hosts the `replays` table.
- **06** defines the `centaur_action_log` schema that provides sub-turn Centaur experience data for team replays.
- **08** implements the team replay viewer (informal spec Section 13.3), consuming both the game log (via 05's replay query interface) and the action log (via 06's exported interfaces).
- **09** implements the platform replay viewer (informal spec Section 13.2), consuming only the game log (via 05).

### Game Platform vs Centaur Server Boundary

The Game Platform (module 09) handles cross-team concerns: team identity, room management, game configuration, spectating, platform-level replay viewing, profiles, and leaderboards. The Centaur Server web application (module 08) handles team-internal competitive operation: heuristic configuration, bot parameters, live gameplay, and team replay with sub-turn resolution. Bot parameters, heuristic configuration, and Drive management are exclusively Centaur Server affordances — the Game Platform does not provide UI for these. The team management page on the Game Platform (informal spec Section 8.2) is limited to identity, server registration, and member management.

---

## Session Initiation Protocol

At the start of each chat session working on a spec module, provide the agent with the following structured prompt:

```
We are working on the Team Snek Centaur Platform specification.

**Current task**: [Phase 1 | Phase 2] of module [XX-module-name]
**Module scope**: [one-line summary from Module Scope Summaries above]

Please read:
- SPEC-INSTRUCTIONS.md (this document — already in project context)
- team-snek-centaur-platform-spec-v2.2.md (informal spec — already in project context)
- [List specific dependency module files to load, per Context Management Rules]

Do not load or reference modules: [list peer/downstream modules to exclude]

[Any specific focus areas, open questions, or REVIEW items to address]
```

---

## REVIEW Item Format

When the agent identifies ambiguities, contradictions, or gaps during authoring, it records them in a **REVIEW** section at the end of the relevant module section. Each item uses the following format when first raised:

```markdown
## REVIEW Items

### [MODULE_ID]-REVIEW-[NNN]: [Short title]
**Type**: Ambiguity | Contradiction | Gap | Proposed Addition
**Context**: [What the agent was trying to specify when it encountered this]
**Question**: [The specific question that needs human resolution]
**Options** (if applicable):
- A: [first interpretation/option]
- B: [second interpretation/option]
**Informal spec reference**: [Section/paragraph in the informal spec, if applicable]
```

### Resolution

REVIEW items are resolved by the human before the module's phase is considered complete. When a REVIEW item is resolved:

1. **Update any affected requirement or design text** in the body of the module to reflect the decision. Where the updated text exists *because* it resolves an ambiguity, it is acceptable to reference the originating REVIEW item inline (e.g., "See resolved [MODULE_ID]-REVIEW-NNN for rationale").
2. **Preserve the original REVIEW entry** (Type, Context, Question, Options, Informal spec reference) in place, appending a status marker to the heading and a **Decision** / **Rationale** block beneath. Do **not** strip the original Context/Question/Options — they are the record of *what question was asked*, which is what makes the decision legible to future readers (human or agent) and prevents well-intentioned regression of settled calls.

The resolved form looks like this:

```markdown
### [MODULE_ID]-REVIEW-[NNN]: [Short title] — **RESOLVED**

**Type**: Ambiguity | Contradiction | Gap | Proposed Addition
**Context**: [unchanged]
**Question**: [unchanged]
**Options**:
- A: [unchanged]
- B: [unchanged]
**Informal spec reference**: [unchanged]

**Decision**: [Which option was chosen, or a custom resolution if none of the options fit cleanly.]
**Rationale**: [Why. Include any considerations that would help a future reader judge whether the decision still applies if circumstances change — e.g., "this assumes invuln_debuff is only acquired via potion collection; if a future rule change introduces another source, revisit."]
**Affected requirements/design elements**: [IDs of items updated as part of this resolution, if any.]
```

This approach is chosen over simply deleting resolved items because:

- **Decision provenance**: A reader of the updated requirement text can trace back to the question that motivated it.
- **Regression prevention**: A future editor who thinks a clarifying sentence in a requirement looks "over-specified" can see it exists to close a specific ambiguity, and won't silently strip it.
- **Distinguishing load-bearing from descriptive text**: Marking decisions explicitly tells readers which requirement phrasing is doing active work.
- **Consistency fuel**: Related future questions can reference the reasoning used on earlier ones.

If the resolved-REVIEW list within a module grows unwieldy over time, resolved entries may be migrated out to a separate decision log (e.g., `specs/00-decision-log.md`) once the module's phase is complete. Until such a log exists, resolved items stay inline.

---

## File Layout

```
project-root/
├── SPEC-INSTRUCTIONS.md          ← this document
├── informal-spec/
│   └── team-snek-centaur-platform-spec-v2.2.md  ← informal spec (source material)
├── general-centaur-game-engine-spec-v6.md   ← background context (superseded)
└── specs/
    ├── 01-game-rules.md
    ├── 02-platform-architecture.md
    ├── 03-auth-and-identity.md
    ├── 04-stdb-engine.md
    ├── 05-convex-platform.md
    ├── 06-centaur-state.md
    ├── 07-bot-framework.md
    ├── 08-centaur-server-app.md
    └── 09-platform-ui.md
```

---

## Conventions

- **Requirement IDs** are never reused. If a requirement is deleted, its ID is retired.
- **Module IDs** use the two-digit prefix (01 through 09).
- **TypeScript** is the language for all type signatures and schema definitions in exported interfaces.
- **Markdown headers** use `##` for the three main sections (Requirements, Design, Exported Interfaces) and `###` for subsections within them.
- **Tables** are preferred over prose for enumerating configuration parameters, event types, and similar structured data.
- **Cross-references** between modules use the format `[MODULE_ID]` (e.g., "see [01] for collision semantics") rather than markdown links, since the agent may not have the referenced file loaded.
- **Informal spec section references** use the format `(informal spec Section X.Y)` to trace back to source material.
