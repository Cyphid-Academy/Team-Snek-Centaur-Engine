# Module 05: Convex Platform

## Requirements

### 5.1 Scope and Schema Partitioning

**05-REQ-001**: This module shall own the platform-wide portion of the single Convex deployment required by [02-REQ-002]. Platform-wide state comprises user accounts, API keys, registered Centaur Teams and their members, registered Centaur Servers, rooms, games, per-game team snapshots, persisted replays, and webhook subscriptions. Centaur-subsystem state (per-team Drive configuration, per-team heuristic configuration, bot parameters, per-snake live state, sub-turn action log) is owned by [06] and is outside the scope of this module.

**05-REQ-002** *(negative)*: The Convex platform runtime shall not store any state whose authoritative home is the SpacetimeDB game runtime, except for the complete post-game replay record imported under [05-REQ-040]. In particular, while a game is in progress Convex shall not hold a mirror of the SpacetimeDB turn log, staged moves, per-turn snake states, or any other transient game-runtime state.

**05-REQ-003**: The platform-wide schema and the Centaur-subsystem schema owned by [06] shall share a single Convex deployment artifact. This module's schema definitions shall not collide with [06]'s either in table names or in the meaning of shared identifier fields.

---

### 5.2 User Records and Human Identity

**05-REQ-004**: Convex shall maintain a persistent record of every distinct human identity ([03-REQ-002]) that has successfully completed Google OAuth against the platform. Each user record shall capture at minimum the canonical email address (per [03-REQ-008]), a display name, and the timestamp of the identity's first successful authentication.

**05-REQ-005**: A user record shall be created at the moment a Google OAuth authentication yields an email address for which no user record exists. A user record shall never be mutated such that its canonical email address changes; an email change at Google produces a distinct user record per [03-REQ-008].

**05-REQ-006**: The user record shall be the anchor against which all Convex-side human-identity authorization, team membership ([05-REQ-011]), API key ownership ([05-REQ-046]), and historical action attribution is resolved.

**05-REQ-007** *(negative)*: Convex shall not delete user records in response to loss of access to a Google account, nor shall it merge two user records with distinct canonical email addresses. Historical attribution remains anchored to the original email per [03-REQ-047].

---

### 5.3 Centaur Teams, Members, and Registered Servers

**05-REQ-008**: Convex shall maintain a persistent record of every Centaur Team. Each team record shall capture at minimum a team name, a display colour, the user record of the current Captain, and a reference to the team's registered Centaur Server if one exists.

**05-REQ-009**: Convex shall maintain a persistent record of every registered Centaur Server. Each Centaur Server record shall capture at minimum the domain at which the server is reachable (per [03-REQ-003]), a one-to-one binding to the Centaur Team that registered it (per [02-REQ-005] and [03-REQ-003]), the timestamp of the most recent successful challenge-callback against that domain, and a health status derived from healthcheck responses (per [02-REQ-029]).

**05-REQ-010**: The one-to-one binding between a Centaur Team and its registered Centaur Server shall be enforced by Convex: no team shall have more than one registered server, and no server registration shall be shared across teams.

**05-REQ-011**: Convex shall maintain a persistent record of Centaur Team membership associating each human member with the team and with a role. The closed set of roles shall be: Captain, Timekeeper, and Operator. At any given moment a team shall have exactly one Captain and at most one Timekeeper.

**05-REQ-012**: Convex shall permit the Captain of a Centaur Team to add and remove human members from the team, to assign or unassign the Timekeeper role to any current team member, and to transfer the Captain role to another current team member. These mutations shall be subject to the mid-game freeze of [03-REQ-046].

**05-REQ-013** *(negative)*: Convex shall reject any mutation to a Centaur Team's membership, Centaur Server registration, or Captain assignment while that team is participating in a game whose status is `playing`, consistent with [03-REQ-046].

**05-REQ-014**: Convex shall permit the Captain of a Centaur Team to register or update the team's Centaur Server domain. Domain registration shall initiate the challenge-callback protocol of [03-REQ-013]; the server record shall not be marked registered until a successful challenge-callback completes. Domain updates shall invalidate prior Centaur Server credentials per [03-REQ-018].

**05-REQ-015**: Convex shall permit the platform to revoke a registered Centaur Server per [03-REQ-042]. Revocation shall unlink the server from its Centaur Team such that the team has no registered server until a fresh registration completes.

**05-REQ-015a**: Convex shall permit the deletion of a Centaur Team only when the team has no game in the `playing` status. Deletion of a Centaur Team shall cascade to all team-scoped records owned by this module (team membership entries, registered Centaur Server record) and shall cascade to team-scoped Centaur state owned by [06] per [06-REQ-041]. Historical game records that reference the deleted team shall be preserved per [03-REQ-047]; the participating-teams snapshot of each such historical game ([05-REQ-029]) shall continue to resolve the team's historical identity for attribution purposes even after the live team record is deleted. See REVIEW 05-REVIEW-011.

---

### 5.4 Rooms

**05-REQ-016**: Convex shall maintain a persistent record of every Room. Each room record shall capture at minimum a room name, an optional owner (a user record), a reference to the room's current game if one exists, the room's current game-configuration parameter values (per [05-REQ-024]), and the set of Centaur Teams currently enrolled in the room.

**05-REQ-017**: A room's owner shall have administrative control over the room's configuration: parameter values, enrolled teams, and game start. When a room has no owner, any authenticated human identity with access to the room shall hold equivalent administrative control.

**05-REQ-018**: A room's owner shall be able to abdicate ownership, after which the room enters the no-owner state described in [05-REQ-017]. Ownership abdication shall be irreversible within a given room: once abdicated, the platform shall not reassign ownership of that room to any user.

**05-REQ-019**: Convex shall permit authenticated humans to create a room. The creating user shall become the room's owner on creation.

**05-REQ-020**: A room shall require at least two enrolled Centaur Teams before its current game can transition from `not-started` to `playing` ([05-REQ-027]).

**05-REQ-021**: A room's lifetime shall be independent of the lifetimes of the games hosted within it. A room shall persist across any number of sequential games until it is explicitly deleted by an authorized actor.

---

### 5.5 Game Configuration

**05-REQ-022**: Convex shall be the sole source of truth for the configured parameter values of every game and of every room's default parameter values. These values shall be supplied to the SpacetimeDB game instance at initialization time per [05-REQ-032].

**05-REQ-023**: The closed set of game-configuration parameters shall be the following. Each parameter has a type, a default value, and (where applicable) an acceptable range. Convex shall reject any attempt to set a parameter to a value outside its defined range or type.

| Parameter | Type | Default | Range | Notes |
|-----------|------|---------|-------|-------|
| Board size | Enum | Medium | Small \| Medium \| Large \| Giant | Domain enum owned by [01] |
| Max turn time | Seconds | 10 | 1–300 | Per-turn clock cap |
| First turn time | Seconds | 60 | — | Applies to turn 0 only |
| Initial time budget | Seconds | 60 | ≥ 0 | Starting chess-timer budget per team |
| Budget increment | Milliseconds | 500 | 100–5000 | Added to each team's budget each turn |
| Snakes per team | Integer | 3 | 1–10 | Number of snakes each Centaur Team fields |
| Max turns | Integer (optional) | off | ≥ 1 when set | Off = last-team-standing only |
| Max health | Integer | 100 | ≥ 1 | Starting and restored health |
| Hazard % | Integer | 0 | 0–30 | |
| Hazard damage | Integer | 15 | 1–100 | Health lost per turn on a hazard cell |
| Food spawn rate | Decimal | 0.5 | 0–5 | Expected food per turn |
| Fertile ground | Boolean | off | — | |
| Fertile density | Integer % | 30 | 1–90 | Only meaningful when fertile ground is on |
| Fertile clustering | Integer | 10 | 1–20 | Only meaningful when fertile ground is on |
| Invulnerability potions | Boolean | off | — | |
| Invuln potion spawn rate | Decimal | 0.15 | 0.01–0.2 | Only meaningful when invuln potions on |
| Invisibility potions | Boolean | off | — | |
| Invis potion spawn rate | Decimal | 0.1 | 0.01–0.2 | Only meaningful when invis potions on |
| Skip start confirmation | Boolean | off | — | |
| Tournament mode | Boolean | off | — | Enables tournament parameters below |
| Tournament rounds | Integer | 1 | ≥ 1 | Required when tournament mode on |
| Tournament interlude | Seconds | 30 | ≥ 0 | Required when tournament mode on |
| Scheduled start time | Datetime | now + 10 min | — | Required when tournament mode on |

**05-REQ-024**: Convex shall associate a game-configuration parameter set with every room (as the room's defaults) and with every game (as the game's binding parameters). A game's parameter set shall be captured as an immutable snapshot at the moment the game is created; subsequent edits to the room's defaults shall not retroactively affect an already-created game.

**05-REQ-025**: Parameters whose meaning is conditional on another parameter (for example, fertile density and fertile clustering depend on fertile ground being on) shall be validated in a manner consistent with those conditions. Convex shall not refuse to persist a dependent parameter's value merely because its gating parameter is currently off, but shall also not supply that dependent value to the SpacetimeDB game instance when its gating parameter is off.

**05-REQ-026** *(negative)*: The game-configuration parameter set shall not include any parameter that configures bot behaviour, heuristic defaults, or Drive management. Such parameters are owned by [06] and by the Centaur Server web application per [02-REQ-045] through [02-REQ-047].

---

### 5.6 Games and Game Lifecycle Orchestration

**05-REQ-027**: Convex shall maintain a persistent record of every game. Each game record shall capture at minimum the game's room, the bound parameter snapshot ([05-REQ-024]), a status value from the closed set `{ not-started, playing, finished }`, a reference to its SpacetimeDB instance (per [05-REQ-032]), the final scores (populated at game end per [05-REQ-038]), and the timestamps at which the game entered the `playing` and `finished` states.

**05-REQ-028**: Convex shall be the sole authority for every game's status value. Transitions shall be: `not-started → playing` (on successful provisioning and seeding per [05-REQ-032]), `playing → finished` (on receipt of the game's terminal state from the SpacetimeDB instance per [05-REQ-038]). No other transitions shall be permitted.

**05-REQ-029**: Convex shall maintain, for every game, a persistent record of which Centaur Teams are participating in that game and, for each such team, a snapshot of the team's authorized human members and their roles at the moment the game was created. This snapshot shall be treated as append-only historical fact per [03-REQ-047] and shall be used by Convex to seed the SpacetimeDB instance's admission authorization state at initialization time ([03-REQ-039]).

**05-REQ-030**: The game's participating-teams snapshot shall be used, in combination with the team records of [05-REQ-008], to determine which humans and which Centaur Servers are authorized to obtain admission tickets for the game, consistent with [03-REQ-024] and [03-REQ-025].

**05-REQ-031**: Convex shall permit the administrative actor for a room (per [05-REQ-017]) to initiate a game start when all participating teams have marked themselves ready and the room has at least two enrolled teams. Upon successful game start, Convex shall create the game record in the `not-started` status and proceed to provisioning per [05-REQ-032].

**05-REQ-032**: On game start, Convex shall orchestrate the provisioning of a fresh SpacetimeDB game instance per [02-REQ-003] and [02-REQ-020], the deployment of the shared engine codebase ([02-REQ-035]) into that instance, and the invocation of the instance's privileged initialization reducer (owned by [04]) with all of the following: the game configuration snapshot ([05-REQ-024]), the participating-teams snapshot ([05-REQ-029]) sufficient to populate the instance's admission authorization state per [03-REQ-039], and the instance's unique admission-ticket validation secret ([03-REQ-022]). Successful completion of this sequence shall transition the game's status to `playing`.

**05-REQ-032a**: Convex's interactions with the SpacetimeDB hosting platform and with a provisioned instance during the orchestration of [05-REQ-032] shall be authenticated per [03-REQ-048]. As part of the same orchestration, Convex shall register itself as a subscriber to the provisioned instance's game-end notification mechanism ([04-REQ-061a]) no later than the successful completion of that orchestration. This subscription is the mechanism by which Convex later learns of the game's terminal state per [05-REQ-038].

**05-REQ-033** *(negative)*: Convex shall not provision a SpacetimeDB game instance before a game record has been created for it, and shall not create a game record without intending to provision an instance for it. Unorphaned instance-less game records and game-less instances are both disallowed states.

**05-REQ-034**: Convex shall provision a fresh admission-ticket validation secret per SpacetimeDB instance at initialization time ([03-REQ-022]). This secret shall be retained by Convex for the duration of the game so that Convex can sign admission tickets for the instance under [03-REQ-019] and [03-REQ-021]. Convex shall not retain the secret after the instance has been torn down and the replay has been persisted.

**05-REQ-035**: The Convex runtime shall be the sole issuer of admission tickets for every SpacetimeDB game instance it provisions, consistent with [03-REQ-019], [03-REQ-024], [03-REQ-025], and [03-REQ-026]. The Convex runtime shall refuse to issue an admission ticket whose target game is in the `finished` status.

**05-REQ-036**: When a healthcheck call to a participating team's Centaur Server ([02-REQ-029]) returns unhealthy at a moment Convex is preparing to transition a game to `playing`, Convex shall not transition the game to `playing`. The specific recovery action (retry, abort, surface error to operator) is unspecified at the requirements level and shall be determined in Design.

**05-REQ-037**: After a game's status has transitioned to `finished` and its replay has been persisted per [05-REQ-040], Convex shall orchestrate teardown of the SpacetimeDB game instance per [02-REQ-021]. Teardown shall complete before any SpacetimeDB resources associated with the instance are released by the platform.

**05-REQ-038**: Convex shall learn of a game's terminal state — produced by the win-condition check of [01-REQ-050–052] (owned by [01]; specific event shape owned by [04]) — via a runtime-pushed notification delivered through the mechanism of [04-REQ-061a], to which Convex shall have subscribed at game-start orchestration time per [05-REQ-032a]. On receipt of such a notification, Convex shall obtain the game's final scores — either from the notification payload or from the historical record retrieved per [05-REQ-040], at Design's discretion — and write them to the game record, transitioning the game's status to `finished`.

**05-REQ-039**: After a game's status has transitioned to `finished` in a non-tournament context, Convex shall auto-create the next game in the same room, inheriting the room's current parameter defaults (not the just-finished game's snapshot). The next game shall begin in the `not-started` status and shall be distinct from the just-finished game per [02-REQ-020].

---

### 5.7 Replay Persistence

**05-REQ-040**: Before tearing down a SpacetimeDB game instance per [05-REQ-037], Convex shall obtain the complete append-only game record from the instance — comprising all static tables and all turn-keyed tables sufficient to reconstruct any historical turn of the game per [02-REQ-013] — and shall persist this record as a replay associated with the game record. Retrieval may follow any pattern permitted by [04-REQ-061] (Convex-pull via HTTP action, runtime-push to a Convex endpoint, or bundling into the game-end notification of [04-REQ-061a]); in all cases, Convex's access to the instance for retrieval is authenticated per [03-REQ-048].

**05-REQ-041**: The persisted replay shall be sufficient, in combination with the Centaur subsystem action log owned by [06], to reconstruct the complete turn-level history of the game for the platform replay viewer ([09], informal spec §13.2) and the sub-turn team replay viewer ([08], informal spec §13.3).

**05-REQ-042**: While persisting a replay, Convex shall resolve every `stagedBy` attribution in the game record to its Convex-interpretable form per [03-REQ-045]. The persisted replay shall not contain any raw SpacetimeDB connection Identity in a `stagedBy` field.

**05-REQ-043** *(negative)*: Convex shall not begin replay persistence until the game's status has reached the moment at which the SpacetimeDB instance's authoritative game record is final — that is, not before the SpacetimeDB-side terminal state has been signalled per [05-REQ-038].

**05-REQ-044**: A persisted replay shall survive any subsequent teardown of the SpacetimeDB instance. Platform replay viewing and team replay viewing shall never require consulting a SpacetimeDB instance.

---

### 5.8 HTTP API

**05-REQ-045**: Convex shall expose an HTTP API for programmatic management of Centaur Teams, rooms, games, and webhook subscriptions. Every request to this API shall be authorized by a bearer API key per [03-REQ-033] and rejected if the key is missing, invalid, or revoked.

**05-REQ-046**: Convex shall maintain a persistent record of every API key. Each record shall capture at minimum a one-way-hash of the key material (per [03-REQ-034]), a human-chosen label, the user record of the creating human ([03-REQ-035]), the creation timestamp, and a revocation timestamp that is null until the key is revoked. Convex shall never store or expose the plaintext key material after the single creation-time disclosure of [03-REQ-034].

**05-REQ-047**: The HTTP API's authorization scope for a given API key shall be bounded by the authorization scope of the human who created the key, per [03-REQ-035]. If the creating human's team memberships or role assignments change such that their current authorization scope shrinks, the API key's scope shall shrink correspondingly. Convex shall not grant an API key any authorization its creator cannot currently exercise through the Game Platform UI.

**05-REQ-048** *(negative)*: The HTTP API shall not expose endpoints that create human or Centaur Server identities, that perform Google OAuth interactions, that issue admission tickets directly, or that modify Centaur-subsystem state owned by [06]. These affordances are prohibited for API keys by [03-REQ-036] and are not exposed to human users via the Game Platform either.

**05-REQ-049**: The HTTP API shall expose at minimum the following endpoint families. Exact URL shapes and payload schemas are owned by Design; requirements here enumerate the capabilities that must be present.

- **Centaur Teams**: list teams; read a team including name, colour, Captain, members, and registered server domain; create a team; update team name, colour, or server domain; add or remove a team member.
- **Rooms**: list rooms including id, name, creation and update timestamps, and owner; read a room including its current game id and the ids of its historic games; create a room; update a room's configuration; add or remove a Centaur Team from a room's enrollment.
- **Games**: read a game's state including configuration snapshot, status, and final scores (null until `finished`); start a game in a room (triggering the orchestration of [05-REQ-032]).
- **Webhooks**: register a webhook; list registered webhooks; delete a webhook.

**05-REQ-050**: Every mutation made through the HTTP API shall be subject to the same invariants as the equivalent Game Platform UI action, including the mid-game roster freeze of [03-REQ-046].

**05-REQ-051**: The HTTP API shall expose a means by which an authenticated human can create a new API key via the Game Platform UI or via a dedicated endpoint. The plaintext of a newly created API key shall be disclosed to the creator exactly once at creation time ([03-REQ-034]).

**05-REQ-052**: The HTTP API shall expose a means by which an authenticated human can revoke an API key they created. Revocation shall cause all subsequent requests presenting that key to be rejected.

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

**05-REQ-061**: The first round of a tournament shall be scheduled to begin at the Scheduled start time parameter value. Convex shall not begin the first round before that moment regardless of team readiness.

**05-REQ-062**: Each round within a tournament shall inherit the configuration parameters of the enclosing tournament at the moment the round is created. The inherited parameter set shall not include the Tournament mode parameters themselves (Tournament rounds, Tournament interlude, Scheduled start time), which are meta-parameters of the tournament as a whole rather than per-round parameters.

**05-REQ-063**: At the end of a tournament — the conclusion of the final round — Convex shall not auto-create an additional game per [05-REQ-039]. Auto-creation of next-games applies only outside tournament mode.

**05-REQ-064**: The mid-game roster freeze of [03-REQ-046] shall apply per-round within a tournament: during each `playing` round, rosters of participating teams are frozen; between rounds, rosters are not frozen at the Module [03] level. See REVIEW 05-REVIEW-003.

---

## REVIEW Items

### 05-REVIEW-001: Convex retention of admission-ticket validation secret

**Type**: Ambiguity
**Context**: [03-REQ-022] says each SpacetimeDB instance's admission-ticket validation secret is unique and provisioned to that instance at init time. [03-REQ-019] says Convex issues admission tickets, which implies Convex must also hold the secret in order to sign them for the instance to verify. [03-REQ-043] says credential material must only be transmitted over trusted channels to its intended holder. 05-REQ-034 elevates this to a requirement that Convex retains its copy of the secret for the game's duration and drops it at teardown. The informal spec (§2, §11 `games.hmacSecret`) stores the secret in the `games` table, implying persistent Convex storage keyed by game id.
**Question**: Is persistent storage of the admission secret in the `games` row (a) the intended design, (b) acceptable given the threat model, and (c) expected to be dropped at teardown or retained indefinitely in the game record for audit purposes?
**Options**:
- A: Store in `games` row for the game's duration, drop at teardown (current draft of 05-REQ-034).
- B: Store in a separate short-lived secrets table that is cleaned up independently of the game record.
- C: Retain indefinitely alongside the game record for audit; rely on secret rotation / key-at-rest encryption for safety.
**Informal spec reference**: §2, §3 ("SpacetimeDB Admission Tickets"), §11 (`games.hmacSecret`).

---

### 05-REVIEW-002: Room deletion and game history preservation

**Type**: Gap
**Context**: 05-REQ-021 asserts that a room's lifetime is independent of its games and persists until explicit deletion, but neither the informal spec nor the draft specifies what happens to historical games, replays, and action logs when a room is deleted. Deleting the room but preserving its games leaves dangling foreign references; cascading the deletion loses historical attribution that [03-REQ-047] requires to remain stable.
**Question**: What is the policy for room deletion?
**Options**:
- A: Rooms cannot be deleted; they can only be archived/hidden from listings while preserving all historical games.
- B: Rooms can be deleted and the deletion cascades to games and replays (losing history).
- C: Rooms can be deleted only if they contain no finished games; otherwise they must be archived.
- D: Room deletion nulls the game records' room reference but preserves the games themselves as orphaned history.
**Informal spec reference**: §9.1 (Rooms) — silent on deletion.

---

### 05-REVIEW-003: Roster freeze across tournament rounds

**Type**: Gap (inherited)
**Context**: [03-REVIEW-006] explicitly flagged this sub-question against Module 05 as the owner of tournament mode lifecycle. The question is whether a tournament's overall lifetime should freeze rosters across all its rounds (including during the inter-round interlude when no individual round is `playing`) or whether rosters unfreeze between rounds. 05-REQ-064 currently inherits the per-round freeze from [03-REQ-046] and leaves the cross-round case unresolved.
**Question**: Should roster mutations be permitted during the inter-round interlude of a tournament?
**Options**:
- A: No freeze between rounds; rosters unfrozen exactly when no round is `playing`. (Current draft of 05-REQ-064.)
- B: Tournament-wide freeze from first-round-start to final-round-end; inter-round interludes remain frozen.
- C: Freeze is configurable per tournament.
**Informal spec reference**: §9.4 step 4; [03-REVIEW-006] sub-question.

---

### 05-REVIEW-004: Captain authorization scope bounding of API keys

**Type**: Ambiguity
**Context**: 05-REQ-047 (tracing [03-REQ-035]) says an API key's authorization scope is bounded by the creator's current UI authorization scope, and shrinks live with the creator's current scope. This creates a live-dependency between API key enforcement and team-membership state: a Captain who creates an API key and then is demoted would have their API key immediately lose Captain-level privileges. This is arguably correct but has surprising behaviour: organisations often want API keys to represent a stable capability independent of the human who created them. It also complicates the enforcement story because Convex must re-resolve the creator's scope on every request.
**Question**: Which enforcement model applies to API keys?
**Options**:
- A: Live — re-resolve the creator's current scope on every request (current draft of 05-REQ-047).
- B: Frozen-at-creation — capture a snapshot of the creator's scope at API key creation time and bind the key to that snapshot.
- C: Role-based — API keys are scoped to a role rather than to the creator's identity, and remain valid as long as the role exists.
**Informal spec reference**: §3 ("API keys are generated by authenticated users"); §12 ("Authentication").

---

### 05-REVIEW-005: Who sees game_start — timing vs who knows the config

**Type**: Ambiguity
**Context**: 05-REQ-054 says a `game_start` webhook fires when a game transitions to `playing`, which is after provisioning and initialization have completed. But the webhook payload includes the full game configuration snapshot, which is determined at game-record creation ([05-REQ-024]) — an earlier moment. Subscribers who want to act *before* the game starts (e.g., to pre-stage a spectator client) cannot: `game_start` fires after the fact. The informal spec §12 does not distinguish these moments.
**Question**: Should there be a `game_created` or `game_will_start` webhook event in addition to `game_start`?
**Options**:
- A: Keep only `game_start` firing at the `not-started → playing` transition. (Current draft.)
- B: Add `game_created` firing at game record creation, before provisioning; keep `game_start` firing at the transition.
- C: Move `game_start` earlier to fire at game record creation.
**Informal spec reference**: §9.4 (Game Lifecycle); §12 (Webhooks).

---

### 05-REVIEW-006: Final scores shape and domain meaning

**Type**: Gap
**Context**: 05-REQ-038 and 05-REQ-055 refer to "final scores" as the terminal state of a game, and the informal spec §11 shapes it as `{teamId: number}`. But [01] does not yet define what a "score" is in the game rules — [01]'s win condition language is "last team standing" or "max turns reached", neither of which obviously produces a numeric score per team. The shape is carried over from the informal spec without a corresponding requirement in Module 01.
**Question**: Is a numeric per-team score a domain concept owned by [01], or a derived value computed at game end? If derived, by which runtime (SpacetimeDB or Convex) and by what formula?
**Options**:
- A: Score is a domain concept that [01] should define (e.g., sum of surviving snake lengths, or win-status indicator). Flag as upstream gap for Module 01.
- B: Score is a Convex-computed value derived from the terminal state (snake counts, turn count, tiebreakers), owned entirely by Module 05's Design.
- C: Score is opaque — just an unknown map whose only requirement is "present at game end". The meaning is out of scope.
**Informal spec reference**: §11 (`games.scores`); §12 (`GET /api/games/:id`); §5 (turn resolution, §5 phase 10 win condition).

---

### 05-REVIEW-007: "Ready check" semantics and where readiness lives

**Type**: Gap
**Context**: 05-REQ-031 mentions "marked themselves ready" but does not specify where team readiness is stored, how it is cleared, or which actor within a team can mark ready. Informal spec §9.4 step 3 says "Each Centaur Team's Captain (or any operator) marks their team ready." This is a platform-side state that lives somewhere, and since it governs the game-start gate, it is squarely in Module 05's territory — but the requirement is currently vague.
**Question**: Where does team readiness live (room record? team record? ephemeral in-memory? transient game record?) and what clears it?
**Options**:
- A: Readiness is a per-(room, team) flag on the room record, cleared automatically whenever the room's configuration changes and whenever a new game is auto-created.
- B: Readiness is a field on the game record from game creation onward, and the not-started game is created eagerly to hold it.
- C: Readiness is transient and not persistently stored; it is held for the duration of the pre-game lobby session only.
**Informal spec reference**: §9.4 step 3.

---

### 05-REVIEW-008: Non-tournament auto-create — who owns the room's "current game" invariant

**Type**: Ambiguity
**Context**: 05-REQ-016 and 05-REQ-039 together imply that a room always has at most one `not-started` or `playing` game at a time (its `currentGameId`), and that the next game is auto-created immediately on the previous one finishing. If the auto-create fires while administrative actors are mid-edit of the room's parameters, the new game might inherit stale parameters or race against the edit. The informal spec is silent on the atomicity of auto-create vs room parameter edits.
**Question**: How does auto-create interact with concurrent room parameter edits?
**Options**:
- A: Auto-create reads the room's current parameters atomically; any edit in flight is serialized against it.
- B: Auto-create is deferred until the room has been "idle" (no edits, no active session) for a bounded interval.
- C: Auto-create is triggered manually by an administrative actor rather than automatically.
**Informal spec reference**: §9.4 step 7.

---

### 05-REVIEW-009: Healthcheck failure during game-start orchestration

**Type**: Gap
**Context**: 05-REQ-036 asserts that if a participating team's Centaur Server is unhealthy at game-start time, Convex does not transition the game to `playing`, but leaves the specific recovery action to Design. This is an under-specified requirement because it affords multiple mutually incompatible interpretations (retry indefinitely, abort the game, surface to operator, substitute a stub). Requirements-level clarity on the intended behaviour would improve testability.
**Question**: What is the intended recovery action?
**Options**:
- A: Abort the game-start attempt and surface the error to the initiating actor; no retry.
- B: Retry with bounded backoff, then abort on exhaustion.
- C: Surface to the operator and wait indefinitely until either the server becomes healthy or the operator aborts.
**Informal spec reference**: §2 ("Centaur Servers"); §9.4.

---

### 05-REVIEW-011: Centaur Team deletion — whether historical references should soft-delete or be allowed at all

**Type**: Gap
**Context**: 05-REQ-015a was added late in drafting after noticing that [06-REQ-041] names [05] as the owner of team-deletion cascade mechanics. The current draft permits deletion (when the team has no `playing` game) and cascades team-scoped live state while preserving historical game records. This has the same shape of concern as 05-REVIEW-002 (room deletion): deleting a team loses the ability to display that team in leaderboards and profile pages, even though the historical attribution pointer in old games still resolves via the snapshot. An alternative is to disallow deletion entirely in favour of an archive flag.
**Question**: What is the intended lifecycle for Centaur Teams — delete-with-cascade, archive-only, or some hybrid?
**Options**:
- A: Permit deletion when no `playing` game; cascade live state; preserve historical snapshots only. (Current draft.)
- B: Disallow deletion; provide an archive flag that hides the team from listings and new game enrolments but preserves all live and historical state.
- C: Permit deletion only if the team has never participated in a finished game; otherwise require archive.
**Informal spec reference**: N/A (gap).

---

### 05-REVIEW-010: Transitive dependency on Module 01 exported interfaces

**Type**: Gap
**Context**: Several requirements in this module reference domain concepts owned by [01] — board size enum, "turn", snake count, win conditions, scores — via transitive dependency through [02]. Per Context Management Rule 2, during Phase 1 the agent loads full direct dependencies and Exported Interfaces of transitive dependencies. [01] has only Phase 1 drafted, so no Exported Interfaces exist yet. The current draft references [01] requirement IDs and domain concepts informally. When [01] reaches Phase 2, its exported type vocabulary may not line up exactly with the informal references used here, necessitating a reconciliation pass.
**Question**: None — this is a meta-flag for the human to revisit after [01] Phase 2 completes.
**Informal spec reference**: N/A (meta).
