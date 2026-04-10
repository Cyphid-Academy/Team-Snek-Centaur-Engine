# Module 09: Game Platform UI

## Requirements

### 9.1 Scope and Boundary

**09-REQ-001**: This module shall specify the behaviour of the **Game Platform web application** — the single human-facing web client that consumes the platform-wide Convex runtime of [05] and the SpacetimeDB game runtimes of [04] to provide cross-team, cross-game platform affordances. Its scope covers home/navigation, team management, room browsing and creation, the room lobby, live spectating of games in progress, turn-level replay viewing of finished games, player profiles, team profiles, the global leaderboard, and API key management.

**09-REQ-002** *(negative)*: The Game Platform UI shall not provide any affordance for configuring bot parameters, heuristic defaults, Drive management, per-snake operator assignment, manual mode, or any other Centaur-subsystem state. These are the exclusive domain of the Centaur Server web application served by each team's own Centaur Server (informal spec §7; outside the dependency scope of this module). This negative requirement traces to [02-REQ-045] through [02-REQ-047] and to [05-REQ-026].

**09-REQ-003** *(negative)*: The Game Platform UI shall not provide any affordance for staging moves, selecting snakes, toggling operator modes, or otherwise acting as an operator during live gameplay. The platform UI's live-gameplay surface is restricted to read-only spectating ([09-REQ-040]).

**09-REQ-004**: The Game Platform UI shall be the sole user interface through which the HTTP API affordances of [05-REQ-049] that a human can exercise — in particular team management, room management, and game start — are made available to humans who prefer a UI to API calls. The UI shall not expose affordances that the HTTP API prohibits per [05-REQ-048].

**09-REQ-005**: Every mutating action taken by the Game Platform UI shall be dispatched against the platform Convex runtime of [05] and shall be subject to the same invariants as the equivalent HTTP API call, including the mid-game roster freeze of [03-REQ-046] and [05-REQ-013]. The UI shall not attempt to bypass or work around any Convex-side invariant; where an action is disallowed by Convex, the UI shall surface the rejection to the user.

---

### 9.2 Authentication and Session

**09-REQ-006**: The Game Platform UI shall require every user to authenticate as a human identity per [03-REQ-002] before exposing any affordance other than a sign-in control and public, non-user-specific information (for example, the public leaderboard per [09-REQ-068]). Authentication shall use the Google OAuth flow of [03-REQ-008].

**09-REQ-007**: Upon successful authentication, the Game Platform UI shall resolve the authenticated identity to a user record per [05-REQ-004] and [05-REQ-005]. All subsequent UI actions shall be attributed to that user record for the duration of the session.

**09-REQ-008**: The Game Platform UI shall provide a sign-out control that terminates the user's session on the client and revokes any client-held session tokens. After sign-out, the UI shall return to the unauthenticated state of [09-REQ-006].

**09-REQ-009** *(negative)*: The Game Platform UI shall not store, display, or transmit the plaintext of any admission ticket, API key, HMAC secret, or other credential material except during the single creation-time disclosure of an API key plaintext per [05-REQ-051] and [03-REQ-034].

---

### 9.3 Home and Navigation

**09-REQ-010**: The Game Platform UI shall present, as the authenticated user's home view, at minimum: the list of Centaur Teams of which the user is a current member (per [05-REQ-011]), the list of rooms the user has recently visited, and the list of games currently in progress (status `playing` per [05-REQ-028]) in which any of the user's Centaur Teams are participating. Each listed item shall link directly to its corresponding detailed view.

**09-REQ-011**: The Game Platform UI shall present a persistent global navigation control, visible on every authenticated view, that provides direct navigation to at minimum the following destinations: the Rooms browser ([09-REQ-018]), the Teams browser ([09-REQ-012]), the user's own Player Profile ([09-REQ-061]), and the global Leaderboard ([09-REQ-068]).

**09-REQ-012**: The Game Platform UI shall provide a Teams browser that lists all Centaur Teams known to the platform per [05-REQ-008], with at minimum the team's name, display colour, and current Captain. Each listed team shall link to that team's public profile ([09-REQ-064]).

---

### 9.4 Team Management

**09-REQ-013**: The Game Platform UI shall permit any authenticated user to create a new Centaur Team per [05-REQ-008]. On creation, the creating user shall become the team's Captain per [05-REQ-011].

**09-REQ-014**: The Game Platform UI shall provide a Team Management view accessible to every current member of a team. The view shall display at minimum the team's name, display colour, current Captain, current members with their roles, and the registered Centaur Server domain together with its latest health status and last-checked timestamp per [05-REQ-009] and [02-REQ-029].

**09-REQ-015**: The Team Management view shall expose, exclusively to the team's current Captain, affordances to mutate team identity (name, display colour), to register or update the team's Centaur Server domain (per [05-REQ-014], triggering the challenge-callback protocol of [03-REQ-013]), to add or remove human members (per [05-REQ-012]), to assign or unassign the Timekeeper role to a current member (per [05-REQ-011]), and to transfer the Captain role to another current member (per [05-REQ-012]).

**09-REQ-016**: The Team Management view shall, while a team is participating in any game whose status is `playing`, visibly disable the mutating affordances of [09-REQ-015] that are frozen by [05-REQ-013], and shall explain to the user that the affordance is temporarily unavailable due to a game in progress.

**09-REQ-017** *(negative)*: The Team Management view shall not expose any affordance for configuring bot parameters, Drive portfolios, heuristic defaults or overrides, snake operator assignment, or any other Centaur-subsystem state. This is the exclusive domain of the team's own Centaur Server web application per [09-REQ-002]. The view may display a link or instruction directing the user to their Centaur Server's own web application for these affordances.

---

### 9.5 Room Browser and Creation

**09-REQ-018**: The Game Platform UI shall provide a Room Browser that lists every room persisted by [05-REQ-016], with at minimum: the room name, the room's optional owner (per [05-REQ-017]), the number of Centaur Teams currently enrolled, and whether the room has a game currently in status `playing` per [05-REQ-028].

**09-REQ-019**: The Room Browser shall support filtering and searching the listed rooms by room name. Any additional filter criteria shall be a Design decision; requirements level mandates only name-based search.

**09-REQ-020**: The Room Browser shall expose an affordance by which any authenticated user may create a new room per [05-REQ-019]. Room creation shall require at minimum a room name; the creating user shall become the room's owner. The UI shall treat the resulting room creation as a mutation against Convex per [09-REQ-005].

**09-REQ-021**: Every listed room in the Room Browser shall link directly to the Room Lobby view of [09-REQ-022] for that room.

---

### 9.6 Room Lobby

**09-REQ-022**: The Game Platform UI shall provide a Room Lobby view for every room listed in the Room Browser. The Room Lobby view shall display at minimum: the room's current owner (or the no-owner state per [05-REQ-017]), the room's current game-configuration parameter values per [05-REQ-023], the set of Centaur Teams currently enrolled in the room per [05-REQ-016], and the readiness state of each enrolled team.

**09-REQ-023**: The Room Lobby view shall be accessible to every authenticated user. Users who are neither the room owner nor members of an enrolled team shall see the lobby in a read-only form and shall have no mutating affordance.

**09-REQ-024**: The Room Lobby view shall expose, exclusively to the administrative actor for the room defined by [05-REQ-017] (the owner, or any authenticated user when there is no owner), affordances to edit every game-configuration parameter of [05-REQ-023] within its defined range, to invite or remove Centaur Teams from enrolment, to abdicate ownership per [05-REQ-018], and to start the game per [05-REQ-031].

**09-REQ-025**: The Room Lobby view's parameter-editing affordance shall enforce each parameter's type and range by refusing to submit values outside the acceptable range per [05-REQ-023], providing inline feedback to the user before any mutation is dispatched. This client-side enforcement shall be treated as a user-experience affordance only; the authoritative enforcement remains with Convex per [05-REQ-023].

**09-REQ-026**: The Room Lobby view's parameter-editing affordance shall honour the conditional-parameter semantics of [05-REQ-025]: parameters whose meaning is conditional on a gating parameter shall be visually gated on that parameter and, when gating parameters are off, shall not block the user from persisting the dependent value but shall communicate that the dependent value is currently inactive.

**09-REQ-027**: The Room Lobby view shall expose, exclusively to members of an enrolled Centaur Team, affordances to mark that team ready and to unmark that team ready, consistent with the ready-check semantics of [05-REQ-031] (see 09-REVIEW-002 for the interaction with 05-REVIEW-007). The affordance shall be available to any team member whom [05] permits to mark the team ready; the requirement is technology-agnostic with respect to which exact role holds this capability, deferring to Module 05's eventual resolution.

**09-REQ-028**: The Room Lobby view shall expose, exclusively to members of an enrolled Centaur Team, an affordance to ping the team's registered Centaur Server's healthcheck per [02-REQ-029] and [05-REQ-009], surfacing the result to the lobby view.

**09-REQ-029**: The Room Lobby view shall enable the game-start affordance of [09-REQ-024] only when the room has at least two enrolled Centaur Teams per [05-REQ-020] and every enrolled team has been marked ready. When the affordance is disabled, the view shall communicate to the administrative actor which precondition is currently unmet.

**09-REQ-030**: The Room Lobby view shall provide a **Board Preview** affordance that renders a miniature visualisation of the board geometry — including approximate placement of fertile tiles, hazards, and snake starting territories — derived from the room's current game-configuration parameter values. The preview shall regenerate as the administrative actor edits parameters; the regeneration cadence is a Design-level concern. See 09-REVIEW-001.

**09-REQ-031**: The Board Preview shall expose an affordance by which the administrative actor may **lock in** a specific generated preview to be used as the exact starting layout for the next game created in the room. When a preview is locked in, Convex shall be informed of that intent such that the subsequent game-start orchestration of [05-REQ-032] seeds the SpacetimeDB instance with the locked-in layout rather than a freshly generated one. See 09-REVIEW-003 for the unresolved question of where in the Module 05 schema the locked-in preview lives.

**09-REQ-032** *(negative)*: The Board Preview shall not stage, commit, or otherwise affect the currently-playing game in the room. Board Preview affects only the *next* game-start invocation, consistent with the immutable-parameter-snapshot rule of [05-REQ-024].

**09-REQ-033**: The Room Lobby view shall, when the room has a game whose status is `playing`, provide a direct link from the lobby to the Live Spectating view of that game per [09-REQ-034].

---

### 9.7 Live Spectating

**09-REQ-034**: The Game Platform UI shall provide a **Live Spectating** view for any game whose status is `playing` per [05-REQ-028]. The view shall be accessible to every authenticated user without requiring membership in any participating Centaur Team.

**09-REQ-035**: Entry to the Live Spectating view shall cause the UI to obtain a **spectator admission ticket** for the target SpacetimeDB game instance, issued by Convex per [03-REQ-026], [05-REQ-035], and the spectator-ticket provisions of [03]. The UI shall present this ticket to the runtime when establishing its subscription connection per [04-REQ-018].

**09-REQ-036**: The Live Spectating view shall subscribe to the SpacetimeDB game instance's state using subscription patterns that satisfy [04-REQ-054]'s support for a current-state view with incremental updates. The UI shall render board state, snake states, items, hazards, fertile tiles, and turn events as delivered by the subscription, in real time.

**09-REQ-037**: The Live Spectating view's rendering shall honour the invisibility semantics of [04-REQ-047] without any client-side workaround: a snake whose `visible` field is `false` shall not be displayed to a spectator connection, consistent with the server-side filter. The UI shall not attempt to infer or reconstruct invisible-snake state from any channel.

**09-REQ-038**: The Live Spectating view shall display a **scoreboard** per participating team, showing at minimum each team's aggregate alive-snake length (as a proxy for team score pending resolution of 05-REVIEW-006) and each alive snake's current length and health. The scoreboard shall update live in response to subscription deliveries.

**09-REQ-039**: The Live Spectating view shall display the current turn number and, per participating team, the team's current remaining chess-timer budget and whether the team has declared its turn over for the current turn, consistent with the per-team time-budget data supplied by [04]'s subscription interface.

**09-REQ-040** *(negative)*: The Live Spectating view shall not expose any affordance that stages moves, selects snakes, toggles operator modes, or otherwise mutates game-runtime or Centaur-runtime state. Spectator admission tickets per [03-REQ-026] do not authorise any such mutation and the UI shall not attempt any, consistent with [09-REQ-003].

**09-REQ-041**: The Live Spectating view shall provide a **timeline scrubber** that permits the spectator to navigate to any previously completed turn of the current game and view the reconstructed board, snake, item, scoreboard, and event-log state at that turn, using the historical query capability of [04-REQ-057]. Scrubbing backward shall not interrupt the incoming live subscription; returning to the live head shall resume live rendering.

**09-REQ-042**: While the spectator is scrubbed to a historical turn, the Live Spectating view shall visibly communicate to the user that the display is not live, and shall provide a one-action affordance to return to the live head.

**09-REQ-043**: The Live Spectating view shall release its subscription and discard its spectator admission ticket when the user navigates away from the view or when the game transitions to `finished` per [05-REQ-028].

---

### 9.8 Platform Replay Viewer

**09-REQ-044**: The Game Platform UI shall provide a **Platform Replay Viewer** for any game whose status is `finished` per [05-REQ-028] and for which a persisted replay exists per [05-REQ-040]. The Replay Viewer shall be accessible to every authenticated user.

**09-REQ-045**: The Platform Replay Viewer shall source all displayed data exclusively from the persisted replay of [05-REQ-040] and shall never consult a SpacetimeDB game instance, consistent with [05-REQ-044]. The platform UI shall therefore remain functional for replay viewing after the source game's SpacetimeDB instance has been torn down per [05-REQ-037].

**09-REQ-046**: The Platform Replay Viewer shall render board state at turn granularity: the cell layout, snake positions and bodies, items, hazards, fertile tiles, and per-team scoreboard shall be shown for the currently-selected turn. The rendering shall be visually consistent with the Live Spectating view of [09-REQ-036] such that a spectator's familiarity with the live view carries over to the replay view.

**09-REQ-047**: The Platform Replay Viewer shall display a per-turn **event log** listing the turn events of the currently-selected turn as produced by turn resolution — at minimum death events (with cause), food-eaten events, potion-collection events, severing events, spawn events, and effect-application / effect-cancellation events. The set of event types shall match the closed enumeration defined by [01] and [04].

**09-REQ-048**: The Platform Replay Viewer shall provide a **timeline scrubber** supporting direct jump to any turn in the replay, plus play, pause, and playback-speed controls with at minimum the speeds 0.5×, 1×, 2×, and 4×.

**09-REQ-049**: The Platform Replay Viewer shall render the replay at turn granularity only. Sub-turn scrubbing — the display of progressively-computed Centaur state, snake selections, Drive adjustments, and other sub-turn team experience — is the exclusive responsibility of the Centaur team replay viewer of [08] per informal spec §13.3 and shall not be attempted by the platform replay viewer, consistent with the scope delineation of informal spec §13.2 and §13.3.

**09-REQ-050**: The Platform Replay Viewer shall expose a **direct link** affordance that produces a URL identifying the specific game being viewed, such that another authenticated user opening the URL in the Game Platform UI is taken directly to that game's Platform Replay Viewer.

**09-REQ-051** *(negative)*: The Platform Replay Viewer shall not reconstruct or display any data that depends on the Centaur-subsystem action log of [06]. In particular, the platform replay viewer shall not display which operator had selected which snake at any moment, nor any per-operator coloured shadows, nor any stateMap / worst-case-world / heuristic breakdown data.

---

### 9.9 Player Profile

**09-REQ-052**: The Game Platform UI shall provide a **Player Profile** view for every user record per [05-REQ-004]. Each authenticated user shall have direct access to their own Player Profile via the global navigation of [09-REQ-011]. Access to other users' profiles shall be permitted at minimum via links from team member listings and game history (see 09-REVIEW-004 for the scope of public profile visibility).

**09-REQ-053**: The Player Profile view shall display at minimum the user's display name, email address (subject to 09-REVIEW-004), current and historical Centaur Team memberships, and a chronological **game history** listing every game in which the user participated (via the per-game participating-team snapshot of [05-REQ-029]) together with each game's room, date, the participating teams, the final result (win/loss/draw), and the final scores per [05-REQ-038].

**09-REQ-054**: The Player Profile view shall display aggregate statistics derived from the user's game history: at minimum, games played, win rate, and average team score. These statistics shall be computed from the same data that populates the game history listing and shall therefore be consistent with it.

**09-REQ-055**: The Player Profile view shall resolve historical team attributions using the participating-team snapshot of [05-REQ-029] rather than the current team record, so that a historical game continues to show the team the user was playing for at the time even if the user has since changed teams or the team has been deleted per [05-REQ-015a].

---

### 9.10 Team Profile

**09-REQ-056**: The Game Platform UI shall provide a **Team Profile** view for every Centaur Team per [05-REQ-008]. The Team Profile shall be accessible to every authenticated user (see 09-REVIEW-004 on the scope of public visibility).

**09-REQ-057**: The Team Profile view shall display at minimum the team's name, display colour, current Captain, current members and their roles per [05-REQ-011], the team's registered Centaur Server domain and its latest health status per [05-REQ-009], and a chronological game history listing every game in which the team participated, with each game's room, date, opposing teams, final result, and final scores.

**09-REQ-058**: The Team Profile view shall display aggregate statistics derived from the team's game history: at minimum, games played, win rate, average score, and head-to-head records against each other team the team has ever played against.

**09-REQ-059**: The Team Profile view shall resolve historical opponent attributions using the participating-team snapshots of [05-REQ-029] so that head-to-head records remain stable even if an opposing team has since been deleted per [05-REQ-015a].

**09-REQ-060** *(negative)*: The Team Profile view shall not expose any mutating affordance over team state. Mutation of team state is the exclusive responsibility of the Team Management view of [09-REQ-014], which enforces the Captain-only scope of [09-REQ-015] and the mid-game freeze of [09-REQ-016].

---

### 9.11 Leaderboard

**09-REQ-061**: The Game Platform UI shall provide a global **Leaderboard** view that ranks Centaur Teams by one of a closed set of criteria. The closed set shall be at minimum: win rate (with a minimum games-played qualifying threshold), total wins, and average score.

**09-REQ-062**: The Leaderboard view shall permit the user to switch between the criteria of [09-REQ-061] and to filter results by time window from a closed set including at minimum: all time, last 30 days, and last 7 days.

**09-REQ-063**: The Leaderboard view shall permit optional restriction of the ranking to games played within a specific room. When a room restriction is applied, the ranking shall consider only games whose room matches.

**09-REQ-064**: The Leaderboard view shall link each ranked team directly to that team's Team Profile view per [09-REQ-056].

**09-REQ-065**: The Leaderboard view shall resolve historical attributions using the participating-team snapshots of [05-REQ-029], so that a team's ranking continues to reflect games it played under its historical identity even if the team has since been deleted per [05-REQ-015a]. See 09-REVIEW-005 on whether deleted teams should continue to appear in the leaderboard.

**09-REQ-066** *(negative)*: The Leaderboard view shall not be accessible in a way that exposes team or player data to unauthenticated visitors. Leaderboard access is subject to the authentication requirement of [09-REQ-006]. See 09-REVIEW-004.

---

### 9.12 API Key Management

**09-REQ-067**: The Game Platform UI shall provide an **API Key Management** view accessible to every authenticated user, through which the user may create new API keys per [05-REQ-051] and revoke API keys they previously created per [05-REQ-052]. The view shall list the user's active and revoked API keys with at minimum each key's human-chosen label, creation timestamp, and revocation timestamp where applicable.

**09-REQ-068**: When an API key is created via the API Key Management view, the UI shall display the key's plaintext exactly once, at the moment of creation, consistent with [05-REQ-046] and [03-REQ-034]. After that single display, the UI shall never present the plaintext again. The UI shall provide an explicit affordance for the user to copy the plaintext to their clipboard before dismissing the creation dialog.

**09-REQ-069** *(negative)*: The API Key Management view shall never display, store, or transmit API key plaintext except during the single creation-time disclosure of [09-REQ-068]. Subsequent views of the key shall show only its label and metadata per [09-REQ-067].

**09-REQ-070**: The API Key Management view shall visibly communicate to the user that an API key's authorization scope is bounded by the user's own current authorization scope per [05-REQ-047], so that the user understands that losing team roles or membership will correspondingly reduce what actions their API keys can perform (subject to 05-REVIEW-004).

---

### 9.13 Cross-Cutting UI Invariants

**09-REQ-071**: The Game Platform UI shall surface Convex-side invariant rejections (per [09-REQ-005]) to the user as explicit, user-legible feedback at the point of the rejected action. The UI shall not silently swallow rejection errors.

**09-REQ-072**: The Game Platform UI shall treat any affordance whose authoritative enablement is governed by a Convex-side invariant (for example, mid-game roster freeze, minimum team count, ready-check gate) as an affordance whose *enabled* state in the UI must be derivable from Convex-held state, not from client-held optimism. Where this derivation is not yet possible because the invariant lives only in Convex mutation handlers, the UI shall still dispatch the mutation and surface the result per [09-REQ-071].

**09-REQ-073**: The Game Platform UI shall honour the distinction between the immutable parameter snapshot bound to a game ([05-REQ-024]) and the current parameter defaults held on a room. In particular, viewing a game's configuration — whether the game is `playing`, `finished`, or referenced from replay or history — shall show the game's snapshotted parameters, not the room's current defaults, even if the two differ.

**09-REQ-074** *(negative)*: The Game Platform UI shall not embed or re-implement any portion of the Centaur Server web application of informal spec §7. Where a user needs to access the Centaur Server web application, the platform UI may link out to the team's Centaur Server domain, but shall not attempt to proxy, mirror, or duplicate its affordances. See 09-REVIEW-006.

**09-REQ-075**: The Game Platform UI shall be resilient to the loss of a Centaur Team record per [05-REQ-015a]: views that reference historical teams (game histories, leaderboards, profiles) shall continue to render using the participating-team snapshot, and views that reference a currently-live team that has been deleted shall present the deletion to the user explicitly rather than failing or showing broken references.

---

## REVIEW Items

### 09-REVIEW-001: Board preview generation locality

**Type**: Ambiguity
**Context**: [09-REQ-030] describes a miniature board preview that regenerates as the administrative actor edits room configuration parameters. The informal spec §8.4 says the preview is a "miniature rendering" with "approximate layout of fertile tiles, hazards, and snake starting territories given current settings." Two questions are underspecified: (a) is the preview generated client-side by running a JavaScript port of the board-construction algorithm owned by [01], or server-side by Convex calling into a shared engine codebase per [02-REQ-035]; (b) does the preview need to be deterministic with a seed such that locking one in ([09-REQ-031]) reliably reproduces the same layout at game start?
**Question**: Where is the preview generated, and is determinism via seed required for lock-in to work?
**Options**:
- A: Client-side generation using a shared algorithm port; lock-in persists the seed only; [04] honours the seed at game init.
- B: Server-side generation via a Convex action; lock-in persists the server-generated layout directly; [04] honours the layout as a supplied parameter rather than regenerating from a seed.
- C: Client-side generation without lock-in guarantee (the preview is decorative only); lock-in is removed as a feature.
**Informal spec reference**: §8.4 (Room Lobby, Board preview).

---

### 09-REVIEW-002: Who marks a team ready

**Type**: Gap (inherited from 05-REVIEW-007)
**Context**: [09-REQ-027] defers to [05] on which role within a team is permitted to mark the team ready. The informal spec §9.4 says "Captain or any operator", but 05-REVIEW-007 leaves the persistence and scope of readiness unresolved. Until 05-REVIEW-007 is resolved, the UI cannot fully specify its enablement logic.
**Question**: Which roles within an enrolled team may mark the team ready and unmark it?
**Options**:
- A: Captain only.
- B: Captain or any member with the Operator role.
- C: Any current team member regardless of role.
**Informal spec reference**: §9.4 step 3.

---

### 09-REVIEW-003: Where a locked-in board preview is persisted

**Type**: Gap
**Context**: [09-REQ-031] says lock-in of a board preview must cause the subsequent game-start orchestration of [05-REQ-032] to seed the game with the locked-in layout. But [05] does not currently have a requirement acknowledging this — [05-REQ-024] talks about parameter snapshots, not generated-content snapshots. A locked-in preview is neither a parameter value nor a derived-from-parameters quantity; it is a concrete board layout that needs to live somewhere in the Convex schema and be plumbed through to [04]'s `initialize_game` reducer.
**Question**: Does the locked-in preview belong in the room record, the next-game's record, or in a separate preview table? And does it extend [05-REQ-032]'s required init payload?
**Options**:
- A: Add a field on the room record holding the currently-locked preview, consumed and cleared at next game-start.
- B: Create the game record eagerly at lock-in time and attach the preview to it.
- C: The locked preview is not persisted at all; it is re-rendered at game-start from a persisted seed and the current parameters.
**Informal spec reference**: §8.4 (Room Lobby, Board preview lock-in); §9.4 (Game Lifecycle).

---

### 09-REVIEW-004: Public vs authenticated-only visibility of profiles and leaderboard

**Type**: Ambiguity
**Context**: The informal spec §8.7 and §8.8 describe Player Profile and Team Profile pages as "public" in one place and as accessible to "any authenticated user" in others. The current draft assumes authentication is required for all platform views ([09-REQ-006]) but this is in tension with the "public" framing. A related question is whether email addresses on Player Profiles should be visible to all authenticated users or only to the profile owner and their team-mates.
**Question**: Are team and player profiles public (accessible without authentication) or authenticated-only? And what is the visibility scope of email addresses on Player Profiles?
**Options**:
- A: Authentication required for all views (current draft of 09-REQ-006). Emails visible to all authenticated users.
- B: Team and player profile pages are public and indexable. Emails hidden except on the user's own profile.
- C: Team profile public, player profile authenticated-only. Emails hidden everywhere except self-view.
**Informal spec reference**: §8.7, §8.8.

---

### 09-REVIEW-005: Deleted teams in leaderboards

**Type**: Gap
**Context**: [05-REQ-015a] permits Centaur Team deletion while preserving historical participating-team snapshots. [09-REQ-065] currently says the leaderboard continues to resolve historical teams via snapshots, implying a deleted team could still appear in leaderboards under its historical identity. This may be undesirable — a team might be deleted because it was created in error, was used for spam, or belonged to a departed user — and the leaderboard may want to hide it. On the other hand, hiding it rewrites historical outcomes.
**Question**: Should deleted Centaur Teams continue to appear in the global leaderboard?
**Options**:
- A: Yes — deleted teams continue to appear under their historical identity; deletion is purely a live-state operation. (Current draft.)
- B: No — deleted teams are excluded from leaderboard listings but remain in per-game history where they participated.
- C: Configurable per leaderboard view with a "include deleted teams" toggle.
**Informal spec reference**: N/A (gap). See also 05-REVIEW-011.

---

### 09-REVIEW-006: Discoverability of the Centaur Server web application from the Game Platform

**Type**: Proposed Addition
**Context**: [09-REQ-074] forbids the Game Platform UI from embedding or re-implementing the Centaur Server web application. But a team operator who lands on the Game Platform and wants to configure heuristics or Drives needs to be told where to go. The Team Management view ([09-REQ-014]) already displays the team's registered server domain; the question is whether the UI should *also* explicitly direct users to visit that domain to access bot/heuristic configuration.
**Question**: Should the Game Platform UI provide an explicit link from the Team Management view to the team's Centaur Server web application, together with explanatory text about the division of responsibilities?
**Options**:
- A: Yes — add a prominent link and explanation on Team Management.
- B: No — the division of responsibilities is documented externally and the UI should not encourage users to leave the platform.
- C: Display only if the Centaur Server's healthcheck is currently healthy.
**Informal spec reference**: §7 (Centaur Server Web Application); §8.2 (Team Management).

---

### 09-REVIEW-007: Live spectating when invisibility is active

**Type**: Ambiguity
**Context**: [09-REQ-037] says the spectator view honours invisibility filtering per [04-REQ-047] — i.e., invisible snakes simply are not delivered to spectator subscriptions. But the spectator is nonetheless a third-party observer whose scoreboard ([09-REQ-038]) aggregates alive-snake lengths per team. If a team has an invisible snake, the spectator's scoreboard either (a) reflects the reduced visible length (misleading — the snake is still alive), (b) reflects the true aggregate (requires server-side calculation with team privilege, violating the spectator-view data model), or (c) omits the invisible snake from the count while marking the score as "partial." This tension is not addressed by the informal spec.
**Question**: How does the spectator scoreboard handle invisible snakes?
**Options**:
- A: The scoreboard shows only what the spectator subscription delivers; invisible snakes are simply not counted. The spectator experience is intentionally lossy.
- B: The scoreboard shows true aggregates computed server-side using a privileged aggregate query that bypasses per-snake visibility; only aggregates are disclosed, not per-snake state.
- C: The scoreboard distinguishes "visible length" from "total length, some hidden," alerting the spectator that hidden snakes exist on that team.
**Informal spec reference**: §8.5 (Live Spectating); §4.3 (Invisibility potion semantics).

---

### 09-REVIEW-008: Timeline scrubber data delivery for long games

**Type**: Gap
**Context**: [09-REQ-041] asserts the spectator timeline scrubber leverages [04-REQ-057] historical reconstruction. [04-REQ-054]'s subscription patterns mention that a client joining mid-game can subscribe to full history. For short games this is fine, but for long games (tournament rounds, extended max-turn games) the initial delivery could be sizable. The question is whether the UI must demand full history up-front on entry to the spectator view or can lazily fetch historical slices as the user scrubs.
**Question**: Does live spectating entry require an up-front full-history subscription, or does the UI fetch historical slices on demand?
**Options**:
- A: Up-front full subscription — simplest client code, possibly slow entry on long games.
- B: Live-only subscription on entry; lazy-fetch historical slices via query only when the user scrubs backward.
- C: Hybrid — subscribe to current turn + a configurable window (e.g., last 20 turns) on entry; lazy-fetch beyond that.
**Informal spec reference**: §8.5 (Live Spectating timeline scrubber); §10 (Client Query Patterns).

---

### 09-REVIEW-009: Game-in-progress discoverability on the home view

**Type**: Ambiguity
**Context**: [09-REQ-010] says the home view lists "games currently in progress in which any of the user's Centaur Teams are participating." But the spectator affordance is available to *any* authenticated user — users may want to discover interesting games in progress even in rooms they have no team affiliation with. The informal spec §8.1 describes the home view narrowly around memberships and recents, leaving general discovery to the Room Browser. Whether a dedicated "live games" discovery surface is needed is not answered.
**Question**: Should the home view or the Room Browser expose a dedicated listing of all games currently in progress regardless of team affiliation?
**Options**:
- A: Only games involving the user's teams on the home view; no platform-wide live-games listing. (Current draft.)
- B: Add a "live games" section to the home view showing all platform-wide games in progress.
- C: Add a filter to the Room Browser for "rooms with a game in progress."
**Informal spec reference**: §8.1, §8.3.
