# Module 05: Convex Platform

## Requirements

### 5.1 Scope and Schema Partitioning

**05-REQ-001**: This module shall own the platform-wide portion of the single Convex deployment required by [02-REQ-002]. Platform-wide state comprises user accounts, API keys, Centaur Teams and their members, rooms, games, per-game team snapshots, persisted replays, and webhook subscriptions. Centaur-subsystem state (per-team Drive configuration, per-team heuristic configuration, bot parameters, per-snake live state, sub-turn action log) is owned by [06] and is outside the scope of this module.

**05-REQ-002** *(negative)*: The Convex platform runtime shall not store any state whose authoritative home is the SpacetimeDB game runtime, except for the complete post-game replay record imported under [05-REQ-040]. In particular, while a game is in progress Convex shall not hold a mirror of the SpacetimeDB turn log, staged moves, per-turn snake states, or any other transient game-runtime state.

**05-REQ-003**: The platform-wide schema and the Centaur-subsystem schema owned by [06] shall share a single Convex deployment artifact. This module's schema definitions shall not collide with [06]'s either in table names or in the meaning of shared identifier fields.

---

### 5.2 User Records and Human Identity

**05-REQ-004**: Convex shall maintain a persistent record of every distinct human identity ([03-REQ-002]) that has successfully completed Google OAuth against the platform. Each user record shall capture at minimum the canonical email address (per [03-REQ-008]), a display name, and the timestamp of the identity's first successful authentication.

**05-REQ-005**: A user record shall be created at the moment a Google OAuth authentication yields an email address for which no user record exists. A user record shall never be mutated such that its canonical email address changes; an email change at Google produces a distinct user record per [03-REQ-008].

**05-REQ-006**: The user record shall be the anchor against which all Convex-side human-identity authorization, Centaur Team membership ([05-REQ-011]), API key ownership ([05-REQ-046]), admin role ([05-REQ-065]), and historical action attribution is resolved.

**05-REQ-007** *(negative)*: Convex shall not delete user records in response to loss of access to a Google account, nor shall it merge two user records with distinct canonical email addresses. Historical attribution remains anchored to the original email per [03-REQ-047].

---

### 5.3 Centaur Teams and Members

**05-REQ-008**: Convex shall maintain a persistent record of every Centaur Team. Each Centaur Team record shall capture at minimum a team name, a display colour, the user record of the current Captain, and a nullable `nominatedServerDomain` string field identifying the domain of the Snek Centaur Server the team has nominated for game participation.

**05-REQ-009**: Convex shall record the latest healthcheck status and timestamp for each Centaur Team's nominated server domain ([02-REQ-029]). The healthcheck status shall be queryable by team members and by any authenticated user viewing the team's profile. The healthcheck may be triggered on demand by team members or by the Room Lobby view. Convex shall not be required to poll server health automatically; on-demand and game-start-time checks are sufficient.

**05-REQ-011**: Convex shall maintain a persistent record of Centaur Team membership associating each human member (an Operator) with the Centaur Team. Every team member is an Operator. Captain designation is not a per-member role but a structural property of the team itself: the `centaur_teams` record's `captainUserId` field identifies the unique Captain.

**05-REQ-012**: Convex shall permit the Captain of a Centaur Team to add and remove human members from the team, and to transfer the Captain designation to another current team member (by updating `captainUserId`). The Captain holds all team-level operator authorities, including turn submission per [06]. (Per-operator ready-state toggling per [06-REQ-040b] is *not* a Captain-only authority — every operator toggles their own ready-state; see resolved 08-REVIEW-011.) These mutations shall be subject to the mid-game freeze of [03-REQ-046].

**05-REQ-013** *(negative)*: Convex shall reject any mutation to a Centaur Team's membership or Captain assignment while that team is participating in a game whose status is `playing`, consistent with [03-REQ-046]. During a tournament, this freeze extends for the entire tournament lifetime per [05-REQ-064].

**05-REQ-014**: Convex shall permit the Captain of a Centaur Team to set or update the team's `nominatedServerDomain`. Setting the domain is a simple string field update. Domain validity is verified implicitly at game start when Convex POSTs a game invitation to the domain (see [05-REQ-032b]). The `nominatedServerDomain` shall not be changed while the team is participating in a game whose status is `playing`.

**05-REQ-015**: Convex shall permit the Captain to clear a Centaur Team's `nominatedServerDomain`, setting it to null. A team with a null `nominatedServerDomain` cannot participate in a game.

**05-REQ-015a**: Convex shall not permit the deletion of a Centaur Team. Instead, the Captain may archive a Centaur Team by setting its `archived` flag to true, provided the team has no game in the `playing` status and is not participating in an active tournament. Archived teams are hidden from default listings and cannot be enrolled in new games, but all live and historical state — including team membership entries, team-scoped Centaur state owned by [06], and historical game records — is preserved. Historical game records that reference an archived team shall continue to resolve the team's historical identity for attribution purposes. An archived team may be unarchived by its Captain (or an admin) to resume activity. *(See resolved 05-REVIEW-011.)*

---

### 5.4 Rooms

**05-REQ-016**: Convex shall maintain a persistent record of every Room. Each room record shall capture at minimum a room name, an optional owner (a user record), a reference to the room's current game if one exists, the set of Centaur Teams currently enrolled in the room, and an archived flag. Rooms do not hold game-configuration state; all configuration lives on the game object per [05-REQ-024]. *(See resolved 05-REVIEW-008.)*

**05-REQ-017**: A room's owner shall have administrative control over the room: enrolled teams, game start, and configuration of the room's current not-started game. When a room has no owner, any authenticated human identity with access to the room shall hold equivalent administrative control.

**05-REQ-018**: A room's owner shall be able to abdicate ownership, after which the room enters the no-owner state described in [05-REQ-017]. Ownership abdication shall be irreversible within a given room: once abdicated, the platform shall not reassign ownership of that room to any user.

**05-REQ-019**: Convex shall permit authenticated humans to create a room. The creating user shall become the room's owner on creation. Room creation shall also create an initial `not-started` game in the room with default configuration parameter values per [05-REQ-023]. *(See resolved 05-REVIEW-008.)*

**05-REQ-020**: A room shall require at least two enrolled Centaur Teams before its current game can transition from `not-started` to `playing` ([05-REQ-027]).

**05-REQ-021**: A room's lifetime shall be independent of the lifetimes of the games hosted within it. A room shall persist indefinitely; there is no deletion path. Instead, an authorized actor may archive a room by setting its `archived` flag to true. Archived rooms are excluded from default listings but preserve all historical games, replays, and action logs. *(See resolved 05-REVIEW-002.)*

**05-REQ-021a**: When a room is archived, no new games may be created or started in it. The room may be unarchived by an authorized actor (the owner, or any authenticated user if the room has no owner, or an admin) to resume activity.

---

### 5.5 Game Configuration

**05-REQ-022**: Convex shall be the sole source of truth for the configured parameter values of every game. Game configuration parameters live on the game object; rooms do not hold configuration state. At initialization time per [05-REQ-032], only `config.runtime` (a `GameRuntimeConfig` per [01] §3.3 and [05-REQ-032d]) and the pre-computed initial game state are supplied to the SpacetimeDB game instance; `config.orchestration` is consumed by Convex during board generation and is not forwarded to STDB. *(See resolved 05-REVIEW-008.)*

**05-REQ-023**: The closed set of game-configuration parameters shall be the following. The game-rules parameters are partitioned into `config.orchestration` and `config.runtime` subtrees that mirror [01]'s `GameOrchestrationConfig` and `GameRuntimeConfig` field-for-field (see [01] §3.3 and resolved [01-REVIEW-017]); platform-lifecycle parameters live as top-level fields on the game record alongside `config`. Each parameter has a type, a default, and (where applicable) an acceptable range. Convex shall reject any attempt to set a parameter to a value outside its defined range or type.

Game-rules parameters (`config` subtrees):

| Path | Type | Default | Range | Notes |
|------|------|---------|-------|-------|
| `config.orchestration.boardSize` | `BoardSize` enum | `"medium"` | `"small" \| "medium" \| "large" \| "giant"` | Domain enum owned by [01] |
| `config.orchestration.snakesPerTeam` | Integer | 5 | 1–10 | Consumed by Convex during board generation; not sent to STDB |
| `config.orchestration.hazardPercentage` | Integer | 0 | 0–30 | Consumed by Convex during board generation |
| `config.orchestration.fertileGround.density` | Integer % | 30 | 0–90 | `0` disables fertile ground ([01-REQ-069]) |
| `config.orchestration.fertileGround.clustering` | Integer | 10 | 1–20 | No effect when density is 0 |
| `config.runtime.maxHealth` | Integer | 100 | 1–500 | Starting and restored health |
| `config.runtime.maxTurns` | Integer | 100 | 0 or 1–1000 | `0` = unlimited ([01-REQ-058] / [01-REQ-066]) |
| `config.runtime.hazardDamage` | Integer | 15 | 1–100 | Health lost per turn on a hazard cell |
| `config.runtime.foodSpawnRate` | Decimal | 0.5 | 0–5 | Expected food per turn |
| `config.runtime.invulnPotionSpawnRate` | Decimal | 0.15 | 0–0.2 | `0` disables ([01-REQ-072]) |
| `config.runtime.invisPotionSpawnRate` | Decimal | 0.1 | 0–0.2 | `0` disables ([01-REQ-073]) |
| `config.runtime.clock.initialBudgetMs` | Milliseconds | 60000 | 0–600000 | Starting chess-timer budget per Centaur Team |
| `config.runtime.clock.budgetIncrementMs` | Milliseconds | 500 | 100–5000 | Added to each Centaur Team's budget each turn |
| `config.runtime.clock.firstTurnTimeMs` | Milliseconds | 60000 | 1000–300000 | Applies to turn 0 only |
| `config.runtime.clock.maxTurnTimeMs` | Milliseconds | 10000 | 100–300000 | Per-turn clock cap on turns 1+ |

Platform-lifecycle parameters (top-level columns on the `games` row, outside `config`):

| Parameter | Type | Default | Range | Notes |
|-----------|------|---------|-------|-------|
| `skipStartConfirmation` | Boolean | `false` | — | Bypasses the administrator's confirm step in game-start orchestration |
| `tournamentMode` | Boolean | `false` | — | Enables tournament fields below |
| `tournamentRounds` | Integer \| null | null | ≥ 1 when set | Required when `tournamentMode` is `true` |
| `tournamentInterludeSec` | Integer \| null | null | ≥ 0 when set | Required when `tournamentMode` is `true` |
| `scheduledStartTime` | Unix ms \| null | null | — | Required when `tournamentMode` is `true` |

Units inside `config` are milliseconds throughout, consistent with [01]'s canonical types; the UI converts to/from seconds at the editor boundary. Platform-lifecycle fields retain seconds where they describe wall-clock durations visible to administrators in seconds (`tournamentInterludeSec`), since they never cross into the engine's type system.

**05-REQ-024**: Convex shall associate a game-configuration parameter set with every game. The parameter set is editable while the game is in `not-started` status. When the game transitions to `playing`, the parameter set is frozen as an immutable snapshot for the remainder of the game's lifetime. *(See resolved 05-REVIEW-008.)*

**05-REQ-025**: Parameters whose meaning is conditional on another parameter shall be validated consistently with that condition. Within `config` (the mirrored [01].GameConfig) the "disabled" state of a feature is encoded by a zero sentinel on the dependent numeric field itself — `fertileGround.density = 0`, `foodSpawnRate = 0`, `invulnPotionSpawnRate = 0`, `invisPotionSpawnRate = 0`, or `maxTurns = 0` — so no separate gating flag needs to be validated against a dependent. `fertileGround.clustering` has no effect when `fertileGround.density` is 0; Convex shall persist any in-range clustering value regardless and the value shall simply be ignored during board generation. For platform-lifecycle fields gated by `tournamentMode`: when `tournamentMode` is `false`, Convex shall persist any in-range values of `tournamentRounds`, `tournamentInterludeSec`, and `scheduledStartTime` and the orchestration shall not act on them. See resolved [01-REVIEW-017].

**05-REQ-026** *(negative)*: The game-configuration parameter set shall not include any parameter that configures bot behaviour, heuristic defaults, or Drive management. Such parameters are owned by [06] and by the Snek Centaur Server web application per [02-REQ-045] through [02-REQ-047].

---

### 5.6 Games and Game Lifecycle Orchestration

**05-REQ-027**: Convex shall maintain a persistent record of every game. Each game record shall capture at minimum the game's room, the bound parameter snapshot ([05-REQ-024]), a status value from the closed set `{ not-started, playing, finished }`, a reference to its SpacetimeDB instance (per [05-REQ-032]), the final outcome and scores (populated at game end per [05-REQ-038]), and the timestamps at which the game entered the `playing` and `finished` states.

**05-REQ-028**: Convex shall be the sole authority for every game's status value. Transitions shall be: `not-started → playing` (on successful provisioning, seeding, and invitation acceptance per [05-REQ-032] and [05-REQ-032b]), `playing → finished` (on receipt of the game's terminal state from the SpacetimeDB instance per [05-REQ-038]). No other transitions shall be permitted, except for the healthcheck-failure rollback described in [05-REQ-036].

**05-REQ-029**: Convex shall maintain, for every game, a persistent record of which Centaur Teams are participating in that game and, for each such team, a snapshot of the team's authorized human members and their roles at the moment the game was created. This snapshot shall be treated as append-only historical fact per [03-REQ-047] and shall be used by Convex to seed the SpacetimeDB instance's admission authorization state at initialization time ([03-REQ-039]).

**05-REQ-030**: The game's participating-teams snapshot shall be used, in combination with the Centaur Team records of [05-REQ-008], to determine which operators are authorized to obtain SpacetimeDB access tokens for the game, consistent with [03-REQ-024].

**05-REQ-031**: Convex shall permit the administrative actor for a room (per [05-REQ-017]) to initiate a game start when all participating Centaur Teams have declared themselves ready and the room has at least two enrolled teams. Readiness is a per-team flag on the game record, set from game creation onward; the not-started game is created eagerly to hold readiness state. Only the Captain of a Centaur Team may declare their team ready for a game; no other team member may set this flag. Ready flags are cleared whenever a new game is auto-created per [05-REQ-039]. Upon successful game start, Convex shall proceed to provisioning per [05-REQ-032]. *(See resolved 05-REVIEW-007.)*

**05-REQ-032**: On game start, Convex shall orchestrate the following sequence:

1. Freeze the game configuration ([05-REQ-024]).
2. Obtain the initial game state: if the not-yet-started game record's `boardPreviewLocked` flag is `true` ([05-REQ-032b]), reuse the starting state already persisted on the game record by the most recent preview generation; otherwise (`boardPreviewLocked` is `false`), run `generateBoardAndInitialState()` from the shared engine codebase ([02-REQ-035]) as pure TypeScript directly within a Convex mutation to produce a fresh initial game state from a fresh seed and overwrite the persisted starting state on the game record (the regenerated state is not surfaced to any configuration-mode UI; it becomes visible only when delivered to operators via SpacetimeDB once the game enters `playing` status). Bounded-retry feasibility logic ([01-REQ-061]) runs within this mutation; if all attempts fail, the mutation produces a structured `BoardGenerationFailure` error that is surfaced reactively to the administrative actor (see [05-REQ-032c]), and the orchestration does not proceed. *(See resolved 08-REVIEW-015.)*
3. Retrieve the pre-compiled WASM module binary from Convex file storage ([05-REQ-073]) and provision a fresh SpacetimeDB game instance by submitting the binary to the self-hosted SpacetimeDB management API (`POST /v1/database` with the WASM binary in the request body), authenticated per [03-REQ-048]. This single operation creates the database and deploys the game engine module.
4. Invoke the instance's privileged initialization reducer (owned by [04]) via a Convex HTTP action calling SpacetimeDB's HTTP API (`POST /v1/database/{name}/call/{reducer_name}`) with all of the following: the pre-computed initial game state (board layout, snake starting states, initial items — the output of `generateBoardAndInitialState()`), the game seed (the root seed used by `generateBoardAndInitialState()`, forwarded for turn-resolution randomness and replay export per [04]), the `config.runtime` subtree of the game record — a `GameRuntimeConfig` carrying max health, max turns, hazard damage, spawn rates, and clock parameters ([01] §3.3, resolved [01-REVIEW-017]) — the game-end notification callback URL (a Convex HTTP action endpoint for receiving game-end notifications per [04-REQ-061a]), the participating-teams snapshot ([05-REQ-029]) sufficient to populate the instance's connection authorization state per [03-REQ-039], and the game's unique identifier (for `aud` claim validation in `client_connected`). Client authentication uses OIDC-based JWT validation against the platform's public key (see [03] §3.17). A per-game **game-outcome callback token** — an RS256-signed JWT issued by Convex with `iss` = `CONVEX_SITE_URL`, `sub` = `stdb-instance:{gameId}`, `aud` = the game-end callback URL, and `exp` = 2 hours — is included in the `initialize_game` payload. The STDB module stores this token and presents it as a Bearer token when it POSTs the game-end notification (including the bundled replay data per [04-REQ-061]) back to Convex. The token is signed using the `SPACETIMEDB_SIGNING_KEY` RSA private key (or a dedicated callback-token key pair if operationally preferred). Convex validates incoming callbacks by verifying the JWT signature against its own key and checking the claims (`iss`, `sub`, `aud`, `exp`). *(See resolved 05-REVIEW-015.)*
5. Send game invitations to each participating Centaur Team's nominated server domain (per [03]). Each invitation must be accepted within **10 seconds**; if any server rejects the invitation or fails to respond within the timeout, the game-start orchestration fails and the game returns to `not-started` status with an error indicating which server(s) declined or timed out per [03-REQ-056]. *(See resolved 05-REVIEW-013.)*
6. Upon acceptance by all servers, initialize Centaur subsystem state for each participating team by calling `initializeGameCentaurState()` from [06] for each team, update the game record with the instance URL, and transition the game's status to `playing`.

Successful completion of this sequence shall transition the game's status to `playing`.

**05-REQ-032a**: Convex's interactions with the SpacetimeDB hosting platform and with a provisioned instance during the orchestration of [05-REQ-032] shall be authenticated per [03-REQ-048]. As part of the same orchestration, Convex shall register itself as a subscriber to the provisioned instance's game-end notification mechanism ([04-REQ-061a]) no later than the successful completion of that orchestration. The game-outcome callback token and callback URL included in the `initialize_game` payload (05-REQ-032 step 4) serve as the registration — the STDB module stores these values and uses them to POST the game-end notification (with bundled replay data) to Convex when a terminal outcome is detected. Convex does not persist the callback token in its own database; it validates the token on receipt by JWT signature verification and claims checking. *(See resolved 05-REVIEW-015.)*

**05-REQ-032b**: Convex shall provide a **board-generation preview mutation**. When the administrative actor edits board-affecting configuration parameters on the current not-started game (board dimensions, hazard %, fertile ground density/clustering, snake count per team, or any other parameter that is an input to `generateBoardAndInitialState()`), a Convex mutation shall re-run `generateBoardAndInitialState()` from the shared engine codebase ([02-REQ-035]) as pure TypeScript to produce a board preview. This mutation runs bounded-retry feasibility logic ([01-REQ-061]) and produces either a valid board state or a structured `BoardGenerationFailure` error ([01] Section 3.6) surfaced reactively to the web client via Convex's reactive query model. **The board preview is persisted on the game record on every regeneration** — every successful run of the preview mutation overwrites the starting state stored on the not-yet-started game record's configuration document, regardless of lock-in status. A separate `boardPreviewLocked: boolean` flag on the same game record governs whether [05-REQ-032] step 2 reuses the persisted starting state (when `true`) or regenerates from a fresh seed at game-launch initiation (when `false`, in which case the regenerated state is also persisted onto the game record but is not surfaced to any configuration-mode UI). The administrative actor may:
- **Lock in** the current preview by setting `boardPreviewLocked = true` (via a UI affordance per [08]) so that [05-REQ-032] step 2 reuses the persisted starting state at game-launch initiation.
- **Leave it unlocked** (`boardPreviewLocked = false`), in which case [05-REQ-032] step 2 regenerates a fresh board from a fresh seed at game-launch initiation and overwrites the persisted starting state with the result; that result is not displayed to any participant until the game enters `playing` status and reaches operators via SpacetimeDB.

No STDB instance exists during config mode; the board preview is generated and persisted entirely within Convex. *(See resolved 08-REVIEW-015 and 05-REVIEW-008.)*

**05-REQ-032c**: When `generateBoardAndInitialState()` returns a `BoardGenerationFailure` (either during the preview mutation of [05-REQ-032b] or during game-start orchestration of [05-REQ-032] step 2), Convex shall surface the structured error reactively to the web client. The error shall identify which constraint failed on the final attempt (per [01-REQ-061]) so the administrative actor can modify the game configuration and re-attempt. This is the primary user-facing failure path for board-generation infeasibility — it occurs in Convex during config mode, before any STDB instance is provisioned.

**05-REQ-032d**: The game-configuration parameter set ([05-REQ-023]) is partitioned by the two subtrees of [01]'s `GameConfig`:
- **`config.orchestration`** (`GameOrchestrationConfig` from [01] §3.3): board size, snakes per team, hazard percentage, and fertile-ground density/clustering. These are the inputs to `generateBoardAndInitialState()` and are consumed entirely by Convex during board generation. They are not passed to the SpacetimeDB instance.
- **`config.runtime`** (`GameRuntimeConfig` from [01] §3.3): max health, max turns, hazard damage, food and potion spawn rates, and clock parameters. These are forwarded to the SpacetimeDB instance at init time alongside the pre-computed initial game state.

Both subtrees are stored in each game's `config` column ([05-REQ-024]); only `config.runtime` is included in the payload sent to STDB's `initialize_game` reducer. Platform-lifecycle fields (`skipStartConfirmation`, tournament meta-parameters, `scheduledStartTime`) live as top-level columns on the `games` row, outside `config`, because they are never forwarded to any runtime other than Convex's own scheduler.

**05-REQ-033** *(negative)*: Convex shall not provision a SpacetimeDB game instance before a game record has been created for it, and shall not create a game record without intending to provision an instance for it. Unorphaned instance-less game records and game-less instances are both disallowed states.

**05-REQ-034**: Convex shall maintain a platform-wide RSA key pair for signing SpacetimeDB access tokens per [03-REQ-022]. The private key shall be stored as a Convex environment variable (`SPACETIMEDB_SIGNING_KEY`). The public key shall be served via OIDC discovery endpoints (see [05-REQ-034a]). No per-instance signing secret is provisioned — the platform-wide key pair is used for all game instances.

**05-REQ-034a**: Convex shall serve two HTTP actions at `CONVEX_SITE_URL` (the `.convex.site` domain) that together constitute a standards-compliant OIDC discovery surface: (a) `GET /.well-known/openid-configuration` returning a JSON document with `issuer`, `jwks_uri`, `id_token_signing_alg_values_supported`, and `subject_types_supported` fields; and (b) `GET /.well-known/jwks.json` returning the RSA public key in JWK format. These endpoints enable SpacetimeDB instances to validate access tokens without any per-instance secret exchange.

**05-REQ-035**: The Convex runtime shall be the sole issuer of SpacetimeDB access tokens for every SpacetimeDB game instance it provisions, consistent with [03-REQ-019], [03-REQ-024], and [03-REQ-026]. The Convex runtime shall refuse to issue a SpacetimeDB access token whose target game is in the `finished` status.

**05-REQ-036**: When a Snek Centaur Server hosting a participating Centaur Team's `nominatedServerDomain` returns unhealthy from the healthcheck endpoint ([02-REQ-029]) at a moment Convex is preparing to transition a game to `playing`, Convex's behaviour depends on the game type: (a) For manually-started games: the game returns to `not-started` status with a healthcheck failure message and a visual indicator of which Centaur Teams' servers are failing. The game cannot be manually started until all teams pass healthcheck. (b) For tournament games that are forcefully started on schedule: failing healthcheck is ignored. If the Centaur Team can get their server running in time to participate, they may; otherwise they are absent from the game. *(See resolved 05-REVIEW-009.)*

**05-REQ-037**: After the game-end HTTP action has received the game-end notification (which bundles the complete replay data per [04-REQ-061]), persisted the replay per [05-REQ-040], and transitioned the game to `finished`, Convex shall tear down the SpacetimeDB game instance from within the same HTTP action, using its platform-level management authority per [03-REQ-048] and [02-REQ-021]. The instance is torn down immediately after Convex confirms successful replay storage. *(See resolved 05-REVIEW-015.)*

**05-REQ-038**: Convex shall learn of a game's terminal state — produced by the win-condition check of [01-REQ-050–052] (owned by [01]; specific event shape owned by [04]) — via a runtime-pushed notification delivered through the mechanism of [04-REQ-061a], authenticated by verifying the game-outcome callback token's RS256 signature and claims (`iss`, `sub`, `aud`, `exp`) per [05-REQ-032a]. The notification payload includes both the `GameOutcome` and the complete game replay data (all STDB historical tables per [04-REQ-061]). On receipt, Convex shall: record the game's outcome and scores, persist the replay to file storage, transition the game to `finished`, and tear down the STDB instance — all within the same HTTP action. The callback endpoint shall accept both normal outcomes (victory, draw) and error outcomes (game interrupted due to an exception), handling each appropriately — normal outcomes trigger score recording and replay persistence followed by teardown; error outcomes trigger teardown without scores or replay. *(See resolved 05-REVIEW-015.)*

**05-REQ-039**: After a game's status has transitioned to `finished` in a non-tournament context, Convex shall auto-create the next game in the same room by atomically copying the finished game's configuration parameter set into a fresh game object in the `not-started` status. The new game shall be distinct from the just-finished game per [02-REQ-020]. All ready flags on the new game shall be cleared. The new game's locked-in board preview shall be null (no preview carried over). *(See resolved 05-REVIEW-008.)*

---

### 5.7 Replay Persistence

**05-REQ-040**: Before tearing down a SpacetimeDB game instance per [05-REQ-037], Convex shall obtain the complete append-only game record from the instance — comprising all static tables and all turn-keyed tables sufficient to reconstruct any historical turn of the game per [02-REQ-013] — and shall persist this record as a replay associated with the game record. The replay data is received as part of the `GameEndNotification` payload (bundled by the STDB `notify_game_end` procedure per [04-REQ-061], [04-REQ-061a]). The callback token authenticating the notification is a Convex-signed JWT validated by signature verification and claims checking. *(See resolved 05-REVIEW-015.)*

**05-REQ-041**: The persisted replay shall be sufficient, in combination with the Centaur subsystem action log owned by [06], to reconstruct the complete turn-level history of the game for the unified replay viewer ([08]).

**05-REQ-042**: While persisting a replay, Convex shall verify, as a defensive check, that every `stagedBy` attribution in the game record is in its Convex-interpretable `Agent` form per [03-REQ-045]. The persisted replay shall not contain any raw SpacetimeDB connection Identity in a `stagedBy` field.

**05-REQ-043** *(negative)*: Convex shall not begin replay persistence until the game's status has reached the moment at which the SpacetimeDB instance's authoritative game record is final — that is, not before the SpacetimeDB-side terminal state has been signalled per [05-REQ-038].

**05-REQ-044**: A persisted replay shall survive any subsequent teardown of the SpacetimeDB instance. Replay viewing shall never require consulting a SpacetimeDB instance.

---

### 5.8 HTTP API

**05-REQ-045**: Convex shall expose an HTTP API for programmatic management of Centaur Teams, rooms, games, and webhook subscriptions. API keys are an admin-only affordance: only admin users (per [05-REQ-065]) may create API keys. Every request to this API shall be authorized by a bearer API key per [03-REQ-033] and rejected if the key is missing, invalid, revoked, or if the key's creator is not an admin. *(See resolved 05-REVIEW-004.)*

**05-REQ-046**: Convex shall maintain a persistent record of every API key. Each record shall capture at minimum a one-way-hash of the key material (per [03-REQ-034]), a human-chosen label, the user record of the creating human (who must be an admin per [05-REQ-045]), the creation timestamp, and a revocation timestamp that is null until the key is revoked. Convex shall never store or expose the plaintext key material after the single creation-time disclosure of [03-REQ-034]. *(See resolved 05-REVIEW-004.)*

**05-REQ-047**: The HTTP API's authorization scope for a given API key shall be global (admin-level). Every valid, non-revoked API key grants full platform access equivalent to the admin role. *(See resolved 05-REVIEW-004.)*

**05-REQ-048** *(negative)*: The HTTP API shall not expose endpoints that create human identities, that perform Google OAuth interactions, that issue SpacetimeDB access tokens directly, or that modify Centaur-subsystem state owned by [06]. These affordances are prohibited for API keys by [03-REQ-036].

**05-REQ-049**: The HTTP API shall expose at minimum the following endpoint families. Exact URL shapes and payload schemas are owned by Design; requirements here enumerate the capabilities that must be present.

- **Centaur Teams**: list teams; read a team including name, colour, Captain, members, and `nominatedServerDomain`; create a team; update team name, colour, or `nominatedServerDomain`; add or remove a team member.
- **Rooms**: list rooms including id, name, creation and update timestamps, and owner; read a room including its current game id and the ids of its historic games; create a room; update a room's configuration; add or remove a Centaur Team from a room's enrollment.
- **Games**: read a game's state including configuration snapshot, status, and final scores (null until `finished`); start a game in a room (triggering the orchestration of [05-REQ-032]).
- **Webhooks**: register a webhook; list registered webhooks; delete a webhook.

**05-REQ-050**: Every mutation made through the HTTP API shall be subject to the same invariants as the equivalent Snek Centaur Server frontend action, including the mid-game roster freeze of [03-REQ-046].

**05-REQ-051**: The HTTP API shall expose a means by which an admin user can create a new API key via the Snek Centaur Server frontend or via a dedicated endpoint. Only admin users may create API keys. The plaintext of a newly created API key shall be disclosed to the creator exactly once at creation time ([03-REQ-034]). *(See resolved 05-REVIEW-004.)*

**05-REQ-052**: The HTTP API shall expose a means by which an admin user can revoke an API key. Revocation shall cause all subsequent requests presenting that key to be rejected.

---

### 5.9 Webhooks

**05-REQ-053**: Convex shall permit API-key-authenticated callers to register webhook subscriptions. A webhook subscription shall capture at minimum a delivery URL, a set of event types drawn from the closed set `{ game_start, game_end }`, a scope that is either a specific game or a specific room (in which case the subscription applies to every game hosted in that room), the API key under which the subscription was created, and a creation timestamp.

**05-REQ-054**: Convex shall deliver a `game_start` webhook notification for every game that transitions to `playing` whose id or enclosing room matches an active webhook subscription for the `game_start` event type. The notification payload shall include at minimum the game's id, its room's id, and the game's configuration snapshot ([05-REQ-024]).

**05-REQ-055**: Convex shall deliver a `game_end` webhook notification for every game that transitions to `finished` whose id or enclosing room matches an active webhook subscription for the `game_end` event type. The notification payload shall include at minimum the game's id, its room's id, and the game's final scores ([05-REQ-038]).

**05-REQ-056**: Webhook delivery shall use at-least-once semantics: if a delivery attempt fails (network error, non-success HTTP response, or timeout), Convex shall retry with exponential backoff until the delivery succeeds or a Design-owned maximum retry budget is exhausted. A subscriber shall therefore be prepared to receive the same event more than once and to deduplicate using a stable identifier included in every notification.

**05-REQ-057** *(negative)*: Webhook delivery shall not block any game lifecycle transition. A slow or unresponsive subscriber shall not prevent a game from entering `playing` or `finished`, nor shall it delay replay persistence or instance teardown.

**05-REQ-058**: Webhook subscriptions shall be revoked automatically when the API key under which they were created is revoked per [05-REQ-052]. The subscriber shall not receive notifications for events occurring after revocation.

---

### 5.10 Tournament Mode

**05-REQ-059**: When a game is started with the Tournament mode parameter on, Convex shall orchestrate a sequence of game rounds equal to the Tournament rounds parameter value. Each round shall be a distinct game with its own freshly provisioned SpacetimeDB instance per [02-REQ-020] and its own game record per [05-REQ-027].

**05-REQ-060**: Tournament rounds shall be chained such that round N+1 is scheduled to begin after round N has finished and after the Tournament interlude (in seconds, per [05-REQ-023]) has elapsed. Convex shall be the sole authority for scheduling and initiating each round.

**05-REQ-061**: The first round of a tournament shall be scheduled to begin at the Scheduled start time parameter value. Convex shall not begin the first round before that moment regardless of Centaur Team readiness.

**05-REQ-062**: Each round within a tournament shall inherit the configuration parameters of the tournament's first game at the moment the tournament was created. The inherited parameter set shall not include the Tournament mode parameters themselves (Tournament rounds, Tournament interlude, Scheduled start time), which are meta-parameters of the tournament as a whole rather than per-round parameters.

**05-REQ-063**: At the end of a tournament — the conclusion of the final round — Convex shall not auto-create an additional game per [05-REQ-039]. Auto-creation of next-games applies only outside tournament mode.

**05-REQ-064**: The roster freeze for tournament games shall apply for the entire tournament lifetime — from the moment the first round transitions to `playing` until the final round transitions to `finished`. Roster mutations for participating Centaur Teams are frozen during inter-round interludes as well as during active rounds. *(See resolved 05-REVIEW-003.)*

---

### 5.11 Admin Role

**05-REQ-065**: The platform shall recognize an **admin** role at the Convex level, distinct from Centaur Team membership. Admin is a platform-wide designation on the user record, not a per-team property. *(See resolved 05-REVIEW-014.)*

**05-REQ-066**: Admin users shall be able to read all Centaur Team records, browse all games across all Centaur Teams, and view all replays regardless of team membership. Admin users shall additionally hold implicit coach permission for every Centaur Team per [05-REQ-067], granting them read-only visibility into the live state of any in-progress game.

**05-REQ-068**: How admin accounts are designated (e.g., a list of admin emails in Convex environment config, a database flag on user records) is a design-phase decision. Requirements state only the capability, not the mechanism.

---

### 5.12 Coach Role

**05-REQ-067**: Each Centaur Team shall be able to designate zero or more **coaches**. A coach is a registered user (per [05-REQ-004]) who is granted read-only visibility into the team's live game activity. Specifically, a coach of a team shall be authorised to read all Convex-resident Centaur state for that team's in-progress games (heuristic configuration, bot parameters, per-snake portfolio state, selection state, computed display state, action log, action log entries, stateMap snapshots, worst-case worlds, heuristic outputs) and to subscribe to that team's filtered SpacetimeDB views per [04] for any in-progress game in which the team is participating, on the same terms as a member of that team. A coach shall not be authorised to mutate any team-scoped or game-scoped state, shall not be authorised to act as an operator, and shall not appear in the team's roster for the purposes of game participation. Coach designation and removal shall be limited to the team's Captain. Admin users ([05-REQ-065]) shall be treated as implicit coaches of every Centaur Team and shall not need to be explicitly designated.

**05-REQ-068a**: Coach designations shall be stored on the Centaur Team record, distinct from the team's member roster. The set of coaches shall be observable to team members through the Team Management view.

**05-REQ-068b** *(negative)*: Coach access shall not extend to finished games beyond what is already publicly available to all authenticated users per [05-REQ-066]. The coach role is meaningful only for the live-game visibility boundary; finished games are publicly readable irrespective of coach status.

---

### 5.13 WASM Module Binary Storage

**05-REQ-073**: Convex shall store the current SpacetimeDB game module binary (a pre-compiled WebAssembly artifact) in Convex file storage. The binary shall be uploaded by the platform build pipeline at build or deploy time, targeting the Convex deployment instance appropriate for the current development or production environment. At game-creation time per [05-REQ-032], Convex shall retrieve the stored binary for inclusion in the SpacetimeDB provisioning request. The binary represents the compiled form of the SpacetimeDB game module defined by [04], which imports the shared engine codebase ([02-REQ-035]).

---

## Design

### 2.1 Convex Table Schemas

Satisfies 05-REQ-001, 05-REQ-003, 05-REQ-004, 05-REQ-008, 05-REQ-011, 05-REQ-016, 05-REQ-027, 05-REQ-029, 05-REQ-040, 05-REQ-046, 05-REQ-053, 05-REQ-073.

Platform-wide tables are defined using Convex's `defineSchema`/`defineTable`/`v.*` DSL. Table names are verified not to collide with Module 06's 8 exported table names (`heuristic_config`, `global_centaur_params`, `snake_operator_state`, `snake_bot_state`, `snake_drives`, `snake_heuristic_overrides`, `game_centaur_state`, `centaur_action_log`). All indexes are non-unique; uniqueness invariants (e.g., one user per email) are enforced application-side in mutations via query-then-guard.

```typescript
import { defineSchema, defineTable } from "convex/server"
import { v, type Infer } from "convex/values"

// The validator below is a 1:1 mirror of [01]'s GameConfig type (see [01] §3.3
// and resolved [01-REVIEW-017]). Every field name, nesting level, and unit
// matches the canonical TypeScript declaration in Module 01. A compile-time
// assertion at the bottom of this block turns any drift into a build error.

const boardSizeV = v.union(
  v.literal("small"), v.literal("medium"),
  v.literal("large"), v.literal("giant"),
)

const gameOrchestrationConfigV = v.object({
  boardSize: boardSizeV,
  snakesPerTeam: v.number(),
  hazardPercentage: v.number(),
  fertileGround: v.object({
    density: v.number(),     // 0 = disabled (per [01-REQ-069])
    clustering: v.number(),
  }),
})

const gameRuntimeConfigV = v.object({
  maxHealth: v.number(),
  maxTurns: v.number(),       // 0 = unlimited (per [01-REQ-058] / [01-REQ-066])
  hazardDamage: v.number(),
  foodSpawnRate:         v.number(),                    // 0 = disabled (per [01-REQ-071])
  invulnPotionSpawnRate: v.number(),                    // 0 = disabled (per [01-REQ-072])
  invisPotionSpawnRate:  v.number(),                    // 0 = disabled (per [01-REQ-073])
  clock: v.object({
    initialBudgetMs:   v.number(),
    budgetIncrementMs: v.number(),
    firstTurnTimeMs:   v.number(),
    maxTurnTimeMs:     v.number(),
  }),
})

const gameConfigValidator = v.object({
  orchestration: gameOrchestrationConfigV,
  runtime:       gameRuntimeConfigV,
})

// Compile-time drift guard. If [01].GameConfig and this validator disagree on
// any field name, nesting level, or type, this alias fails to resolve and the
// build breaks — no runtime check is required.
type _GameConfigMirrorCheck =
  AssertEqual<Infer<typeof gameConfigValidator>, import("@snek-centaur/engine").GameConfig>

export default defineSchema({
  users: defineTable({
    email: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
    archived: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_archived", ["archived"]),

  centaur_teams: defineTable({
    name: v.string(),
    displayColour: v.string(),
    captainUserId: v.id("users"),
    coachUserIds: v.array(v.id("users")),
    nominatedServerDomain: v.union(v.string(), v.null()),
    archived: v.boolean(),
    healthcheckStatus: v.union(
      v.literal("healthy"), v.literal("unhealthy"),
      v.literal("unknown"), v.null()
    ),
    healthcheckTimestamp: v.union(v.number(), v.null()),
  })
    .index("by_captain", ["captainUserId"])
    .index("by_archived", ["archived"]),

  centaur_team_members: defineTable({
    centaurTeamId: v.id("centaur_teams"),
    operatorUserId: v.id("users"),
  })
    .index("by_team", ["centaurTeamId"])
    .index("by_user", ["operatorUserId"])
    .index("by_team_user", ["centaurTeamId", "operatorUserId"]),

  rooms: defineTable({
    name: v.string(),
    ownerId: v.union(v.id("users"), v.null()),
    currentGameId: v.union(v.id("games"), v.null()),
    enrolledTeamIds: v.array(v.id("centaur_teams")),
    archived: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_archived", ["archived"]),

  games: defineTable({
    roomId: v.id("rooms"),
    // `config` is the canonical [01].GameConfig shape, mirrored 1:1 by
    // `gameConfigValidator` above (see resolved [01-REVIEW-017]). Platform-only
    // lifecycle fields that Convex persists between games but never forwards
    // to the engine (`skipStartConfirmation`, tournament meta-parameters,
    // `scheduledStartTime`) live at the top level of this row, outside
    // `config`, because they are not part of the tri-runtime-mirrored type.
    config: gameConfigValidator,
    skipStartConfirmation: v.boolean(),
    tournamentMode: v.boolean(),
    tournamentRounds: v.union(v.number(), v.null()),
    tournamentInterludeSec: v.union(v.number(), v.null()),
    scheduledStartTime: v.union(v.number(), v.null()),
    status: v.union(
      v.literal("not-started"), v.literal("playing"), v.literal("finished")
    ),
    stdbInstanceUrl: v.union(v.string(), v.null()),
    stdbModuleName: v.union(v.string(), v.null()),
    outcome: v.union(v.any(), v.null()),
    finalTurn: v.union(v.number(), v.null()),
    createdAt: v.number(),
    startedAt: v.union(v.number(), v.null()),
    finishedAt: v.union(v.number(), v.null()),
    readyTeamIds: v.array(v.id("centaur_teams")),
    healthcheckFailures: v.union(
      v.array(v.object({
        centaurTeamId: v.id("centaur_teams"),
        message: v.string(),
      })),
      v.null()
    ),
    lockedBoardPreview: v.union(v.any(), v.null()),
    boardSeed: v.union(v.bytes(), v.null()),
    tournamentId: v.union(v.id("tournaments"), v.null()),
    tournamentRound: v.union(v.number(), v.null()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_status", ["roomId", "status"])
    .index("by_status", ["status"])
    .index("by_tournament", ["tournamentId"]),

  game_teams: defineTable({
    gameId: v.id("games"),
    centaurTeamId: v.id("centaur_teams"),
    rosterSnapshot: v.array(v.object({
      operatorUserId: v.id("users"),
      isCaptain: v.boolean(),
    })),
  })
    .index("by_game", ["gameId"])
    .index("by_team", ["centaurTeamId"])
    .index("by_game_team", ["gameId", "centaurTeamId"]),

  replays: defineTable({
    gameId: v.id("games"),
    storageId: v.id("_storage"),
    retrievedAt: v.number(),
  })
    .index("by_game", ["gameId"]),

  api_keys: defineTable({
    keyHash: v.string(),
    label: v.string(),
    creatorId: v.id("users"),
    createdAt: v.number(),
    revokedAt: v.union(v.number(), v.null()),
  })
    .index("by_hash", ["keyHash"])
    .index("by_creator", ["creatorId"]),

  webhooks: defineTable({
    url: v.string(),
    eventTypes: v.array(
      v.union(v.literal("game_start"), v.literal("game_end"))
    ),
    scopeType: v.union(v.literal("game"), v.literal("room")),
    scopeId: v.string(),
    apiKeyId: v.id("api_keys"),
    createdAt: v.number(),
  })
    .index("by_api_key", ["apiKeyId"])
    .index("by_scope", ["scopeType", "scopeId"]),

  wasm_modules: defineTable({
    storageId: v.id("_storage"),
    uploadedAt: v.number(),
    active: v.boolean(),
  })
    .index("by_active", ["active"]),

  tournaments: defineTable({
    roomId: v.id("rooms"),
    totalRounds: v.number(),
    interludeSeconds: v.number(),
    scheduledStartTime: v.number(),
    currentRound: v.number(),
    status: v.union(
      v.literal("scheduled"), v.literal("in_progress"), v.literal("completed")
    ),
    enrolledTeamIds: v.array(v.id("centaur_teams")),
    baseConfig: gameConfigValidator,
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_status", ["status"]),

  webhook_delivery_attempts: defineTable({
    webhookId: v.id("webhooks"),
    eventType: v.union(v.literal("game_start"), v.literal("game_end")),
    gameId: v.id("games"),
    idempotencyKey: v.string(),
    attemptNumber: v.number(),
    status: v.union(
      v.literal("pending"), v.literal("succeeded"), v.literal("failed")
    ),
    httpStatus: v.union(v.number(), v.null()),
    scheduledAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
  })
    .index("by_webhook_game", ["webhookId", "gameId"])
    .index("by_status", ["status"]),
})
```

**Design rationale — table naming**: Platform tables use descriptive singular or plural names (`users`, `centaur_teams`, `games`, etc.) that are all distinct from Module 06's Centaur-subsystem table names. The `_storage` table is Convex's built-in file storage system.

**Design rationale — `outcome` field on `games`**: The `outcome` field stores the `GameOutcome` from Module 04's `GameEndNotification` (§3.3) as `v.any()`. The expected shape is `{ kind: 'victory', winnerCentaurTeamId: string, scores: Record<string, number> }` | `{ kind: 'draw', tiedCentaurTeamIds: string[], scores: Record<string, number> }` | `{ kind: 'error', reason: string }`. The `winnerCentaurTeamId` and `tiedCentaurTeamIds` values are Convex `centaur_teams._id` strings (matching Module 04 §3.3's exported type). Using `v.any()` avoids redundant validator definitions for a type already defined upstream and permits future narrowing without data migration.

**Design rationale — `lockedBoardPreview` field**: Stores the complete output of `generateBoardAndInitialState()` as a JSON-serializable value. The shape matches Module 01's exported types: `{ board: Board, snakes: SnakeState[], items: ItemState[] }`. Using `v.any()` follows Module 06's precedent for complex nested structures.

**Design rationale — `tournaments` table**: Tournament-level metadata (total rounds, interlude, enrolled teams, base config) is separated from per-round game records. Each round-game references its tournament via `tournamentId` and `tournamentRound`. This avoids duplicating tournament metadata across every round-game and provides a clean anchor for the tournament-wide roster freeze.

**Design rationale — `webhook_delivery_attempts` table**: Supports at-least-once delivery with retry tracking per 05-REQ-056. Each delivery attempt is recorded for auditability. The `idempotencyKey` enables subscriber-side deduplication.

---

### 2.2 Game Configuration Architecture

Satisfies 05-REQ-022, 05-REQ-023, 05-REQ-024, 05-REQ-025, 05-REQ-026, 05-REQ-032d.

**Config-on-game model** *(see resolved 05-REVIEW-008)*. Game configuration lives exclusively on the game object. The room is a dumb container for a succession of games with exactly one live (not-started or playing) game at a time. When a room is created, an initial not-started game is created with default config values per 05-REQ-023. When a game finishes, auto-create copies the finished game's config into a fresh not-started game.

**Config editing**: While a game is in `not-started` status, the `config` column and the platform-lifecycle fields (`skipStartConfirmation`, `tournamentMode`, `tournamentRounds`, `tournamentInterludeSec`, `scheduledStartTime`) are editable by the room's administrative actor (owner, or any authenticated user if no owner). A Convex mutation `updateGameConfig` accepts a deep-partial of the config and a partial of the lifecycle fields, merges each into the game record, and validates against the ranges defined in 05-REQ-023:

```typescript
mutation updateGameConfig(args: {
  gameId: Id<"games">
  config?: DeepPartial<GameConfig>               // mirrored [01].GameConfig
  lifecycle?: Partial<{
    skipStartConfirmation: boolean
    tournamentMode: boolean
    tournamentRounds: number | null
    tournamentInterludeSec: number | null
    scheduledStartTime: number | null
  }>
}): void
```

The mutation rejects updates if the game's status is not `not-started`. Conditional validation per 05-REQ-025: values in `config.orchestration.fertileGround.clustering` are always accepted within their range and simply ignored during board generation when `config.orchestration.fertileGround.density` is 0; tournament-dependent lifecycle fields may be persisted while `tournamentMode` is false and are ignored by the orchestration.

**Config freeze**: When game-start orchestration begins (05-REQ-032 step 1), the config and lifecycle fields become immutable. The mutation that initiates game start reads the record and proceeds with it; no further `updateGameConfig` calls succeed because the game transitions away from `not-started`.

**Parameter split at STDB handoff** (05-REQ-032d). At game-start time:
- `config.orchestration` (`boardSize`, `snakesPerTeam`, `hazardPercentage`, `fertileGround.{density, clustering}`) is consumed by `generateBoardAndInitialState()` inside a Convex mutation.
- `config.runtime` (`maxHealth`, `maxTurns`, `hazardDamage`, `foodSpawnRate`, `invulnPotionSpawnRate`, `invisPotionSpawnRate`, `clock.*`) is forwarded verbatim to STDB's `initialize_game` reducer as `gameRuntimeConfig`.
- Platform-lifecycle fields are consumed by the Convex orchestration itself and not forwarded to any other runtime.

Because `config.runtime` on the Convex row mirrors `GameRuntimeConfig` in Module 01 field-for-field (enforced by the `AssertEqual<Infer<typeof gameRuntimeConfigV>, GameRuntimeConfig>` check in §2.1), no field-by-field translation is needed at the STDB handoff — the subtree is serialized as-is.

---

### 2.3 Game Lifecycle Orchestration Pipeline

Satisfies 05-REQ-027, 05-REQ-028, 05-REQ-031, 05-REQ-032, 05-REQ-032a, 05-REQ-033, 05-REQ-036, 05-REQ-038.

The game lifecycle is a state machine with three states: `not-started → playing → finished`. The orchestration pipeline manages the `not-started → playing` transition as a Convex action (not a mutation, because it makes external HTTP calls to SpacetimeDB and nominated server domains).

#### 2.3.1 Game-Start Orchestration Action

```typescript
action startGame(args: { gameId: Id<"games"> }): void
```

**Preconditions** (checked in a mutation called at the start of the action):
1. Game exists and has `status === "not-started"`.
2. Game's room has at least 2 enrolled teams.
3. All enrolled teams have declared ready (their team ID is in `readyTeamIds`).
4. If not `skipStartConfirmation`, the administrative actor has confirmed.
5. All enrolled teams have a non-null `nominatedServerDomain`.
6. All enrolled teams are not archived.

**Orchestration sequence** (05-REQ-032):

**Step 1 — Config freeze**. The action reads the game's config. From this point, the config is treated as frozen (the game record is about to leave `not-started` status, preventing further edits).

**Step 2 — Board generation**. If `lockedBoardPreview` is non-null on the game record, use it directly. Otherwise, invoke `generateBoardAndInitialState()` from the shared engine codebase within a Convex mutation. The mutation generates a cryptographic root seed via `crypto.getRandomValues(new Uint8Array(32))` and calls the function with `config.orchestration` (Module 01 §3.3). If all bounded-retry attempts fail ([01-REQ-061]), the mutation throws a `BoardGenerationFailure` error and the action aborts, returning the game to `not-started` with the error surfaced reactively.

**Step 3 — Healthcheck**. For non-tournament games: the action calls each enrolled team's healthcheck endpoint (`GET https://{nominatedServerDomain}/.well-known/snek-healthcheck`). If any team's server is unhealthy, the action aborts: a mutation writes the healthcheck failures to the game record's `healthcheckFailures` field and the game remains in `not-started`. For tournament games: healthcheck is skipped per 05-REQ-036(b).

**Step 4 — STDB provisioning**. The action retrieves the active WASM binary from Convex file storage (`wasm_modules` table where `active === true`), then calls `POST /v1/database` on the self-hosted SpacetimeDB management API with the binary, authenticated via a Convex self-issued management JWT per [03] §3.22. The response provides the instance URL and module name.

**Step 5 — Instance initialization**. The action calls `POST /v1/database/{name}/call/initialize_game` on the STDB instance with an `InitializeGameParams` payload (Module 04 §3.1). The payload includes: pre-computed initial state (board, snakes, items), the game seed (`boardSeed`), `config.runtime` (the `GameRuntimeConfig` from [01] §3.3, passed as `gameRuntimeConfig`), the game-end callback URL (a Convex HTTP action endpoint), a game-outcome callback token (an RS256-signed JWT with `iss: CONVEX_SITE_URL`, `sub: "stdb-instance:{gameId}"`, `aud: callbackUrl`, `exp: iat + 7200`), the participating-teams roster, and the game's Convex document `_id` as the gameId. The callback token is not stored by Convex — the STDB module stores it and presents it back to Convex on game-end; Convex validates it by signature verification and claims checking. *(See resolved 05-REVIEW-015.)*

**Step 6 — Game credential issuance and invitations**. For each participating team, the action calls `issueGameCredential(centaurTeamId, gameId)` from [03] to generate a per-team game credential JWT. The action then sends game invitations via `POST https://{nominatedServerDomain}/.well-known/snek-game-invite` with a `GameInvitationPayload` (Module 03 §4.7) containing the credential, STDB URL, module name, game config, and team roster. Each invitation must be accepted within 10 seconds. If any server rejects or times out, the action tears down the STDB instance and returns the game to `not-started` with an invitation failure error.

**Step 7 — Centaur state initialization**. For each participating team, the action calls `initializeGameCentaurState({ gameId, centaurTeamId, snakeIds })` from [06] to set up the Centaur subsystem's game-scoped state.

**Step 8 — Status transition**. A final mutation atomically updates the game record: sets `status` to `"playing"`, writes `stdbInstanceUrl`, `stdbModuleName`, `startedAt`, and `boardSeed`. The game is now live. *(See resolved 05-REVIEW-015.)*

**Error handling**: If any step after STDB provisioning fails, the action tears down the provisioned STDB instance before returning the game to `not-started`. This prevents orphaned instances per 05-REQ-033.

#### 2.3.2 Game-End HTTP Action Endpoint

```typescript
httpAction gameEndCallback(request: Request): Response
```

Satisfies 05-REQ-038. This HTTP action endpoint receives `GameEndNotification` payloads (Module 04 §3.3) from STDB instances.

**Authentication**: The request must include a `Bearer` token in the `Authorization` header. The action validates the token by:
1. Decoding the JWT and verifying the RS256 signature against the `SPACETIMEDB_SIGNING_KEY` public key.
2. Checking `iss === CONVEX_SITE_URL`.
3. Checking `aud` matches this endpoint's URL (the `gameEndCallbackUrl` registered at init time).
4. Extracting the gameId from `sub` (format `"stdb-instance:{gameId}"`).
5. Verifying `exp` has not passed.
6. Loading the game record and confirming the game's status is `"playing"`.

The JWT is a self-contained proof of authority; its signature and claims are sufficient for validation. *(See resolved 05-REVIEW-015.)*

**Processing**:
1. Parse the `GameEndNotification` payload: `{ gameId, outcome, finalTurn, replayData }`.
2. For normal outcomes (victory, draw):
   a. Run **defensive validation** (05-REQ-042): scan all `stagedBy` fields in the `replayData.staged_moves` data to verify they contain `Agent` values (not raw SpacetimeDB Identities).
   b. Serialize the `replayData` as JSON and store it in Convex file storage via `ctx.storage.store(blob)`.
   c. Create a `replays` record linking the game to the storage ID.
   d. Transition the game to `finished` via a mutation: set `status` to `"finished"`, write `outcome`, `finalTurn`, and `finishedAt`.
   e. Tear down the STDB instance: call `DELETE /v1/database/{name}` on the SpacetimeDB management API, authenticated per [03] §3.22.
3. For error outcomes: tear down the STDB instance directly (no replay persistence). Transition the game to `finished` with the error outcome.
4. Fire webhook notifications asynchronously (Section 2.9).
5. If non-tournament: auto-create the next game (Section 2.6).
6. If tournament: advance to the next round or complete the tournament (Section 2.10).
7. Call `cleanupGameCentaurState({ gameId })` from [06] to clear selection records.

---

### 2.4 Board Generation Preview and Lock-In

Satisfies 05-REQ-032b, 05-REQ-032c.

**Preview mutation**:

```typescript
mutation generateBoardPreview(args: {
  gameId: Id<"games">
}): { board: any; snakes: any; items: any } | { error: BoardGenerationFailure }
```

Called when the administrative actor requests a board preview for the current not-started game. The mutation:
1. Reads the game's current config.
2. Generates a cryptographic root seed.
3. Constructs the `GameConfig` for `generateBoardAndInitialState()` from the game's config fields.
4. Calls `generateBoardAndInitialState()` with bounded-retry logic per [01-REQ-061].
5. On success, returns the board state. On failure, returns the structured `BoardGenerationFailure`.

The preview result is not persisted automatically; the client decides whether to lock it in.

**Lock-in mutation**:

```typescript
mutation lockBoardPreview(args: {
  gameId: Id<"games">
  boardPreview: any
  boardSeed: ArrayBuffer
}): void
```

Persists the given board state and seed to the game record's `lockedBoardPreview` and `boardSeed` fields. Only succeeds if the game is in `not-started` status.

**Unlock mutation**:

```typescript
mutation unlockBoardPreview(args: {
  gameId: Id<"games">
}): void
```

Clears the `lockedBoardPreview` and `boardSeed` fields, causing a fresh board to be generated at game start.

---

### 2.5 Ready Check and Auto-Create

Satisfies 05-REQ-031, 05-REQ-039. *(See resolved 05-REVIEW-007, 05-REVIEW-008.)*

**Ready check**: Readiness is tracked in the game record's `readyTeamIds` array. Only the Captain of a Centaur Team can declare their team ready:

```typescript
mutation declareReady(args: {
  gameId: Id<"games">
  centaurTeamId: Id<"centaur_teams">
}): void
```

Preconditions:
1. Game exists and has `status === "not-started"`.
2. The calling user is the Captain of the specified team.
3. The team is enrolled in the game's room.
4. The team is not already in `readyTeamIds`.

The mutation appends the team ID to `readyTeamIds`. A corresponding `undeclareReady` mutation removes it.

**Auto-create** *(see resolved 05-REVIEW-008)*: When a non-tournament game transitions to `finished`, a mutation atomically:
1. Copies the finished game's `config` into a new game document.
2. Sets the new game's `status` to `"not-started"`, clears `readyTeamIds`, `lockedBoardPreview`, `boardSeed`, `healthcheckFailures`, `outcome`, `finalTurn`, and all timestamp/STDB fields.
3. Updates the room's `currentGameId` to point to the new game.

Convex's built-in mutation atomicity prevents race conditions with concurrent edits. The new game's config can be edited by the administrative actor before the next game start.

---

### 2.6 OIDC Discovery Endpoints

Satisfies 05-REQ-034, 05-REQ-034a.

Two HTTP actions served at `CONVEX_SITE_URL`:

**`GET /.well-known/openid-configuration`**:

```typescript
httpAction openidConfiguration(request: Request): Response {
  const issuer = process.env.CONVEX_SITE_URL
  return new Response(JSON.stringify({
    issuer,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    id_token_signing_alg_values_supported: ["RS256"],
    subject_types_supported: ["public"],
  }), {
    headers: { "Content-Type": "application/json" },
  })
}
```

**`GET /.well-known/jwks.json`**:

```typescript
httpAction jwks(request: Request): Response {
  const privateKeyPem = process.env.SPACETIMEDB_SIGNING_KEY
  const publicKey = deriveRsaPublicKey(privateKeyPem)
  const jwk = exportJwk(publicKey)
  return new Response(JSON.stringify({ keys: [jwk] }), {
    headers: { "Content-Type": "application/json" },
  })
}
```

The RSA private key is read from the `SPACETIMEDB_SIGNING_KEY` environment variable. The public key is derived from it using standard crypto operations (`crypto.subtle.importKey` + `crypto.subtle.exportKey`). The JWK includes `kty`, `n`, `e`, `alg: "RS256"`, `use: "sig"`, and a `kid` derived from the key's thumbprint.

**Design rationale**: The public key derivation and JWK export happen on every request rather than being cached, because Convex actions are stateless. In practice, Convex's HTTP action infrastructure handles caching at the infrastructure level.

---

### 2.7 SpacetimeDB Access Token Issuance

Satisfies 05-REQ-035, 05-REQ-030.

Two Convex action endpoints issue SpacetimeDB access tokens:

**Operator access token** (for human operators authenticated via Google OAuth):

```typescript
action issueOperatorAccessToken(args: {
  gameId: Id<"games">
}): string
```

Authorization:
1. Resolve the caller's identity via `resolveIdentity()` from [03]; must be `kind: 'human'`.
2. Load the game record; verify `status === "playing"`.
3. Query `game_teams` for the game; verify the caller's user `_id` appears as an `operatorUserId` in at least one team's `rosterSnapshot`.
4. Determine the `sub` claim: `"operator:{users._id}"`.
5. Call `issueSpacetimeDbAccessToken(gameId, sub)` from [03] and return the JWT.

**Bot access token** (for Snek Centaur Servers authenticated via game credential):

```typescript
action issueBotAccessToken(args: {
  gameId: Id<"games">
}): string
```

Authorization:
1. Resolve the caller's identity via `resolveIdentity()` from [03]; must be `kind: 'centaur_team_credential'`.
2. Verify the credential's `gameId` matches the requested game.
3. Load the game record; verify `status === "playing"`.
4. Query `game_teams` to confirm the credential's `centaurTeamId` is a participant.
5. Determine the `sub` claim: `"centaur:{centaurTeamId}"`.
6. Call `issueSpacetimeDbAccessToken(gameId, sub)` from [03] and return the JWT.

**Spectator access token** (for any authenticated human):

```typescript
action issueSpectatorAccessToken(args: {
  gameId: Id<"games">
}): string
```

Authorization:
1. Resolve the caller's identity via `resolveIdentity()` from [03]; must be `kind: 'human'`.
2. Load the game record; verify `status === "playing"`.
3. Determine the `sub` claim: `"spectator:{users._id}"`.
4. Call `issueSpacetimeDbAccessToken(gameId, sub)` from [03] and return the JWT.

**Coach access token** (for users with coach permission on a participating team per [05-REQ-067]):

```typescript
action issueCoachAccessToken(args: {
  gameId: Id<"games">,
  centaurTeamId: Id<"centaur_teams">
}): string
```

Authorization:
1. Resolve the caller's identity via `resolveIdentity()` from [03]; must be `kind: 'human'`.
2. Load the game record; verify `status === "playing"`.
3. Verify `isCoachOfTeam(callerUserId, centaurTeamId)` per §2.11; this returns true when the caller is in the team's `coachUserIds` or is an admin per `isAdmin(callerEmail)`. Reject if false.
4. Query `game_teams` for the game; verify `centaurTeamId` is a participant.
5. Determine the `sub` claim: `"coach:{users._id}:{centaur_teams._id}"`. The team-scoped `sub` lets the SpacetimeDB row-level filter ([04]) deliver the same per-team subscription view a member of that team would receive, while distinguishing coach connections from operator connections so SpacetimeDB rejects any reducer call from a coach `sub`.
6. Call `issueSpacetimeDbAccessToken(gameId, sub)` from [03] and return the JWT.

All four endpoints refuse to issue tokens when `status === "finished"` per 05-REQ-035.

---

### 2.8 HTTP API

Satisfies 05-REQ-045, 05-REQ-047, 05-REQ-048, 05-REQ-049, 05-REQ-050.

The HTTP API is implemented as Convex HTTP actions at `CONVEX_SITE_URL/api/v1/*`. All requests are authenticated via bearer API key, validated using `validateApiKey()` from [03]. After validation, the handler calls `isAdmin(validatedKey.ownerEmail)` from [03] to confirm admin status; if not admin, the request is rejected with `403 Forbidden`.

**Common request/response conventions**:
- Content-Type: `application/json`
- Success: HTTP 200 with JSON body
- Not found: HTTP 404
- Validation error: HTTP 400 with `{ error: string }`
- Auth error: HTTP 401 (missing/invalid key) or 403 (not admin)
- Conflict: HTTP 409 (e.g., roster freeze)

#### Endpoint families:

**Centaur Teams** (`/api/v1/teams`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/teams` | List teams (excludes archived by default; `?includeArchived=true` to include) |
| GET | `/api/v1/teams/:id` | Read team details including members |
| POST | `/api/v1/teams` | Create team: `{ name, displayColour, captainEmail }` |
| PATCH | `/api/v1/teams/:id` | Update team: `{ name?, displayColour?, nominatedServerDomain? }` |
| POST | `/api/v1/teams/:id/members` | Add member: `{ email, role }` |
| DELETE | `/api/v1/teams/:id/members/:operatorUserId` | Remove member |

**Rooms** (`/api/v1/rooms`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/rooms` | List rooms (excludes archived by default) |
| GET | `/api/v1/rooms/:id` | Read room including current game ID |
| POST | `/api/v1/rooms` | Create room: `{ name, ownerEmail? }` |
| PATCH | `/api/v1/rooms/:id` | Update room: `{ name? }` |
| POST | `/api/v1/rooms/:id/enroll` | Enroll team: `{ centaurTeamId }` |
| DELETE | `/api/v1/rooms/:id/enroll/:teamId` | Unenroll team |

**Games** (`/api/v1/games`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/games/:id` | Read game state including config, status, outcome |
| POST | `/api/v1/rooms/:roomId/start` | Start game in room (triggers 05-REQ-032) |
| PATCH | `/api/v1/games/:id/config` | Update game config (only while not-started) |

**Webhooks** (`/api/v1/webhooks`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/webhooks` | List registered webhooks |
| POST | `/api/v1/webhooks` | Register: `{ url, eventTypes, scopeType, scopeId }` |
| DELETE | `/api/v1/webhooks/:id` | Delete webhook |

All mutations through the HTTP API are subject to the same invariants as frontend actions per 05-REQ-050, including roster freeze checks.

---

### 2.9 Webhook Delivery

Satisfies 05-REQ-053, 05-REQ-054, 05-REQ-055, 05-REQ-056, 05-REQ-057, 05-REQ-058.

**Delivery trigger**: When a game transitions to `playing` or `finished`, a Convex mutation queries the `webhooks` table for active subscriptions matching the game (by game ID for game-scoped webhooks, by room ID for room-scoped webhooks) and the event type. For each matching webhook, it creates a `webhook_delivery_attempts` record and schedules a delivery action.

**Delivery action**:

```typescript
action deliverWebhook(args: {
  deliveryAttemptId: Id<"webhook_delivery_attempts">
}): void
```

The action:
1. Loads the delivery attempt, webhook, and game records.
2. Verifies the webhook's API key is not revoked (per 05-REQ-058).
3. Constructs the notification payload with an idempotency key (`{gameId}:{eventType}:{webhookId}`).
4. Sends an HTTP POST to the webhook URL with the payload.
5. On success (2xx response): marks the delivery attempt as `succeeded`.
6. On failure: marks the attempt as `failed` and schedules a retry if the retry budget is not exhausted.

**Retry schedule**: Exponential backoff with a maximum of 5 retries: 1s, 5s, 25s, 125s, 625s (~10 min total). Each retry creates a new `webhook_delivery_attempts` record with an incremented `attemptNumber`.

**Non-blocking delivery** (05-REQ-057): Webhook delivery is scheduled via `ctx.scheduler.runAfter(0, ...)`, which ensures the game lifecycle transition completes before delivery attempts begin. Delivery failures never block the game state machine.

**Webhook notification payload**:

```typescript
interface WebhookNotification {
  readonly eventType: "game_start" | "game_end"
  readonly idempotencyKey: string
  readonly timestamp: number
  readonly gameId: string
  readonly roomId: string
  readonly config: GameConfig
  readonly outcome?: GameOutcome
}
```

For `game_start`: includes the game's frozen config snapshot. For `game_end`: includes the game's outcome and final scores.

---

### 2.10 Tournament Mode Lifecycle

Satisfies 05-REQ-059, 05-REQ-060, 05-REQ-061, 05-REQ-062, 05-REQ-063, 05-REQ-064.

**Tournament creation**: When a game with `tournamentMode === true` is started, the game-start orchestration creates a `tournaments` record before proceeding with round 1:

1. Create a tournament record with: `roomId`, `totalRounds` (from the game's top-level `tournamentRounds`), `interludeSeconds` (from the game's top-level `tournamentInterludeSec`), `scheduledStartTime` (from the game's top-level `scheduledStartTime`), `currentRound: 1`, `status: "scheduled"`, `enrolledTeamIds` (snapshot of room's enrolled teams), and `baseConfig` (the game's `config` subtree — a `[01].GameConfig` — which contains only game-rules parameters and so inherently excludes the tournament meta-parameters, since those live at the top level of the `games` row outside `config`). The tournament transitions from `"scheduled"` to `"in_progress"` at the moment the first round's game-start orchestration begins (i.e., when round 1 transitions to `playing`). This is the point at which the tournament-wide roster freeze (Section 2.15) takes effect.
2. Set the game's `tournamentId` and `tournamentRound: 1`.
3. If `scheduledStartTime` is in the future, schedule the game-start action to run at that time via `ctx.scheduler.runAt(scheduledStartTime, ...)`. The game remains in `not-started` until then.
4. If `scheduledStartTime` is now or in the past, proceed with immediate game-start.

**Round chaining**: When a tournament-round game transitions to `finished`, the game-end handler checks the tournament:
1. Load the tournament record.
2. If `currentRound < totalRounds`: schedule the next round after `interludeSeconds` delay via `ctx.scheduler.runAfter(interludeSeconds * 1000, ...)`. The scheduled action creates a new game with `baseConfig`, sets `tournamentId`, `tournamentRound: currentRound + 1`, and starts it immediately (no ready check for tournament rounds — tournament games auto-start on schedule per 05-REQ-036(b); see resolved 05-REVIEW-009).
3. If `currentRound === totalRounds`: set tournament `status` to `"completed"`. Do not auto-create a new game per 05-REQ-063.

**Tournament-wide roster freeze** *(see resolved 05-REVIEW-003)*: The roster freeze check in team mutation functions (Section 2.16) checks whether the team is enrolled in any tournament with `status === "in_progress"`. Rosters remain frozen during inter-round interludes.

**Config inheritance** (05-REQ-062): Each round-game's `config` column is a copy of the tournament's `baseConfig` (a `[01].GameConfig`). Round games inherit `tournamentMode = true`, `tournamentId` set to the tournament record, and `tournamentRound` incremented; other lifecycle fields (`skipStartConfirmation`, `scheduledStartTime` etc.) are set by the chaining action. All rounds share the same gameplay configuration.

---

### 2.11 Admin Role, Coach Role, and Replay Access Control

Satisfies 05-REQ-065, 05-REQ-066, 05-REQ-067, 05-REQ-068, 05-REQ-068a, 05-REQ-068b.

**Admin designation** (05-REQ-068): Admin is determined by `isAdmin(email)` from [03] §4.5, which reads the `ADMIN_EMAILS` environment variable. No admin flag is stored in the `users` table — admin status is derived from the env var on every check.

**Admin enforcement**: Admin checks are applied in:
- HTTP API handlers (Section 2.8): all requests require admin.
- Team/game/replay queries: admin users bypass team-membership filters.
- Live-game cross-team read paths: admin users are treated as implicit coaches of every team per [05-REQ-067].

**Coach designation** (05-REQ-067, 05-REQ-068a): Each `centaur_teams` record carries a `coachUserIds: ReadonlyArray<Id<"users">>` field. The Captain mutation surface for coach designation is:

```typescript
mutation addCoach(args: { centaurTeamId: Id<"centaur_teams">, coachUserId: Id<"users"> }): void
mutation removeCoach(args: { centaurTeamId: Id<"centaur_teams">, coachUserId: Id<"users"> }): void
```

Both mutations are Captain-gated and reject otherwise. The set of coaches is observable to team members via the team query surface.

**Coach enforcement**: A helper `isCoachOfTeam(userId, centaurTeamId)` returns `true` when (a) `userId` appears in the team's `coachUserIds` or (b) the user holding `userId` is an admin per `isAdmin(email)`. This helper is consulted by:
- The live-game Convex read paths in [06] that gate cross-team visibility into in-progress games.
- The SpacetimeDB token issuance in [03] when issuing per-team subscription tokens for live spectating in coach mode.

**Replay access**: Replay access is fully public to authenticated users for all finished games — neither admin nor coach status is required to view any replay.

---

### 2.12 WASM Module Binary Storage

Satisfies 05-REQ-073.

The `wasm_modules` table stores references to WASM binaries uploaded to Convex file storage. The platform build pipeline uploads the compiled STDB game module binary via:

```typescript
mutation uploadWasmModule(args: {
  storageId: Id<"_storage">
}): Id<"wasm_modules">
```

The mutation:
1. Creates a new `wasm_modules` record with `active: true`.
2. Sets all previously active records to `active: false`.

At game-start time, the orchestration action queries `wasm_modules` for the record with `active === true` and retrieves the binary from file storage via `ctx.storage.get(storageId)`.

**Design rationale**: Only one WASM module is active at a time. The `active` flag enables atomic switching when a new build is deployed, while preserving historical records for auditing.

---

### 2.13 Replay Persistence

Satisfies 05-REQ-040, 05-REQ-041, 05-REQ-042, 05-REQ-043, 05-REQ-044.

Replay persistence is performed inline within the game-end HTTP action (Section 2.3.2), not as a separately scheduled step. The STDB procedure bundles the complete historical record into the `GameEndNotification` payload (see [04] §2.10, §2.11), so Convex receives the replay data in the same request that reports the game outcome.

The processing steps (for normal outcomes) are:
1. Extract `replayData` from the notification payload.
2. **Defensive validation** (05-REQ-042): scan all `stagedBy` fields in the `replayData.staged_moves` data to verify they contain `Agent` values (not raw SpacetimeDB Identities).
3. Serialize the `replayData` as JSON.
4. Store the JSON in Convex file storage via `ctx.storage.store(blob)`.
5. Create a `replays` record linking the game to the storage ID.

**Replay data shape**: The replay is stored as a single JSON document containing all STDB tables. The shape matches the union of all tables described in [04] §2.11. This document is sufficient, in combination with [06]'s `centaur_action_log` entries for the game, to reconstruct the complete game history per 05-REQ-041.

**Instance teardown**: Immediately after successful replay persistence (or immediately for error outcomes), the game-end HTTP action calls `DELETE /v1/database/{name}` on the SpacetimeDB management API, authenticated per [03] §3.22. This fulfills 05-REQ-037.

*(See resolved 05-REVIEW-015.)*

---

### 2.14 Healthcheck

Satisfies 05-REQ-009, 05-REQ-036.

**On-demand healthcheck action**:

```typescript
action checkServerHealth(args: {
  centaurTeamId: Id<"centaur_teams">
}): { healthy: boolean; message?: string }
```

The action:
1. Loads the team record; reads `nominatedServerDomain`.
2. Calls `GET https://{nominatedServerDomain}/.well-known/snek-healthcheck` with a 5-second timeout.
3. A 200 response is considered healthy; any other response or timeout is unhealthy.
4. Updates the team record's `healthcheckStatus` and `healthcheckTimestamp` via a mutation.
5. Returns the result.

**Game-start healthcheck** (05-REQ-036): During game-start orchestration (Section 2.3.1 step 3), the action checks all participating teams' servers. For non-tournament games, any unhealthy server aborts the start. For tournament games, healthcheck failures are ignored.

---

### 2.15 Roster Freeze Enforcement

Satisfies 05-REQ-013, 05-REQ-014, [03-REQ-046], 05-REQ-064.

All mutations that modify a Centaur Team's roster (member add/remove, Captain transfer, `nominatedServerDomain` change) include a precondition check:

```typescript
function assertNotFrozen(centaurTeamId: Id<"centaur_teams">): void
```

The check queries:
1. `game_teams` joined with `games` to find any game where this team participates and `status === "playing"`.
2. `tournaments` to find any tournament where this team is in `enrolledTeamIds` and `status === "in_progress"`.

If either query returns results, the mutation throws an error indicating the team's roster is frozen.

**Tournament-wide freeze** *(see resolved 05-REVIEW-003)*: The tournament check keeps rosters frozen during inter-round interludes as well as active rounds. A tournament transitions from `"in_progress"` to `"completed"` only when the final round finishes.

---

## Exported Interfaces

This section defines the minimal contract downstream modules ([07] and [08]) consume. Any type not listed here is a module-internal detail.

### 3.1 Platform Table Schema Types

Motivated by 05-REQ-001, 05-REQ-003, 05-REQ-027. Consumed by [08] for UI rendering and data subscription.

The platform-wide Convex tables defined in Section 2.1 are exported as the platform schema. Downstream modules subscribe to these tables via Convex's reactive query system. The 12 platform tables are: `users`, `centaur_teams`, `centaur_team_members`, `rooms`, `games`, `game_teams`, `replays`, `api_keys`, `webhooks`, `wasm_modules`, `tournaments`, and `webhook_delivery_attempts`.

These table names are guaranteed not to collide with Module 06's 8 Centaur-subsystem table names. Together, the platform tables and Centaur-subsystem tables form the single Convex deployment's schema.

**Exported table document types**:

> **Note (08-REQ-091a; see resolved 08-REVIEW-016)** — *storage vs. exposure*: The `users` table stores `email` at rest (required for OAuth identity matching per [03-REQ-008] and admin designation per §2.16). The exported `UserDoc` shape below is the **user-scoped query/subscription surface** consumed by [08]/[09] for user-facing views (player profile, team-member listing, team management, game-history attribution, leaderboard) and **omits** the `email` field per 08-REQ-091a. Email is returned only by (a) admin-only queries that bypass the user-scoped surface, and (b) [03]'s `resolveIdentity()` / `validateApiKey()` helpers, which act on the caller's own authenticated identity. Any [05] query that selects from `users` for a user-facing consumer must project away `email` at the query boundary. `game_teams.rosterSnapshot` does **not** store `email` — it is a logical membership record (which `operatorUserId`s were on which team for a given game, plus which was Captain); consumers needing a display name resolve `operatorUserId` through the (email-free) `users` query path.

```typescript
interface UserDoc {
  readonly _id: Id<"users">
  readonly displayName: string
  readonly createdAt: number
  readonly archived: boolean
}

interface CentaurTeamDoc {
  readonly _id: Id<"centaur_teams">
  readonly name: string
  readonly displayColour: string
  readonly captainUserId: Id<"users">
  readonly nominatedServerDomain: string | null
  readonly archived: boolean
  readonly healthcheckStatus: "healthy" | "unhealthy" | "unknown" | null
  readonly healthcheckTimestamp: number | null
}

interface CentaurTeamMemberDoc {
  readonly _id: Id<"centaur_team_members">
  readonly centaurTeamId: Id<"centaur_teams">
  readonly operatorUserId: Id<"users">
}

interface RoomDoc {
  readonly _id: Id<"rooms">
  readonly name: string
  readonly ownerId: Id<"users"> | null
  readonly currentGameId: Id<"games"> | null
  readonly enrolledTeamIds: ReadonlyArray<Id<"centaur_teams">>
  readonly archived: boolean
  readonly createdAt: number
}

interface GameDoc {
  readonly _id: Id<"games">
  readonly roomId: Id<"rooms">
  readonly config: GameConfig
  readonly status: "not-started" | "playing" | "finished"
  readonly stdbInstanceUrl: string | null
  readonly stdbModuleName: string | null
  readonly outcome: GameOutcome | null
  readonly finalTurn: number | null
  readonly createdAt: number
  readonly startedAt: number | null
  readonly finishedAt: number | null
  readonly readyTeamIds: ReadonlyArray<Id<"centaur_teams">>
  readonly healthcheckFailures: ReadonlyArray<{
    readonly centaurTeamId: Id<"centaur_teams">
    readonly message: string
  }> | null
  readonly lockedBoardPreview: any | null
  readonly tournamentId: Id<"tournaments"> | null
  readonly tournamentRound: number | null
}

interface GameTeamDoc {
  readonly _id: Id<"game_teams">
  readonly gameId: Id<"games">
  readonly centaurTeamId: Id<"centaur_teams">
  readonly rosterSnapshot: ReadonlyArray<{
    readonly operatorUserId: Id<"users">
    readonly isCaptain: boolean
  }>
}

interface TournamentDoc {
  readonly _id: Id<"tournaments">
  readonly roomId: Id<"rooms">
  readonly totalRounds: number
  readonly interludeSeconds: number
  readonly scheduledStartTime: number
  readonly currentRound: number
  readonly status: "scheduled" | "in_progress" | "completed"
  readonly enrolledTeamIds: ReadonlyArray<Id<"centaur_teams">>
  readonly baseConfig: GameConfig
  readonly createdAt: number
}
```

### 3.2 Game Lifecycle State Machine Types

Motivated by 05-REQ-027, 05-REQ-028. Consumed by [08] for UI state management.

```typescript
type GameStatus = "not-started" | "playing" | "finished"

type GameOutcome =
  | { readonly kind: "victory"; readonly winnerCentaurTeamId: string;
      readonly scores: Record<string, number> }
  | { readonly kind: "draw"; readonly tiedCentaurTeamIds: ReadonlyArray<string>;
      readonly scores: Record<string, number> }
  | { readonly kind: "error"; readonly reason: string }
```

`GameOutcome` matches Module 04 §3.3's `GameOutcome` type. The `scores` keys are Convex `centaur_teams._id` strings.

**State transitions** (exported as an architectural constraint):

```
not-started ──[start orchestration succeeds]──► playing ──[game-end notification]──► finished
     ▲                                                                                  │
     └──────────────────[auto-create (non-tournament)]──────────────────────────────────┘
```

### 3.3 Game Configuration Types

Motivated by 05-REQ-022, 05-REQ-023. Consumed by [08] for config editing UI and by [07] transitively.

The canonical `GameConfig` type (with `GameOrchestrationConfig` and `GameRuntimeConfig` children) is owned by [01] §3.3 and re-exported via [02]. Module 05 does not declare a competing interface; the `gameConfigValidator` in §2.1 is a `v.*` mirror of `[01].GameConfig` whose `Infer<>` type equals it exactly (enforced by the `AssertEqual` check in §2.1). Platform-lifecycle fields — `skipStartConfirmation`, `tournamentMode`, `tournamentRounds`, `tournamentInterludeSec`, `scheduledStartTime` — live as top-level columns on the `games` table alongside `config` and are exported here as a separate `GameLifecycleFields` shape for [08] and API consumers:

```typescript
import type { GameConfig } from "[01]"  // canonical; see [01] §3.3

export type { GameConfig }  // re-exported for convenience

export interface GameLifecycleFields {
  readonly skipStartConfirmation: boolean
  readonly tournamentMode: boolean
  readonly tournamentRounds: number | null
  readonly tournamentInterludeSec: number | null
  readonly scheduledStartTime: number | null
}
```

See resolved [01-REVIEW-017] for the design rationale behind the split. [08]'s config editor renders flat controls over the nested `GameConfig` shape via a view-model transform; unit conversion (ms↔seconds) lives in that transform, not in the contract.

### 3.4 Access Token Issuance Endpoint Contract

Motivated by 05-REQ-035, 05-REQ-030. Consumed by [08] for operator and spectator SpacetimeDB connections.

```typescript
interface AccessTokenIssuanceContract {
  readonly operatorToken: {
    readonly action: "issueOperatorAccessToken"
    readonly input: { readonly gameId: Id<"games"> }
    readonly auth: "Google OAuth (human identity)"
    readonly precondition: "game status === 'playing' AND user is member of participating team"
    readonly output: "RS256-signed JWT with sub: 'operator:{users._id}'"
  }
  readonly botToken: {
    readonly action: "issueBotAccessToken"
    readonly input: { readonly gameId: Id<"games"> }
    readonly auth: "Per-Centaur-Team game credential"
    readonly precondition: "game status === 'playing' AND credential team is participating"
    readonly output: "RS256-signed JWT with sub: 'centaur:{centaur_teams._id}'"
  }
  readonly spectatorToken: {
    readonly action: "issueSpectatorAccessToken"
    readonly input: { readonly gameId: Id<"games"> }
    readonly auth: "Google OAuth (any authenticated human)"
    readonly precondition: "game status === 'playing'"
    readonly output: "RS256-signed JWT with sub: 'spectator:{users._id}'"
  }
  readonly coachToken: {
    readonly action: "issueCoachAccessToken"
    readonly input: { readonly gameId: Id<"games">, readonly centaurTeamId: Id<"centaur_teams"> }
    readonly auth: "Google OAuth (human identity), gated by isCoachOfTeam per [05-REQ-067]"
    readonly precondition: "game status === 'playing' AND isCoachOfTeam(caller, centaurTeamId) AND centaurTeamId is a participant"
    readonly output: "RS256-signed JWT with sub: 'coach:{users._id}:{centaur_teams._id}'"
  }
}
```

**DOWNSTREAM IMPACT**: [08] must call `issueOperatorAccessToken` for operators connecting to SpacetimeDB during live gameplay, `issueBotAccessToken` for Snek Centaur Server bot connections (using the game credential received via invitation), `issueSpectatorAccessToken` for spectator connections, and `issueCoachAccessToken` for coach-mode connections per [08-REQ-052a].

### 3.5 Replay Query Interface

Motivated by 05-REQ-040, 05-REQ-041. Consumed by [08]'s replay viewer.

```typescript
interface ReplayQueryContract {
  readonly getReplay: {
    readonly query: "getReplay"
    readonly input: { readonly gameId: Id<"games"> }
    readonly auth: "Google OAuth (authenticated human)"
    readonly output: {
      readonly gameLog: ReplayGameLog
      readonly visibleTeamIds: ReadonlyArray<Id<"centaur_teams">>
    }
  }
}

interface ReplayGameLog {
  readonly gameConfig: any
  readonly boardState: any
  readonly teams: any
  readonly turns: any
  readonly snakeStates: any
  readonly itemLifetimes: any
  readonly stagedMoves: any
  readonly timeBudgetStates: any
  readonly turnEvents: any
}
```

The `visibleTeamIds` field indicates which teams' within-turn Centaur action log data the current user may access. Replay access is fully public to all authenticated users, so this is always the full set of participating team IDs. The field is preserved in the contract to support future visibility refinements without breaking the consumer.

The replay viewer in [08] uses `visibleTeamIds` to determine which teams' data to display.

**DOWNSTREAM IMPACT**: [08]'s replay viewer uses `visibleTeamIds` when querying [06]'s `getActionLog`. For MVP, all teams are always visible. Board-level replay data (`gameLog`) is always fully visible.

### 3.6 Game-Start Orchestration Contract

Motivated by 05-REQ-032. Coordinates with [06]'s `initializeGameCentaurState`.

```typescript
interface GameStartOrchestrationContract {
  readonly trigger: "administrative actor initiates game start"
  readonly preconditions: readonly [
    "game status === 'not-started'",
    "at least 2 enrolled teams",
    "all enrolled teams have declared ready (or tournament auto-start)",
    "all teams have non-null nominatedServerDomain",
  ]
  readonly sequence: readonly [
    "1. Freeze game config",
    "2. Board generation (locked preview or fresh)",
    "3. Healthcheck (manual games only)",
    "4. STDB provisioning (POST /v1/database with WASM binary)",
    "5. Instance initialization (initialize_game reducer)",
    "6. Game credential issuance + invitation dispatch (10s timeout)",
    "7. Centaur state initialization via initializeGameCentaurState() [06]",
    "8. Status transition to 'playing'",
  ]
  readonly gameEndOrchestration: readonly [
    "1. Receive GameEndNotification (with bundled replayData) at callback endpoint",
    "2. Validate callback token (JWT signature + claims, no stored-token check)",
    "3. Persist replay from bundled replayData to file storage",
    "4. Transition game to 'finished', record outcome",
    "5. Teardown STDB instance (immediate, within same HTTP action)",
    "6. Cleanup Centaur state via cleanupGameCentaurState() [06]",
    "7. Auto-create next game (non-tournament) or advance tournament round",
    "8. Fire webhook notifications",
  ]
}
```

**DOWNSTREAM IMPACT**: [06] must expose `initializeGameCentaurState` and `cleanupGameCentaurState` mutations that [05] calls during game-start and game-end orchestration respectively. The `snakeIds` parameter passed to `initializeGameCentaurState` must match the snake IDs from `generateBoardAndInitialState()`.

### 3.7 HTTP API Contract

Motivated by 05-REQ-045, 05-REQ-049. Consumed by external API clients.

```typescript
interface HttpApiContract {
  readonly authentication: "Bearer API key (admin-only)"
  readonly baseUrl: "CONVEX_SITE_URL/api/v1"
  readonly endpoints: {
    readonly teams: readonly [
      "GET /teams", "GET /teams/:id", "POST /teams",
      "PATCH /teams/:id", "POST /teams/:id/members",
      "DELETE /teams/:id/members/:operatorUserId"
    ]
    readonly rooms: readonly [
      "GET /rooms", "GET /rooms/:id", "POST /rooms",
      "PATCH /rooms/:id", "POST /rooms/:id/enroll",
      "DELETE /rooms/:id/enroll/:teamId"
    ]
    readonly games: readonly [
      "GET /games/:id", "POST /rooms/:roomId/start",
      "PATCH /games/:id/config"
    ]
    readonly webhooks: readonly [
      "GET /webhooks", "POST /webhooks", "DELETE /webhooks/:id"
    ]
  }
  readonly errorCodes: {
    readonly 400: "Validation error"
    readonly 401: "Missing or invalid API key"
    readonly 403: "API key creator is not admin"
    readonly 404: "Resource not found"
    readonly 409: "Conflict (e.g., roster freeze)"
  }
}
```

### 3.8 DOWNSTREAM IMPACT Notes

1. **[08] must implement the game config editing UI against the game object.** Configuration lives on the game record, not the room. The current not-started game is the editable entity. [08] must subscribe to the game record and call `updateGameConfig` to edit parameters. Room creation automatically creates an initial game with default config.

2. **[08] must implement the ready check UX.** Only the Captain of a Centaur Team can declare their team ready. [08] must call `declareReady` and `undeclareReady` mutations. The game's `readyTeamIds` array provides the reactive state for the lobby display.

3. **[08] must implement the board preview and lock-in UX.** [08] calls `generateBoardPreview` to generate a preview from the current game config, and `lockBoardPreview`/`unlockBoardPreview` to manage the locked state. The game's `lockedBoardPreview` field provides the reactive state.

4. **[08] must implement SpacetimeDB access token acquisition.** Operators call `issueOperatorAccessToken`, Snek Centaur Servers call `issueBotAccessToken` (using the game credential), spectators call `issueSpectatorAccessToken`, and coach-mode entry per [08-REQ-052a] calls `issueCoachAccessToken` with the team being coached. All tokens have 2-hour expiry. Tokens are used to establish WebSocket connections to the STDB instance.

5. **[08] must handle replay team visibility.** The `getReplay` query returns `visibleTeamIds` indicating which teams' Centaur action log data the user may see. All teams are always visible to any authenticated user — replay access is fully public.

6. **[08] must implement the `/.well-known/snek-game-invite` endpoint.** The Snek Centaur Server receives `GameInvitationPayload` (Module 03 §4.7) and returns `GameInvitationResponse`. The reference implementation auto-accepts.

7. **[08] must handle tournament UI state.** Games may have `tournamentId` and `tournamentRound` fields. [08] should display tournament progress by querying the `tournaments` table and the tournament's round-games.

8. **[08] must handle healthcheck failure display.** When a game's `healthcheckFailures` field is non-null, [08] should display which teams' servers are failing. The game cannot be started until all healthchecks pass (for non-tournament games).

9. **[07] has no direct dependency on Module 05.** The bot framework operates through [06]'s Centaur subsystem mutations and reads game state from SpacetimeDB. Module 05's game lifecycle orchestration is transparent to the bot framework — the bot only needs a valid SpacetimeDB connection (obtained via `issueBotAccessToken` through [08]).

---

## REVIEW Items

### 05-REVIEW-001: Convex retention of admission-ticket validation secret — **RESOLVED (obsolete)**

**Type**: Ambiguity
**Phase**: Requirements
**Original context**: This review item asked how Convex should store and manage the per-instance HMAC admission-ticket validation secret — whether in the `games` row, a separate secrets table, or retained indefinitely for audit.
**Resolution**: The OIDC auth redesign eliminates per-instance signing secrets entirely. Convex now maintains a single platform-wide RSA key pair (private key in `SPACETIMEDB_SIGNING_KEY` env var, public key served via OIDC JWKS endpoint) for signing all SpacetimeDB access tokens. No per-game secret is generated, stored, or cleaned up. 05-REQ-034 has been rewritten to reflect this. The storage, lifecycle, and cleanup questions that motivated this review item no longer apply.

---

### 05-REVIEW-002: Room deletion and game history preservation — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 05-REQ-021 asserts that a room's lifetime is independent of its games and persists until explicit deletion, but neither the informal spec nor the draft specifies what happens to historical games, replays, and action logs when a room is deleted.
**Decision**: Option A — Rooms cannot be deleted; they can only be archived/hidden from listings while preserving all historical games, replays, and action logs.
**Rationale**: Deletion of a room would cascade to or orphan historical game records, violating [03-REQ-047]'s requirement for stable historical attribution. Archiving achieves the user's intent (hide unused rooms) without data loss. Archived rooms can be unarchived if needed.
**Affected requirements/design elements**: 05-REQ-021 amended to state rooms persist indefinitely with archive-only semantics. 05-REQ-021a added for the archive mechanism.

---

### 05-REVIEW-003: Roster freeze across tournament rounds — **RESOLVED**

**Type**: Gap (inherited)
**Phase**: Requirements
**Decision**: Option B — Tournament-wide freeze from first-round start to final-round end; inter-round interludes remain frozen.
**Rationale**: Allowing roster mutations during inter-round interludes would create a confusing competitive environment where teams can swap members between rounds of a single tournament. The tournament is a coherent competitive unit; its roster should be stable throughout. This is operationally simpler than per-round freezing, and prevents strategic roster manipulation between rounds.
**Affected requirements/design elements**: 05-REQ-064 amended to state tournament-wide roster freeze. Design §2.15 implements the freeze check against the `tournaments` table status.

---

### 05-REVIEW-004: Captain authorization scope bounding of API keys — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Decision**: Admin-only simplification. API keys are an admin-only affordance with global access. Only admin users can create API keys; the per-user scope-bounding mechanism is eliminated.
**Rationale**: The original design required live scope resolution on every request — re-resolving the creator's current permissions, which is complex and has surprising behaviour (scope shrinks if the creator is demoted). Since the HTTP API is intended for programmatic platform management rather than per-user automation, restricting API keys to admin users eliminates this complexity. Admin scope is inherently global, so no scope resolution is needed. This matches the most common deployment pattern where API keys are created by platform operators, not individual team members.
**Affected requirements/design elements**: 05-REQ-045 amended (admin-only authorization). 05-REQ-046 amended (creator must be admin). 05-REQ-047 amended (global admin scope replaces live scope resolution). 05-REQ-051 amended (admin-only creation). 03-REQ-033 and 03-REQ-035 in Module 03 amended to reflect admin-only creation and global scope.

---

### 05-REVIEW-005: Who sees game_start — timing vs who knows the config — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Decision**: Option A — Keep only `game_start` firing at the `not-started → playing` transition. No `game_created` or `game_will_start` event.
**Rationale**: Adding a `game_created` event would fire when the not-started game is created (which happens automatically on room creation and after every game end). This would be noisy and of limited value — the config is still editable at that point. The `game_start` event fires when config is frozen and the game is actually playable, which is the moment subscribers care about. Subscribers who want to pre-stage spectator clients can subscribe to the Convex reactive query on the game record and watch for `status === "playing"`.
**Affected requirements/design elements**: None — 05-REQ-054 stands as drafted.

---

### 05-REVIEW-006: Final scores shape and domain meaning — **RESOLVED (moot)**

**Type**: Gap
**Phase**: Requirements
**Decision**: Already defined upstream. Scoring is defined by Module 01 §1.9 (01-REQ-053: score = sum of body lengths of alive snakes). The `GameEndNotification` payload from Module 04 (§3.3) delivers `GameOutcome` with `scores: Record<string, number>`. Convex consumes these scores directly from the notification — no separate computation needed.
**Rationale**: Module 01 Phase 2 is now complete and defines scores explicitly. Module 04's exported `GameEndNotification` delivers the scores in a JSON-serializable format. Convex stores the outcome directly from the notification payload.
**Affected requirements/design elements**: None — 05-REQ-038 consumes scores from the notification payload as originally intended.

---

### 05-REVIEW-007: "Ready check" semantics and where readiness lives — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Decision**: Option B — Readiness is a field on the game record from game creation onward; the not-started game is created eagerly to hold it. Only the Captain of a Centaur Team is allowed to declare their team ready — no other team member can mark ready. Ready state is cleared whenever a new game is auto-created.
**Rationale**: Storing readiness on the game record (via `readyTeamIds` array) is natural because readiness is inherently per-game — a team ready for game N is not automatically ready for game N+1. The Captain-only restriction aligns with the Captain's role as the team's authorized representative for game-start decisions. Clearing ready flags on auto-create prevents stale readiness from a previous game from triggering an unintended start.
**Affected requirements/design elements**: 05-REQ-031 amended to specify readiness on game record, Captain-only, and clearing on auto-create.

---

### 05-REVIEW-008: Non-tournament auto-create — who owns the room's "current game" invariant — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Decision**: Clarified architecture. The room holds no config state — it is a dumb container for a succession of games with exactly one game being live and editable at a time. All config values live on the game object. When a game finishes, Convex atomically copies its config section into a fresh game object that becomes the new singular live editable not-started game for the room. Tournament-scheduled games follow the same mechanic (game object holds config, room points to it); the only difference is tournament games are auto-started on the tournament schedule without waiting for captain ready declarations. Convex's built-in mutation atomicity prevents race conditions.
**Rationale**: Placing config on the game object rather than the room eliminates the race condition between auto-create and concurrent room parameter edits — there is no room-level config to race against. The room's `currentGameId` pointer provides a single source of truth for which game is currently active. Auto-create atomically creates the new game and updates `currentGameId` in one mutation.
**Affected requirements/design elements**: 05-REQ-016 amended (rooms have no config state). 05-REQ-019 amended (room creation also creates initial game). 05-REQ-022 amended (config on game only). 05-REQ-024 amended (config editable while not-started, frozen at start). 05-REQ-032b amended (board preview on game record). 05-REQ-039 amended (auto-create copies from finished game).

---

### 05-REVIEW-009: Healthcheck failure during game-start orchestration — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Decision**: Differentiated by game type. For manually-started games: if a participating CentaurTeam fails healthcheck during game-start, the game returns to `not-started` status with a healthcheck failure message and visual indicator of which CentaurTeams' servers are failing. The game cannot be manually started until all teams pass healthcheck. For tournament games that are forcefully started on schedule: failing healthcheck is ignored. If the CentaurTeam can get their server running in time to participate, they may; otherwise they lose by default.
**Rationale**: Manual games should not start if a participating server is down — the room admin needs to resolve the issue first, and starting a game with a dead server wastes a SpacetimeDB instance. Tournament games, however, must start on schedule regardless of server health — the tournament timeline cannot be delayed by one team's server issues. This mirrors competitive esports where a team that fails to connect by match time forfeits.
**Affected requirements/design elements**: 05-REQ-036 amended with differentiated healthcheck behaviour.

---

### 05-REVIEW-010: Transitive dependency on Module 01 exported interfaces — **RESOLVED (moot)**

**Type**: Gap
**Phase**: Requirements
**Decision**: Module 01 Phase 2 is complete; its Exported Interfaces section is available. No action needed beyond recording the resolution.
**Rationale**: The concern that prompted this review item (that Module 01's exported types might not align with the informal references used in Module 05) has been resolved by Module 01's Phase 2 completion. All domain types referenced by Module 05 (`BoardSize`, `GameConfig`, `GameOutcome`, `BoardGenerationFailure`, `generateBoardAndInitialState`) are now formally exported by Module 01.
**Affected requirements/design elements**: None.

---

### 05-REVIEW-011: Centaur Team deletion — whether historical references should soft-delete or be allowed at all — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Decision**: Option B — Disallow deletion; provide an archive flag that hides the team from listings and new game enrolments but preserves all live and historical state.
**Rationale**: Deletion of a team, even with cascade to live state and preservation of historical snapshots, creates a degraded experience: the team would no longer appear in leaderboards, profile pages, or team browsers, even though its historical games remain. Archiving achieves the same user intent (hide an inactive team) without losing the team's platform presence. Archived teams can be unarchived if the team becomes active again. This parallels the room archiving decision in 05-REVIEW-002. Note: [06-REQ-041]'s cascade reference to team deletion no longer applies — since teams are never deleted, no cascade is needed.
**Affected requirements/design elements**: 05-REQ-015a amended to replace deletion-with-cascade with archive-only semantics.

---

### 05-REVIEW-012: Per-Centaur-Team game credential scope and lifetime — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Decision**: The per-CentaurTeam game credential JWT has a 2-hour `exp` claim. The credential is strictly scoped to a game instance and becomes useless once that STDB instance is torn down, so there is no need for precise revocation at game-end time. The 2h expiry is well beyond the longest realistic game duration.
**Rationale**: Module 03's design (§3.15) already specifies the game credential as an Ed25519-signed JWT. The `exp` claim provides a hard upper bound on credential validity. The effective lifetime is further bounded by Convex's enforcement that game credentials are only accepted for games with `status === "playing"` — once the game transitions to `finished`, the credential is functionally useless regardless of its `exp`. The 2h expiry provides a comfortable margin for long games while ensuring leaked credentials cannot be used indefinitely. No mid-game refresh mechanism is needed. Module 03's design (§3.15) has been updated to reflect the 2h expiry value per this resolution.
**Affected requirements/design elements**: No requirement amendments needed — the expiry value is a Design concern. The 2h value is reflected in the game-start orchestration design (Section 2.3.1 step 6).

---

### 05-REVIEW-013: Game invitation timeout value — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Decision**: Option A — Fixed timeout of 10 seconds.
**Rationale**: 10 seconds is generous enough for a healthy server to accept an invitation (the accept/reject decision is trivial — just store the credential and return) but short enough to avoid delaying game start for an unresponsive server. The timeout is hardcoded rather than configurable because there is no user-facing need to adjust it — servers are expected to respond promptly to invitations.
**Affected requirements/design elements**: 05-REQ-032 step 5 amended to specify the 10-second timeout.

---

### 05-REVIEW-014: Timekeeper role elimination and role model simplification — **RESOLVED**

**Type**: Simplification
**Phase**: Requirements / Design
**Context**: The informal spec §7.5 designates a "timekeeper" role responsible for operator-mode toggling and turn submission. The original formal spec modeled this as a per-member role in a `roles` array alongside `captain`. During MVP specification, the timekeeper role was identified as unnecessary complexity: (a) no UI affordance for assigning the timekeeper role had been specified, (b) the capabilities assigned to the timekeeper (mode toggling, turn submission) are naturally captain-level actions, and (c) a separate role introduces edge cases around role assignment, freeze semantics, and authorization checking that add no value for the initial platform.
**Decision**: Eliminate the timekeeper role entirely. Merge all timekeeper capabilities into the Captain. Captain designation is enforced structurally via `centaur_teams.captainUserId` (a reference to the captain's `users._id`), not via a per-member role field. The `centaur_team_members` table carries no role information — every member is an Operator. The `game_teams.rosterSnapshot` records each member's `isCaptain` boolean for historical attribution.
**Rationale**: The Captain is already the team's designated authority for game-start readiness, roster management, and server domain nomination. Adding turn-submission and mode-toggling to the Captain's responsibilities is natural and avoids introducing a second privileged role that has no independent lifecycle management. If a future version needs a distinct timekeeper, it can be added as a new field on the team record (analogous to `captainUserId`) without schema migration of the membership table.
**Affected requirements/design elements**: 05-REQ-011 amended (roles array removed; captain is structural property of team). 05-REQ-012 amended (timekeeper assignment removed; captain transfer via `captainUserId` update). 05-REQ-065 amended (simplified role language). Schema: `centaur_team_members.roles` field removed; `game_teams.rosterSnapshot` simplified to `{ operatorUserId, isCaptain }` *(per the 08-REVIEW-016 / 08-REQ-091a sweep: `email` removed from both the stored shape and the exported `GameTeamDoc.rosterSnapshot` — the snapshot is a logical membership record and does not duplicate user metadata; display names are resolved through the (email-free) `users` query path. Note that `users.email` is retained in storage for OAuth identity matching and admin operations, with exposure restricted to admin-only and caller-self surfaces.)*. Module 06 amended: `toggleOperatorMode` authorization changed from timekeeper to captain; `turn_submitted` event attributed to captain; 06-REVIEW-008 context updated. *(Amended per 08-REVIEW-011 resolution: `toggleOperatorMode` no longer exists — operator-mode is replaced by per-operator ready-state per [06-REQ-040b]; per-operator ready-state toggling via `setOperatorReady` is *not* a Captain-only authority (every operator owns their own ready-state). The Captain retains the turn-submit override per [08-REQ-065], which is the live successor to the captain-only authority noted here.)*

---

### 05-REVIEW-015: Callback token storage elimination and replay data bundling — **RESOLVED**

**Type**: Simplification / Architecture
**Phase**: Design
**Context**: The original design stored the game-outcome callback token in the Convex `games` table (`gameEndCallbackToken` field) and compared incoming callback tokens against the stored value. Separately, replay persistence used a Convex-pull pattern: after receiving the game-end notification, Convex scheduled a separate action to retrieve the complete historical record from the STDB instance via HTTP API calls, then tore down the instance in a further scheduled step. This introduced a multi-step asynchronous pipeline (notification → replay pull → teardown) requiring the STDB instance to remain alive throughout.

Two corrections were identified:

1. **Callback token storage is unnecessary.** The callback token is a JWT signed by Convex's own private key. Convex can validate it by verifying the RS256 signature and checking the claims (`iss`, `sub`, `aud`, `exp`) — exactly how any JWT issuer validates its own tokens. Storing the token and comparing against it adds a database field and a read operation for zero security benefit. The JWT's `sub` claim (`stdb-instance:{gameId}`) already binds it to a specific game.

2. **Replay data should be bundled in the game-end notification.** Since the STDB procedure (SpacetimeDB Procedures beta) already has `ctx.http.fetch()` and full read access to all tables, it can read the complete historical record and include it in the notification payload. This eliminates the need for a separate Convex-pull action, allows Convex to tear down the instance immediately upon confirming receipt, and reduces the total number of HTTP round-trips from 2+ (notification + multiple SQL queries + teardown) to 1+1 (notification-with-replay + teardown).

**Decision**: (a) Remove `gameEndCallbackToken` from the Convex `games` table schema. Convex validates incoming callback tokens purely by JWT signature verification and claims checking. (b) The STDB `notify_game_end` procedure bundles the complete `ReplayData` into the `GameEndNotification` payload. Convex processes the replay data inline within the game-end HTTP action and tears down the STDB instance immediately after successful storage. No separate scheduled replay-pull or teardown steps.

**Rationale**: Both changes follow the principle that JWTs are self-contained proofs of authority and should not require server-side storage for validation. Bundling replay data exploits the fact that the procedure already runs post-commit with full table access, and the expected payload size (≤ 300 turns × ≤ 6 teams) is well within HTTP request size limits. The simplified pipeline (single notification → inline processing → immediate teardown) is easier to reason about and reduces STDB instance lifetime.

**Affected requirements/design elements**: 05-REQ-032 step 4 amended (token not stored in Convex). 05-REQ-032a amended (no stored-token comparison). 05-REQ-037 amended (teardown integrated into game-end HTTP action). 05-REQ-038 amended (replay data bundled in notification; teardown integrated). Schema: `gameEndCallbackToken` field removed from `games` table. Section 2.3.2 game-end HTTP action rewritten (no stored-token check; inline replay processing and teardown). Section 2.13 replay persistence rewritten (inline processing of bundled data, not Convex-pull). Module 04 amended: `GameEndNotification` interface gains `replayData` field; §2.10 procedure updated to read and bundle replay tables; §2.11 rewritten from "Replay Export Mechanism" to "Replay Data Bundling"; 04-REVIEW-019 updated.

---
