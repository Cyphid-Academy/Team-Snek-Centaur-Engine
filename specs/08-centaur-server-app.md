# Module 08: Snek Centaur Server Frontend

## Requirements

### 8.1 Scope and Runtime Placement

**08-REQ-001**: This module shall define the behavioural requirements of the web application served by a Snek Centaur Server ([02-REQ-004], [02-REQ-030]). The application is the single human-facing interface for the Snek Centaur Platform, encompassing both team-internal competitive operation (heuristic configuration, bot parameters, live gameplay, team replay) and platform-wide cross-team concerns (team management, room management, game spectating, platform replay, profiles, leaderboards, API key management). There is no separate "Game Platform" web application.

**08-REQ-002**: The application shall be served by the Snek Centaur Server runtime. It shall require authentication before exposing any functionality beyond a sign-in control and public, non-user-specific information (e.g., the public leaderboard per §8.19).

**08-REQ-003**: The application shall execute as a browser client that communicates with (a) the Snek Centaur Server runtime for real-time subscriptions to in-memory bot-framework state it does not read directly from Convex, (b) the Convex deployment for reads and mutations against Centaur state ([06]) and platform-wide state ([05]) per [02-REQ-039], and (c) a game's SpacetimeDB instance via OIDC-validated access token per [02-REQ-038] when a game is live or being spectated.

**08-REQ-004**: A single Snek Centaur Server may host multiple Centaur Teams. The application shall present team-scoped views (heuristic configuration, bot parameters, live gameplay, team replay) in the context of a specific hosted Centaur Team, and shall present platform-wide views (room browsing, profiles, leaderboard) independent of any specific team.

**08-REQ-005**: The application shall expose a well-known HTTP endpoint at `/.well-known/snek-game-invite` that receives game invitation payloads from Convex at game start per [05-REQ-032b]. The endpoint shall accept the invitation on behalf of the invited Centaur Team, receive the per-Centaur-Team game credentials, and use those credentials for all subsequent bot-participant interactions with the game's SpacetimeDB instance.

---

### 8.2 Authentication and Authorization

**08-REQ-006**: The application shall require Google OAuth authentication of the human using the same human identity type defined in [03]. It shall not maintain its own independent credential store. Unauthenticated requests to any page of the application other than those exempted by [08-REQ-002] shall be refused.

**08-REQ-007**: After authentication, the application shall resolve the authenticated identity to a user record per [05-REQ-004] and [05-REQ-005]. All subsequent UI actions shall be attributed to that user record for the duration of the session.

**08-REQ-008**: The application shall gate affordances that are restricted to the Captain role — in particular the Captain-only control affordances of §8.14 and the Captain-only affordances of §8.4 (heuristic configuration) and §8.5 (bot parameters) — on the authenticated human's current Captain status as read from [05] via [06]. Captain status changes observed through subscription shall take effect in the UI without requiring the operator to reload the page.

**08-REQ-009** *(negative)*: The application shall never issue a SpacetimeDB access token on its own. Access tokens for a game are obtained through the Convex-mediated issuance path of [05-REQ-035] and presented to SpacetimeDB by the browser.

**08-REQ-009a** *(negative)*: The application shall not store, display, or transmit the plaintext of any SpacetimeDB access token, API key, or other credential material except during the single creation-time disclosure of an API key plaintext per [05-REQ-051] and [03-REQ-034].

**08-REQ-009b**: The application shall provide a sign-out control that terminates the user's session on the client and revokes any client-held session tokens. After sign-out, the UI shall return to the unauthenticated state.

**08-REQ-009c**: When the authenticated human holds the platform admin role ([05-REQ-065]), the application shall expose admin-specific affordances as defined in §8.21. Admin status shall be evaluated from the user record and shall take effect without page reload.

---

### 8.3 Navigation and Page Structure

**08-REQ-010**: The application shall provide a persistent global navigation surface from which the authenticated user can reach each of the following top-level destinations: the home view (§8.3a), the Rooms browser (§8.6), the Teams browser (§8.5a), the user's own Player Profile (§8.18), the global Leaderboard (§8.19), and API Key Management (§8.20). Team-scoped navigation targets (heuristic configuration, bot parameters, game history, live operator interface) shall be accessible within the context of a specific hosted Centaur Team.

**08-REQ-011**: When any hosted Centaur Team of which the user is a member has a game in the `playing` status ([05-REQ-027]), the navigation surface shall make the live operator interface for that team prominent such that an operator arriving at the application is not required to search the navigation to find the active game.

**08-REQ-012**: The application shall not present a page for live gameplay when the relevant Centaur Team has no game in the `playing` status. Attempts to navigate to the live interface under those conditions shall be refused with an explanatory empty state.

**08-REQ-013**: Navigating into the replay viewer shall occur from the game history page (§8.10) or from a direct link (§8.17c). The replay viewer shall not appear as a standalone top-level navigation target.

---

### 8.3a Home View

**08-REQ-010a**: The application shall present, as the authenticated user's home view, at minimum: the list of Centaur Teams of which the user is a current member (per [05-REQ-011]), the list of rooms the user has recently visited, and the list of games currently in progress (status `playing` per [05-REQ-028]) in which any of the user's Centaur Teams are participating. Each listed item shall link directly to its corresponding detailed view.

---

### 8.4 Heuristic Configuration Page

**08-REQ-014**: The heuristic configuration page shall be scoped to a specific hosted Centaur Team. It shall display every Drive type and every Preference registered with that Centaur Team's Snek Centaur Server, sourced from the team's heuristic default configuration ([06-REQ-005]) via [06-REQ-032]'s read surface.

**08-REQ-015**: For each registered Preference, the page shall display and allow editing of: (a) whether the Preference is active on new snakes by default and (b) its default portfolio weight ([06-REQ-006]).

**08-REQ-016**: For each registered Drive type, the page shall display and allow editing of: (a) its default portfolio weight when added to a snake, (b) its `nickname` for UI display, and (c) pinning status in the Drive dropdown presented during Drive management ([06-REQ-007], §8.13). The Captain may reorder the `pinnedHeuristics` array and assign nicknames to Drives from this page. *(Amended per 08-REVIEW-005 resolution: ordinal position replaced with nickname and pinning controls.)*

**08-REQ-017**: Mutations to team-scoped heuristic defaults initiated from this page shall be routed through the Centaur state function contract surface ([06-REQ-030]) and shall be rejected by that surface if the authenticated caller is not the Captain of the owning Centaur Team ([06-REQ-008], [06-REQ-031]). The application shall surface any such rejection to the operator. Non-Captain team members may view the heuristic configuration page in read-only mode. *(Amended per 08-REVIEW-001 resolution: team-scoped heuristic default mutations are Captain-only.)*

**08-REQ-018**: The page shall make explicit to the operator that edits affect defaults for future games only and shall not retroactively affect any game currently in progress ([06-REQ-009]). The concrete UI affordance by which this is communicated is a design-phase decision.

**08-REQ-019** *(negative)*: The heuristic configuration page shall not permit mutations to any per-snake or per-game state. It operates exclusively on team-scoped heuristic defaults. Only the Captain may edit these defaults; other team members see a read-only view. *(Amended per 08-REVIEW-001 resolution: Captain-only for team-scoped default mutations.)*

---

### 8.5 Bot Parameters Page

**08-REQ-020**: The bot parameters page shall be scoped to a specific hosted Centaur Team. It shall display and allow editing of the team's bot parameter record ([06-REQ-011]), comprising at minimum the softmax global temperature and the **automatic submission time allocation** — the team-level turn deadline parameter used by the bot framework's submission process per [07-REQ-044] / [07-REQ-045]. *(Amended per 08-REVIEW-011 resolution.)*

**08-REQ-021**: Mutations initiated from this page shall be routed through the Centaur state function contract surface ([06-REQ-030]) and rejected if the caller is not the Captain of the owning Centaur Team ([06-REQ-012], [06-REQ-031]). Non-Captain team members may view the bot parameters page in read-only mode. *(Amended per 08-REVIEW-001 resolution: Captain-only for bot parameter mutations.)*

**08-REQ-022**: The page shall make clear to the operator that all `global_centaur_params` values — the softmax temperature and the automatic submission time allocation — take effect on the next game the team enters, not on any game currently in progress. At game start, these defaults are copied into game-scoped state per [06-REQ-040a] and are thereafter independent of the team defaults. *(Amended per 08-REVIEW-002 and 08-REVIEW-011 resolutions.)*

**08-REQ-023** *(negative)*: The bot parameters page shall not expose any parameter that is a game-configuration parameter owned by [05-REQ-023]. Game-configuration parameters are set in the room lobby (§8.8).

---

### 8.5a Teams Browser

**08-REQ-023a**: The application shall provide a Teams browser that lists all Centaur Teams known to the platform per [05-REQ-008], with at minimum the team's name, display colour, and current Captain. Each listed team shall link to that team's public profile (§8.18a).

---

### 8.5b Team Management

**08-REQ-023b**: The application shall provide a Team Management view accessible to every current member of a Centaur Team. The view shall display at minimum the team's name, display colour, current Captain, current members with their roles, the team's designated coaches per [05-REQ-067], and the nominated server domain together with its latest health status per [05-REQ-009] and [02-REQ-029].

**08-REQ-023c**: The application shall permit any authenticated user to create a new Centaur Team per [05-REQ-008]. On creation, the creating user shall become the team's Captain per [05-REQ-011].

**08-REQ-023d**: The Team Management view shall expose, exclusively to the team's current Captain, affordances to mutate team identity (name, display colour), to set or update the team's nominated server domain (`nominatedServerDomain` per [05-REQ-014]), to add or remove human members (per [05-REQ-012]), to add or remove coaches per [05-REQ-067] (via the `addCoach` / `removeCoach` mutations), and to transfer the Captain role to another current member (per [05-REQ-012]).

**08-REQ-023e**: The Team Management view shall, while a team is participating in any game whose status is `playing`, visibly disable the mutating affordances of [08-REQ-023d] that are frozen by [05-REQ-013], and shall explain to the user that the affordance is temporarily unavailable due to a game in progress.

**08-REQ-023f** *(negative)*: The Team Management view shall not expose any affordance for configuring bot parameters, Drive portfolios, heuristic defaults or overrides, snake operator assignment, or any other Centaur-subsystem state. These are the exclusive domain of the team-scoped operator pages (§8.4, §8.5). The view may display a navigation link directing the user to those pages.

---

### 8.6 Room Browser and Creation

**08-REQ-024a**: The application shall provide a Room Browser that lists every room persisted by [05-REQ-016], with at minimum: the room name, the room's optional owner (per [05-REQ-017]), the number of Centaur Teams currently enrolled, and whether the room has a game currently in status `playing` per [05-REQ-028].

**08-REQ-024b**: The Room Browser shall support filtering and searching the listed rooms by room name. Any additional filter criteria shall be a design decision; requirements level mandates only name-based search.

**08-REQ-024c**: The Room Browser shall expose an affordance by which any authenticated user may create a new room per [05-REQ-019]. Room creation shall require at minimum a room name; the creating user shall become the room's owner. The UI shall treat the resulting room creation as a mutation against Convex per [08-REQ-100].

**08-REQ-024d**: Every listed room in the Room Browser shall link directly to the Room Lobby view (§8.8) for that room.

---

### 8.7 Game History Page

**08-REQ-024**: The game history page shall be scoped to a specific hosted Centaur Team. It shall list completed games in which the authenticated human was either (a) a member of the owning team at the time of the game (per the game's participating-team snapshot of [05-REQ-029]) or (b) a current member of the owning team, in reverse chronological order.

**08-REQ-025**: Each listing shall display at minimum: room name, date, opponent teams, the team's result (win/loss/draw — subject to resolution of score semantics per [05-REVIEW-006]), and final scores ([05-REQ-038]). Listing data shall be sourced from [05]'s read surface.

**08-REQ-026**: Selecting a listing shall open the replay viewer (§8.15) for that game. The replay viewer entry point from the game history page shall default to the team-perspective sub-turn view.

**08-REQ-027** *(negative)*: The game history page shall not expose games for teams the authenticated human has no relationship with. A user has a relationship with a team's game if they were a member of that team at the time of the game (per the participating-team snapshot) or are a current member of that team.

---

### 8.8 Room Lobby

**08-REQ-027a**: The application shall provide a Room Lobby view for every room listed in the Room Browser. The Room Lobby view shall display at minimum: the room's current owner (or the no-owner state per [05-REQ-017]), the room's current game-configuration parameter values per [05-REQ-023], the set of Centaur Teams currently enrolled in the room per [05-REQ-016], and the readiness state of each enrolled team.

**08-REQ-027b**: The Room Lobby view shall be accessible to every authenticated user. Users who are neither the room owner nor members of an enrolled team shall see the lobby in a read-only form and shall have no mutating affordance.

**08-REQ-027c**: The Room Lobby view shall expose, exclusively to the administrative actor for the room defined by [05-REQ-017] (the owner, or any authenticated user when there is no owner), affordances to edit every game-configuration parameter of [05-REQ-023] within its defined range, to invite or remove Centaur Teams from enrolment, to abdicate ownership per [05-REQ-018], and to start the game per [05-REQ-031].

**08-REQ-027d**: The Room Lobby view's parameter-editing affordance shall enforce each parameter's type and range by refusing to submit values outside the acceptable range per [05-REQ-023], providing inline feedback to the user before any mutation is dispatched. This client-side enforcement shall be treated as a user-experience affordance only; the authoritative enforcement remains with Convex per [05-REQ-023].

**08-REQ-027e**: The Room Lobby view's parameter-editing affordance shall honour the conditional-parameter semantics of [05-REQ-025]: parameters whose meaning is conditional on a gating parameter shall be visually gated on that parameter and, when gating parameters are off, shall not block the user from persisting the dependent value but shall communicate that the dependent value is currently inactive.

**08-REQ-027f**: The Room Lobby view shall expose, exclusively to the Captain of an enrolled Centaur Team, affordances to mark that team ready and to unmark that team ready, consistent with the Captain-only ready-check semantics of [05-REQ-031]. To other team members, the readiness state shall be visible as a read-only indicator with no mutating affordance. *(Amended per 08-REVIEW-013 resolution: ready/unready is Captain-only, matching the upstream Captain-only authorization fixed by 05-REVIEW-007.)*

**08-REQ-027g**: The Room Lobby view shall expose, exclusively to members of an enrolled Centaur Team, an affordance to ping the team's nominated Snek Centaur Server's healthcheck per [02-REQ-029] and [05-REQ-009], surfacing the result to the lobby view.

**08-REQ-027h**: The Room Lobby view shall enable the game-start affordance of [08-REQ-027c] only when the room has at least two enrolled Centaur Teams per [05-REQ-020] and every enrolled team has been marked ready. When the affordance is disabled, the view shall communicate to the administrative actor which precondition is currently unmet.

**08-REQ-027i**: The Room Lobby view shall provide a **Board Preview** affordance that renders a miniature visualisation of the board geometry — including the placement of fertile tiles, hazards, and snake starting territories — derived from the not-yet-started game's current game-configuration parameter values. The preview shall be generated by the Convex board-generation preview mutation defined by [05-REQ-032b], which re-runs `generateBoardAndInitialState()` from the shared engine codebase ([02-REQ-035]) inside Convex on each parameter edit and persists the result onto the not-yet-started game's configuration document. The web client shall receive the regenerated preview reactively via Convex's reactive query model and shall render it directly; the application shall not run any board-generation algorithm client-side. The regeneration cadence (e.g., debouncing of rapid parameter edits) is a design-level concern. *(Amended per 08-REVIEW-014 resolution: Convex's preview mutation is the sole authority for board generation; ratifies the upstream config-on-game architecture of [05-REQ-022] and [05-REQ-032b].)*

**08-REQ-027j**: The Board Preview shall expose an affordance by which the administrative actor may **lock in** the currently-displayed preview as the starting layout for the next launch of this game. The lock-in semantics are: (a) every preview generation by [05-REQ-032b] writes the resulting starting state onto the not-yet-started game record's configuration document, regardless of lock-in status; (b) a separate `boardPreviewLocked: boolean` flag on the same game record indicates whether [05-REQ-032] step 2 will reuse the persisted starting state (true) or regenerate from a fresh seed at game-launch initiation (false); (c) when unlocked, the regenerated starting state is not surfaced to any configuration-mode UI — it becomes visible only when delivered to operators by SpacetimeDB once the game enters `playing` status. The Room Lobby view shall expose toggle affordances to set and clear the `boardPreviewLocked` flag via the Convex mutations defined by [05-REQ-032b]. *(Amended per 08-REVIEW-015 resolution: lock-in is a flag on the game record, persistence is unconditional on every regeneration.)*

**08-REQ-027k** *(negative)*: The Board Preview shall not stage, commit, or otherwise affect any currently-playing game in the room. Board Preview affects only the next game-launch initiation of the not-yet-started game record being configured, consistent with the immutable-parameter-snapshot rule of [05-REQ-024].

**08-REQ-027l**: The Room Lobby view shall, when the room has a game whose status is `playing`, provide a direct link from the lobby to the Live Spectating view of that game per §8.16.

---

### 8.9 Live Operator Interface — Principles

**08-REQ-028**: The live operator interface shall be scoped to a specific hosted Centaur Team that has a game in the `playing` status. It shall default to AI control of all owned snakes. On entry to the interface for a fresh game, every owned snake shall be in automatic mode (`manualMode = false` in its selection record, [06-REQ-018]) and the bot framework shall be staging moves for it per [07-REQ-044].

**08-REQ-029**: Selecting a snake in the interface shall not, by itself, place that snake in manual mode. Selection is a view-only operation that makes the snake the subject of the move interface, Drive management, decision breakdown, and worst-case world preview, but does not remove the snake from the automatic submission pipeline of [07].

**08-REQ-030**: Manual mode for a snake shall be entered exclusively by (a) the currently selecting operator checking the manual checkbox of §8.13 or (b) the currently selecting operator selecting a concrete direction via the move interface, which auto-sets the manual flag as a side effect per [06-REQ-025]. Exiting manual mode shall occur exclusively by that operator unchecking the manual checkbox, returning the snake to automatic mode immediately such that [07]'s submission pipeline resumes staging for it on its next scheduled pass.

**08-REQ-031**: The interface shall reflect [07]'s compute scheduling principle that compute follows attention: automatic-mode snakes receive continuous scheduled compute, currently-selected manual-mode snakes receive high-priority compute, and unselected manual-mode snakes receive compute last ([07-REQ-040]). This requirement is behavioural on [07]; the UI shall not add extra scheduling logic of its own.

---

### 8.10 Live Operator Interface — Header

**08-REQ-032**: The header of the live operator interface shall display at minimum: the current turn number, the team clock countdown, the team's remaining time budget, the measured network latency to the team's SpacetimeDB instance, a Convex-hosted presence display of other operators currently connected to the same game from the same team along with each connected operator's current ready-state per [06-REQ-040b] (per §8.12), and — conditionally, per §8.14 — the Captain control affordances. *(Amended per 08-REVIEW-011 resolution.)*

**08-REQ-033**: The team clock countdown shall be presented with sufficient precision to convey imminent deadline: the concrete presentation of seconds-to-one-decimal and a warning state below a sub-one-second threshold is the informal spec's proposal and is the minimum required resolution. When the team's turn has been declared over ([01-REQ-039]) the countdown shall be replaced by a "turn submitted" indicator and shall not flicker back to a countdown while the other team(s) finish their declarations.

**08-REQ-034** *(removed per 08-REVIEW-011 resolution; number reserved for stable cross-references)*: Per-turn coordination state is rendered as per-operator ready-state in the operator presence display per [08-REQ-032] and [06-REQ-040b].

**08-REQ-035**: The presence display shall show each other currently-connected operator on the team by their display name and a per-operator colour that is stable within the game's lifetime and is the same colour used for that operator's selection shadow on the board (§8.13). Presence state shall be sourced from a Convex-hosted presence mechanism; the design phase should use the `@convex-dev/presence` library. *(Amended per 08-REVIEW-004 resolution: presence is Convex-hosted.)*

**08-REQ-036**: The network latency indicator shall be a client-measured round-trip time against the team's SpacetimeDB subscription and shall not require any new Convex or Centaur-state field to support it. The exact measurement methodology is a design-phase decision.

---

### 8.11 Live Operator Interface — Board Display, Selection, and Move Interface

**08-REQ-037**: The board display shall render the full current board with: grid lines; all terrain types ([01]) including hazard cells and fertile tiles; all items currently on the board (food, invulnerability potions, invisibility potions); all currently-alive snakes with team colour fill, a per-snake letter designation rendered at the head, and the snake's current length rendered at the neck segment.

**08-REQ-038**: The board display shall render snake effect states ([01]) such that an invulnerability level greater than zero is indicated by a distinctive (e.g. blue) outline on the snake and an invulnerability level less than zero by a distinctive (e.g. red) outline, and such that invisibility is indicated by a translucent/shimmer rendering visible to members of the owning team only ([04]'s RLS visibility rules; [01]'s invisibility semantics). The interface shall not reveal invisibility states of snakes belonging to other teams.

**08-REQ-039**: The board display shall render the current selection state ([06-REQ-018]) as a per-snake selection glow in the colour of the operator who holds the selection. Multiple concurrent selections on distinct snakes by distinct operators shall each render in their respective operators' colours.

**08-REQ-040**: The board display shall render, for the currently-selected owned snake, per-direction move candidate highlighting on the four adjacent cells where each candidate cell is coloured by the bot's current stateMap score for that direction (highest score to lowest using a monotone colour ramp). If no stateMap entry is currently defined for a candidate direction ([07-REQ-049]), that candidate shall be rendered in a distinct neutral state that is visually distinguishable from any score value.

**08-REQ-041**: The board display shall render the currently-staged move for each owned snake with a distinctive marker (e.g. purple border) on the destination cell. The marker shall update without page reload as the staged move changes, whether the change originated from the bot's submission pipeline ([07-REQ-044]) or from an operator action on any connected client.

**08-REQ-042**: Snake selection shall be initiated by clicking the body of an owned snake whose selection the caller is eligible to take per [06-REQ-024]. Selection shall be terminated by pressing Escape or by selecting a different snake. Selecting a snake currently selected by a different operator shall present a displacement confirmation that, upon explicit operator confirmation, issues a selection mutation with the displacement flag set ([06-REQ-022]). Without confirmation, the current selection shall remain with its existing holder.

**08-REQ-043** *(negative)*: The application shall not display, construct, or allow interaction with a direction-candidate for a snake the operator does not currently hold a selection on. All move-staging and Drive-management affordances are gated on the caller being the current selector of the snake being acted on ([06-REQ-025]).

**08-REQ-044**: The move interface shall provide four direction buttons (Up, Down, Left, Right), each labelled with that direction's current stateMap score ([07-REQ-035]) and coloured consistently with the board display's candidate highlighting. Each direction button shall be pre-set to reflect the currently-staged direction for the selected snake (whether staged by the bot or by a human), and direction buttons whose direction is immediately lethal ([01-REQ-044a], [01-REQ-044b]) shall be visibly disabled but shall remain selectable as last-resort candidates per [07-REQ-019].

**08-REQ-045**: Selecting a direction — via click on a direction button or via the keyboard arrow keys while the board has focus — shall simultaneously (a) stage that direction in SpacetimeDB via the staged-move mechanism ([02-REQ-011]) as an operator-originated move, (b) auto-set the snake's manual-mode flag to true per [06-REQ-025], and (c) trigger the worst-case world preview of §8.11a for that direction.

**08-REQ-046**: Staged moves shall be freely changeable at any moment before the team's turn is declared over ([01-REQ-039]); the interface shall not expose a separate "commit" action. The operator shall be made aware by affordance design that each direction selection temporarily stages that direction, so that exploring a direction is not distinguishable to the game engine from committing to it until the turn ends.

**08-REQ-047**: The manual checkbox shall be displayed whenever an owned snake is selected, shall reflect the current value of the snake's manual-mode flag ([06-REQ-018]), and shall be editable by the current selector only. Checking the box shall set the flag to true without staging a new move (the currently-staged move, bot or human, is locked). Unchecking the box shall set the flag to false, at which point [07]'s automatic submission pipeline resumes staging for the snake.

---

### 8.11a Live Operator Interface — Worst-Case World Preview

**08-REQ-048**: When an owned snake is selected and a direction is selected (whether via direction button or arrow key), the board display shall additionally render the worst-case simulated world for that (snake, direction) pair, as read from the computed display state of [06-REQ-026]. Current positions of all snakes shall remain rendered solidly and the worst-case simulated positions shall be rendered as translucent overlays.

**08-REQ-049**: Annotations computed against the worst-case world — such as the Voronoi-style territory overlay the informal spec references, and any other team-configured annotations — shall be rendered against the worst-case world rather than against the current board. They shall be sourced from the `annotations` field of the computed display state ([06-REQ-026]).

**08-REQ-050**: The worst-case world preview shall update reactively as the bot framework writes new computed display state snapshots ([07-REQ-039]), so that an operator who leaves a direction selected while compute proceeds sees the worst-case world evolve in place.

**08-REQ-051**: When no direction is selected, or when no computed display state exists yet for the selected snake, the worst-case world preview shall not render and the board shall show only the current board state.

---

### 8.11b Live Operator Interface — Decision Breakdown Table

**08-REQ-059**: The interface shall render, for the currently-selected owned snake, a per-direction decision breakdown table showing one row per heuristic (Drive or Preference) active on that snake. Each row shall display at minimum: the heuristic's name, its raw normalised output in the worst-case world ([06-REQ-026]'s `heuristicOutputs` field), its current portfolio weight, its weighted contribution to the direction's score, and its relative impact on the direction's total score.

**08-REQ-060**: The decision breakdown shall update reactively as computed display state snapshots are written by the framework and as the operator switches which direction is selected.

---

### 8.12 Live Operator Interface — Per-Operator Ready-State and Turn Submission

*(Section rewritten per 08-REVIEW-011 resolution.)*

**08-REQ-061**: The live operator interface shall expose a per-operator **ready-state toggle** for each authenticated operator currently connected to the team's game session. The toggle is a binary flag — `ready` or `not-ready` — owned exclusively by the operator who toggles it, persisted in [06]'s `operator_ready_state` table per [06-REQ-040b], and reactive across all connected team members via the subscription of [06-REQ-043]. Each operator may toggle their own ready-state freely throughout the turn; no other operator (and no Captain) may toggle a given operator's ready-state on their behalf. *(Amended per 08-REVIEW-011 resolution.)*

**08-REQ-062**: Unanimous operator readiness — every currently-connected operator on the team having set their ready-state to `ready` for the current turn — is a **necessary precondition** for the Snek Centaur Server's automatic turn submission process ([07-REQ-044] / [07-REQ-045]) to call SpacetimeDB's `declare_turn_over` reducer ([04] §2.5). The rules governing when (within the window where this precondition holds) the automatic submission process declares the turn over are defined in [07-REQ-044] / [07-REQ-045]. This precondition is **passive**: its becoming true does not trigger any positive flush, immediate-submit, or out-of-band declaration; it merely permits the automatic submission process to finalise according to its own rules. If the team has zero currently-connected operators, the precondition is unsatisfied and declaration via this path is deferred until at least one operator is connected and ready. Ready-state is reset to `not-ready` for every operator at the start of each new turn (i.e., on the publish of the next authoritative pre-turn board state per [04]). The Captain's manual turn-submit affordance ([08-REQ-065]) is an **independent override** path that bypasses this precondition entirely — it immediately calls `declare_turn_over` regardless of any other operator's ready-state and triggers the flush-suppression behaviour of [07-REQ-045a]. Expiry of the team's chess clock ([01-REQ-039]) similarly bypasses this precondition.

**08-REQ-063**: An operator's ready-state shall remain editable throughout the turn — toggling from `ready` back to `not-ready` is permitted at any time before the team's turn is declared over and shall immediately rescind that operator's contribution to the unanimity condition of [08-REQ-062]. Operator interactions — selection, Drive edits, manual overrides, move staging — shall remain possible regardless of ready-state. The team's per-turn clock and time budget continue to run per [01-REQ-037] and [01-REQ-038] independently of ready-state; expiry of the team's clock declares the turn over via [01-REQ-039] regardless of any operator's ready-state. *(Amended per 08-REVIEW-011 resolution.)*

**08-REQ-064**: The initial ready-state of every operator at the start of every turn shall be `not-ready`. *(Amended per 08-REVIEW-011 resolution.)*

**08-REQ-064a**: Coaches (per [05-REQ-067]) and admins acting via implicit-coach permission (per [05-REQ-066]) shall have **no ready-state** — they are read-only observers of the team's session per [08-REQ-052a] and [08-REQ-052b]. Their connections shall not be counted in the unanimity condition of [08-REQ-062], and their UI shall not expose a ready-state toggle. The presence display of [08-REQ-032] shall visually distinguish a coach/admin observer from a member operator. *(Added per 08-REVIEW-011 resolution.)*

---

### 8.13 Live Operator Interface — Drive Management

**08-REQ-052**: The move interface for a selected snake shall expose a control by which the current selector can add a Drive to that snake. Adding shall present a dropdown of registered Drive types ordered by the pinned-heuristics-then-lexicographic scheme: pinned heuristics (from the `pinnedHeuristics` array in `global_centaur_params`) appear first in pinned order; remaining heuristics are ordered lexicographically by `nickname`, with `heuristicId` as tiebreaker ([06-REQ-007]). *(Amended per 08-REVIEW-005 resolution: dropdownOrder replaced with pinned-heuristics + lexicographic fallback.)*

**08-REQ-052a**: The application shall provide a **coach mode** entry point into the live operator interface for any in-progress game involving a Centaur Team for which the authenticated user is a designated coach per [05-REQ-067] or for which the user holds implicit coach permission as an admin per [05-REQ-066]. Coach mode shall render the same live operator interface as a member of that team would see — the full board display, selection state, Drive portfolios, heuristic decompositions, action log, header, and Captain controls panel — but every mutating affordance (selection mutation, snake selection acquisition, Drive add/remove, portfolio weight adjustment, per-operator ready-state toggle, turn submission, team ready check (game start), and any Captain-only control) shall be disabled and visibly indicated as read-only. The coach connection to the team's filtered SpacetimeDB views shall be obtained via the coach SpacetimeDB token issuance path defined in [05] §3.4 and authorised per [05-REQ-067]. The coach mode entry point shall be reachable from the game's Live Spectating view (§8.16) and from the Team Profile (§8.18a) when an in-progress game is in flight.

**08-REQ-052b** *(negative)*: Coach mode shall not expose any affordance that would cause a write to Convex or to SpacetimeDB on behalf of the team being coached. Any UI control that would, in member mode, dispatch such a write shall be either hidden or rendered disabled in coach mode.

**08-REQ-052c**: Coach mode (08-REQ-052a) shall expose an **inspection** affordance with semantics identical to the replay-mode inspection affordance specified in the amended 08-REQ-074. Specifically: a coach client may at any time inspect any snake on the team being coached; the inspection is purely client-local; the inspection shall never write any Convex or SpacetimeDB state; the inspection shall never produce a selection shadow on the board; the inspection shall never displace or otherwise interact with any operator's selection; and each coach client may have at most one inspected snake at a time, held only in that client's local UI state. Coach inspection shall coexist with the live operator selection shadows produced by the team's connected operators per [08-REQ-039]: the coach simultaneously sees the team's operators' real selection shadows on the board and the coach's own client-local inspection state in their portfolio / stateMap / worst-case world / decision breakdown / per-direction candidate highlight panels. The coach's read scope is already established by [05-REQ-067] (and, for admin coaches, [05-REQ-066] / [05-REQ-067]); this requirement adds no new Convex mutation, no new SpacetimeDB write path, and no new authorisation rule. *(Resolved per 08-REVIEW-008.)*

**08-REQ-052d** *(negative)*: Coach inspection (08-REQ-052c) shall not be exposed through any affordance whose visual or interaction grammar could be confused with operator selection. In particular, the click-to-select gesture used by team members per [08-REQ-042] shall be replaced or visibly differentiated in coach mode (for example, by a distinct cursor, a distinct hover treatment, a distinct activation gesture such as click-with-modifier or right-click, and/or a distinct on-board indicator that is plainly not a selection shadow), so that a coach can never mistake an inspection action for a selection action and so that other observers cannot mistake the coach's inspection state for an operator's selection. *(Resolved per 08-REVIEW-008.)*

**08-REQ-053**: Selecting a Drive type from the dropdown shall activate the targeting mode appropriate to that Drive type's target type:
- **Snake targeting**: the board enters a mode in which only those snakes for which the Drive's target-eligibility predicate ([07-REQ-007]) returns true are highlighted as clickable; ineligible snakes are visually dimmed; clicking an eligible snake confirms it as the Drive's target.
- **Cell targeting**: the board enters a mode in which only those cells for which the Drive's target-eligibility predicate returns true are highlighted as clickable; ineligible cells are visually dimmed; clicking an eligible cell confirms it as the Drive's target.

**08-REQ-054**: In either targeting mode, pressing Tab shall cycle the highlighted candidate target through eligible targets in a fully deterministic order: primary sort by A*-distance from the selected snake's head, nearest first; secondary sort (for candidates at equal A*-distance) by clockwise angle in board coordinates from the selected snake's current head direction, starting at 0° (straight ahead) and increasing clockwise through 360°; tertiary sort (for candidates that remain tied after the first two keys) by target identity — for snake targets the snake id ascending, and for cell targets the cell coordinates in row-major order (row ascending, then column ascending). Pressing Escape shall cancel targeting without adding the Drive and shall not alter the snake's selection state. *(Resolved per 08-REVIEW-006.)*

**08-REQ-055**: Confirmation of a target shall cause the Drive to be added to the snake's portfolio at that Drive type's default weight via [06-REQ-015]. No additional operator confirmation beyond the target click shall be required.

**08-REQ-056**: Active Drives on the selected snake shall be listed in the snake's control panel, each showing the Drive type, the target, the current portfolio weight, an editable weight control, and a remove affordance. Weight edits and removals shall take effect immediately via [06-REQ-015]; the framework shall react per [07-REQ-015].

**08-REQ-057**: Drive assignments, weight overrides, activation overrides, and the per-snake temperature override shall persist across turns and across deselection, per [06-REQ-016]. The interface shall not reset any of these fields as a side effect of selection changes or turn transitions.

**08-REQ-058** *(negative)*: The application shall not provide an affordance to add Drives whose types are not registered in the team's heuristic default configuration ([06-REQ-005]). Drive type registration is a code-level concern of the Centaur Team's Snek Centaur Server library usage, not a runtime UI affordance.

---

### 8.14 Captain Controls

**08-REQ-065**: When the authenticated human is the Captain of the Centaur Team ([05-REQ-011]), the header of the live operator interface shall expose a single Captain control affordance: a **turn-submit** action that immediately declares the team's turn over ([01-REQ-039]) regardless of the per-operator ready-state (§8.12) of any other operator, submitting all currently-staged moves. *(Amended per 08-REVIEW-011 resolution.)*

**08-REQ-066**: The Captain's turn-submit affordance shall additionally be bindable to a keyboard shortcut so the Captain can operate it without pointer input. The specific key binding is a design-phase decision.

**08-REQ-067** *(negative)*: Operators who are not the Captain shall not see the Captain turn-submit affordance, and any attempt to invoke it — including via keyboard shortcut — shall be rejected by [06]'s function contract surface per [06-REQ-031] even if it reaches the mutation layer. The per-operator ready-state toggle of [08-REQ-061] is *not* a Captain-only affordance — every member operator owns their own ready-state regardless of role.

**08-REQ-068**: Per-operator ready-state toggles shall produce an `operator_ready_toggled` entry in the action log ([06-REQ-036]) per [06-REQ-040b]. Turn submissions issued by the Captain shall produce the team-side turn-submission event category of [06-REQ-036]. *(Amended per 08-REVIEW-011 resolution.)*

---

### 8.15 Unified Replay Viewer

**08-REQ-069**: The application shall provide a **unified Replay Viewer** for any game whose status is `finished` ([05-REQ-027]) and for which a persisted replay exists per [05-REQ-040]. The Replay Viewer shall combine two viewing modes into a single interface:
- **Board-level replay** (turn granularity): displays board state, snake positions, items, hazards, scoreboard, and turn events. Available for all games to all authenticated users.
- **Team-perspective replay** (sub-turn granularity): displays the full team experience including operator selections, Drive states, stateMaps, worst-case worlds, decision breakdowns, and staged-move attribution. Available only for games in which the viewer participated as a team member, scoped to that team's data.

**08-REQ-070**: The board-level replay mode shall source all displayed data from the persisted replay of [05-REQ-040] and shall never consult a SpacetimeDB game instance, consistent with [05-REQ-044]. The replay viewer shall therefore remain functional for replay viewing after the source game's SpacetimeDB instance has been torn down per [05-REQ-037].

**08-REQ-070a**: The board-level replay mode shall render board state at turn granularity: the cell layout, snake positions and bodies, items, hazards, fertile tiles, and per-team scoreboard shall be shown for the currently-selected turn. The rendering shall be visually consistent with the Live Spectating view (§8.16) such that familiarity with the live view carries over to the replay view. The board-level mode obtains its scrubbing affordance from the unified timeline control specified by [08-REQ-072] / [08-REQ-072a]–[08-REQ-072d].

**08-REQ-070b**: The board-level replay mode shall display a per-turn **event log** listing the turn events of the currently-selected turn as produced by turn resolution — at minimum death events (with cause), food-eaten events, potion-collection events, severing events, spawn events, and effect-application / effect-cancellation events. The set of event types shall match the closed enumeration defined by [01] and [04].

**08-REQ-071**: The team-perspective replay mode shall present the same UI components as the live operator interface (§§8.9–8.13), rendered in a read-only mode in which all mutating affordances — move staging, Drive add/remove/edit, manual-mode toggling, per-operator ready-state toggling, turn submission — are disabled, while all state-inspection affordances — snake **inspection** (the client-local non-mutating affordance per [08-REQ-074], not the operator-control selection mechanic of [06] which is unavailable in replay), direction preview, worst-case world preview, decision breakdown table — remain fully functional. The team-perspective mode obtains its scrubbing affordance from the unified timeline control specified by [08-REQ-072] / [08-REQ-072a]–[08-REQ-072d].

**08-REQ-071a**: The team-perspective replay mode shall be available exclusively for games in which the logged-in human participated as a team member.

**08-REQ-072**: The replay viewer shall expose a single **unified timeline control** that governs scrubbing for both the board-level and the team-perspective replay modes. The timeline control shall provide play, pause, a scrubber, a playback-speed control, and a **mode toggle** between Per-Turn mode and Timeline mode (per [08-REQ-072a]). The semantics of the scrubber, the speed-control set, the rendering of turn boundaries, and the keyboard navigation differ between the two modes per [08-REQ-072b], [08-REQ-072c], and [08-REQ-072d]. At any scrubber position `t` the viewer shall display the reconstructed game state at that position: the board-level mode renders the public board state, while the team-perspective mode additionally renders which snake each operator had selected at that moment, each snake's manual-mode flag, each snake's active Drives and their targets and weights, each snake's per-direction stateMap and worst-case world and annotations and heuristic outputs, the per-operator ready-state at that moment, the staged moves for each snake and the identity that staged them, and temperature overrides in effect. This reconstruction is the union of [05-REQ-040]'s persisted replay and [06-REQ-035]'s action log. *(Amended per 08-REVIEW-010 resolution: per-mode scrubbing semantics introduced; the prior single-set `{0.5×, 1×, 2×, 4×}` pin is superseded.)*

**08-REQ-072a**: The timeline control shall expose a **mode toggle** with two settings: **Per-Turn mode** and **Timeline mode**. The chosen mode and the chosen speed-within-mode shall be persisted in client-local UI state and restored on subsequent navigation within the same browser session; they shall not be persisted to Convex. The default mode on first entry to the replay viewer shall be Per-Turn mode. *(Added per 08-REVIEW-010 resolution.)*

**08-REQ-072b**: In **Per-Turn mode**, the scrubber shall display turns as equidistant tick marks (one tick per turn). Scrubbing shall snap to the **end of each turn** (the centaur-state state-of-the-world that operators saw at the moment they were declaring submissions); no intra-turn positions shall be addressable. Playback shall advance one turn per tick at the configured rate. The supported playback-speed set shall be **{0.25, 0.5, 1, 2, 4, 8} turns/second**. *(Added per 08-REVIEW-010 resolution.)*

**08-REQ-072c**: In **Timeline mode**, the scrubber's horizontal axis shall represent wall-clock time of the original game from game start (left) to game end (right). Turn boundaries shall be rendered along the timeline as **turn-marker glyphs** at the actual clock time at which each turn was declared over; spacing between markers shall reflect the variable real wall-clock duration of each turn under the chess-clock mechanism (markers shall not be equidistant). Scrubbing shall be continuous along clock time. Playback shall advance at a scalar multiple of real time. The supported playback-speed set shall be **{0.25×, 0.5×, 1×, 2×, 4×, 8×}**. The speed-control widget shall render the current mode's unit in its label (e.g., "2 turns/s" in Per-Turn mode and "2× speed" in Timeline mode). *(Added per 08-REVIEW-010 resolution.)*

**08-REQ-072d**: Keyboard navigation in the unified timeline control shall be as follows. In **Timeline mode**: `Left`/`Right` (no modifier) seek ±1 second of clock time; `Shift+Left`/`Shift+Right` seek ±200 ms; `Ctrl+Left`/`Ctrl+Right` (interpreted as `Cmd+Left`/`Cmd+Right` on macOS) snap to the previous/next turn-marker keyframe. In **Per-Turn mode**: `Left`/`Right` advance one turn backward/forward; modifier-key bindings in Per-Turn mode are deferred to Phase-2 design. *(Added per 08-REVIEW-010 resolution.)*

**08-REQ-073**: Historical operator selections shall be rendered during team-perspective replay as coloured shadows on the appropriate snakes using the same per-operator colours used in live play. An operator who was not connected at a given historical moment shall not produce a shadow for that moment.

**08-REQ-074**: The replay viewer shall permit the logged-in human to **inspect** a snake at the scrubbed timestamp. Inspection is a purely client-local affordance, distinct from the operator-control **selection** affordance owned by [06] ([06-REQ-018] through [06-REQ-024]): each viewer client may have at most one inspected snake at a time; inspection state is held only in the viewer's client-local UI state; inspection shall never write any Convex or SpacetimeDB state; inspection shall never produce a selection shadow on the board; and inspection shall never displace or otherwise interact with any operator's selection. Historical operator selection shadows reconstructed from the action log per [08-REQ-073] shall continue to be displayed alongside the inspecting client's local inspection state, unaffected by the viewer's choice of inspected snake. *(Resolved per 08-REVIEW-008.)*

**08-REQ-075**: The replay viewer shall permit **inspection** of any snake on the viewed team at any scrubbed moment regardless of which operator (if any) had that snake selected at that moment in the original game.

**08-REQ-075a** *(negative)*: The team-perspective replay shall not display, reconstruct, or expose any state belonging to opposing teams beyond what was visible through [04]'s RLS rules to the owning team at the original time of play. In particular, any opposing snake that was invisible to the owning team at a given historical moment shall remain invisible in replay at that moment.

**08-REQ-075b**: The board-level replay mode shall not reconstruct or display any data that depends on the Centaur-subsystem action log of [06]. In particular, the board-level mode shall not display which operator had selected which snake at any moment, nor any per-operator coloured shadows, nor any stateMap / worst-case-world / heuristic breakdown data.

**08-REQ-075c**: The replay viewer shall expose a **direct link** affordance that produces a URL identifying the specific game being viewed, such that another authenticated user opening the URL is taken directly to that game's replay viewer.

---

### 8.16 Live Spectating

**08-REQ-080**: The application shall provide a **Live Spectating** view for any game whose status is `playing` per [05-REQ-028]. The view shall be accessible to every authenticated user without requiring membership in any participating Centaur Team.

**08-REQ-081**: Entry to the Live Spectating view shall cause the UI to obtain a **spectator SpacetimeDB access token** for the target SpacetimeDB game instance, issued by Convex per [03-REQ-026], [05-REQ-035], and the spectator-token provisions of [03]. The UI shall present this token to the runtime when establishing its subscription connection per [04-REQ-018].

**08-REQ-082**: The Live Spectating view shall subscribe to the SpacetimeDB game instance's state using subscription patterns that satisfy [04-REQ-054]'s support for a current-state view with incremental updates. The UI shall render board state, snake states, items, hazards, fertile tiles, and turn events as delivered by the subscription, in real time.

**08-REQ-083**: The Live Spectating view's rendering shall honour the invisibility semantics of [04-REQ-047] without any client-side workaround: a snake whose `visible` field is `false` shall not be displayed to a spectator connection, consistent with the server-side filter. The UI shall not attempt to infer or reconstruct invisible-snake state from any channel.

**08-REQ-084**: The Live Spectating view shall display a **scoreboard** per participating team. The scoreboard shall be sourced exclusively from a dedicated SpacetimeDB scoreboard view that publishes per-team aggregate quantities (team score, alive-snake count, aggregate length) computed server-side over the true alive-snake set — including any contributions from snakes whose `visible` field is `false` per [04-REQ-047] — and that exposes only those aggregates to spectator subscriptions. The client shall render the aggregates exactly as delivered by the view and shall not attempt to compute or correct them from any other channel. The scoreboard shall update live in response to subscription deliveries. *(Amended per 08-REVIEW-018 resolution: scoreboard is a server-side aggregate view, not client-aggregated from per-snake data, so invisibility cannot leak through omitted contributions.)*

**08-REQ-084b** *(negative)*: The application shall not compute team-level aggregate quantities (team scores, total alive-snake length, alive-snake counts, win-condition state, or any analogous aggregate) by aggregating raw per-snake subscription data on the client. All such aggregates are delivered by purpose-built SpacetimeDB views that compute them server-side over the true game state, so that the visibility-filter posture of [04-REQ-047] is not undermined by client-side reconstruction. *(Added per 08-REVIEW-018 resolution.)*

**08-REQ-085**: The Live Spectating view shall display the current turn number and, per participating team, the team's current remaining chess-timer budget and whether the team has declared its turn over for the current turn, consistent with the per-team time-budget data supplied by [04]'s subscription interface.

**08-REQ-086** *(negative)*: The Live Spectating view shall not expose any affordance that stages moves, selects snakes, toggles per-operator ready-state, or otherwise mutates game-runtime or Centaur-runtime state. Spectator access tokens per [03-REQ-026] do not authorise any such mutation and the UI shall not attempt any.

**08-REQ-087**: The Live Spectating view shall provide a **timeline scrubber** that permits the spectator to navigate to any previously completed turn of the current game and view the reconstructed board, snake, item, scoreboard, and event-log state at that turn, using the historical query capability of [04-REQ-057]. On entry to the Live Spectating view, the UI shall subscribe to the game's full historical state up-front (per [04-REQ-054]'s mid-game-join subscription pattern), accepting bounded entry latency proportional to game length; games are bounded to at most a few hundred turns and the worst-case entry latency on long games is acceptable. Scrubbing backward shall not interrupt the incoming live subscription; returning to the live head shall resume live rendering. *(Amended per 08-REVIEW-019 resolution: up-front full-history subscription on entry, no lazy-fetch state machine.)*

**08-REQ-088**: While the spectator is scrubbed to a historical turn, the Live Spectating view shall visibly communicate to the user that the display is not live, and shall provide a one-action affordance to return to the live head.

**08-REQ-089**: The Live Spectating view shall release its subscription and discard its spectator access token when the user navigates away from the view or when the game transitions to `finished` per [05-REQ-028].

---

### 8.17 Data Source Abstraction

**08-REQ-076**: The application shall implement a data-source abstraction under which the UI components of §§8.9–8.13 read board state, turn number, staged moves, chess-timer state, and computed display state through a uniform interface that the live mode binds to the current game's SpacetimeDB subscription and the current team's Centaur state subscription ([06-REQ-043]), and that the replay mode binds to the persisted replay and action log read from Convex ([05-REQ-040], [06-REQ-035]). This data-source abstraction is exported by `@team-snek/centaur-lib` and serves as the primary stable interface between the library and the operator web application, regardless of how teams modify the UI in their fork of the reference implementation repository ([02-REQ-032a]).

**08-REQ-077**: A UI component of the live operator interface shall not be required to distinguish whether it is rendering live or replayed state. Read-only enforcement in replay mode shall be accomplished by the data-source abstraction refusing mutation operations, not by each UI component implementing a read-only branch of its own.

**08-REQ-078** *(negative)*: The data-source abstraction shall not expose a mutation surface at all in replay mode. Attempts to invoke a mutation through a replay-mode data source shall fail without side effect.

---

### 8.17a Source Ownership and Customisation

**08-REQ-079**: The application shall be delivered in the Snek Centaur Server reference implementation repository ([02-REQ-032a]), not as part of the Centaur Server library itself. Teams obtain the application by forking the reference repository and customise it by modifying their fork directly — full source ownership, not a bounded extension point. Teams may modify, replace, or extend any Svelte component, add pages, change layouts, or restructure the UI as they see fit. No customisation shall relax any of the invariants stated in this module or in [06]; correctness is enforced externally by Convex function contracts ([06]) and security enforcement points ([02-REQ-033]).

**08-REQ-080a** *(negative)*: No customisation of the application shall be relied upon for any security or correctness invariant, per [02-REQ-033]. All invariants that constrain Centaur-state mutations shall remain enforced by [06]'s function contract surface regardless of what a team's forked application chooses to present or hide.

---

### 8.18 Player Profile

**08-REQ-090**: The application shall provide a **Player Profile** view for every user record per [05-REQ-004]. Each authenticated user shall have direct access to their own Player Profile via the global navigation of [08-REQ-010]. Access to other users' profiles shall be permitted at minimum via links from team member listings and game history. All Player Profile views are accessible only to authenticated users per [08-REQ-006]; there is no unauthenticated/public profile surface. *(Amended per 08-REVIEW-016 resolution.)*

**08-REQ-091**: The Player Profile view shall display at minimum the user's OAuth-provided display name, current and historical Centaur Team memberships, and a chronological **game history** listing every game in which the user was either a member of a participating team at the time (per the game's participating-team snapshot of [05-REQ-029]) or is a current member of one of those teams, together with each game's room, date, the participating teams, the final result (win/loss/draw), and the final scores per [05-REQ-038]. The Player Profile shall not display the user's email address to any viewer, including the user themselves on their own profile (the email is owned by the OAuth provider and any change must be made there). *(Amended per 08-REVIEW-016 resolution: email removed from displayed identity.)*

**08-REQ-091a** *(negative)*: No application view shall expose any user's email address to any other user, nor to the user themselves. Email addresses are stored in Convex solely for OAuth identity matching and admin operations and shall not be returned by any user-scoped Convex query (player profile, team-member listing, team management, game-history attribution, leaderboard, or any other user-facing surface). *(Added per 08-REVIEW-016 resolution. Downstream impact: [05]'s query layer must enforce this — no [05] user-scoped query may include the email field in its returned shape.)*

**08-REQ-092**: The Player Profile view shall display aggregate statistics derived from the user's game history: at minimum, games played, win rate, and average team score. These statistics shall be computed from the same data that populates the game history listing and shall therefore be consistent with it.

**08-REQ-093**: The Player Profile view shall resolve historical team attributions using the participating-team snapshot of [05-REQ-029] rather than the current team record, so that a historical game continues to show the team the user was playing for at the time even if the user has since changed teams or the team has been archived per [05-REQ-015a]. *(Amended per 08-REVIEW-017 resolution: archive-only semantics for Centaur Teams.)*

---

### 8.18a Team Profile

**08-REQ-094**: The application shall provide a **Team Profile** view for every Centaur Team per [05-REQ-008]. The Team Profile shall be accessible to every authenticated user; access is gated by the platform-wide authentication requirement of [08-REQ-006] and there is no unauthenticated/public team profile surface. *(Amended per 08-REVIEW-016 resolution.)*

**08-REQ-095**: The Team Profile view shall display at minimum the team's name, display colour, current Captain, current members per [05-REQ-011], the team's nominated server domain and its latest health status per [05-REQ-009], and a chronological game history listing every game in which the team participated, with each game's room, date, opposing teams, final result, and final scores. The game history shall include all games in which the team participated, visible to any authenticated user.

**08-REQ-096**: The Team Profile view shall display aggregate statistics derived from the team's game history: at minimum, games played, win rate, average score, and head-to-head records against each other team the team has ever played against.

**08-REQ-097**: The Team Profile view shall resolve historical opponent attributions using the participating-team snapshots of [05-REQ-029] so that head-to-head records remain stable even if an opposing team has since been archived per [05-REQ-015a]. *(Amended per 08-REVIEW-017 resolution: archive-only semantics for Centaur Teams.)*

**08-REQ-098** *(negative)*: The Team Profile view shall not expose any mutating affordance over team state. Mutation of team state is the exclusive responsibility of the Team Management view (§8.5b), which enforces the Captain-only scope of [08-REQ-023d] and the mid-game freeze of [08-REQ-023e].

---

### 8.19 Leaderboard

**08-REQ-094a**: The application shall provide a global **Leaderboard** view that ranks Centaur Teams by one of a closed set of criteria. The closed set shall be at minimum: win rate (with a minimum games-played qualifying threshold), total wins, and average score.

**08-REQ-094b**: The Leaderboard view shall permit the user to switch between the criteria of [08-REQ-094a] and to filter results by time window from a closed set including at minimum: all time, last 30 days, and last 7 days.

**08-REQ-094c**: The Leaderboard view shall permit optional restriction of the ranking to games played within a specific room. When a room restriction is applied, the ranking shall consider only games whose room matches.

**08-REQ-094d**: The Leaderboard view shall link each ranked team directly to that team's Team Profile view per §8.18a.

**08-REQ-094e**: The Leaderboard view shall resolve historical attributions using the participating-team snapshots of [05-REQ-029], so that a team's ranking continues to reflect games it played under its historical identity even if the team has since been archived per [05-REQ-015a]. Archived teams shall continue to appear in the default leaderboard view under their archived identity, consistent with the archive-only semantics of [05-REQ-015a] (which is a live-state hide-from-listings action and not a historical-state rewrite, paralleling [05-REQ-021a] for room archiving). *(Amended per 08-REVIEW-017 resolution: deletion is not a thing in this platform; archived teams remain in leaderboards by default.)*

**08-REQ-094f** *(negative)*: The Leaderboard view shall not be accessible in a way that exposes team or player data to unauthenticated visitors. Leaderboard access is subject to the authentication requirement of [08-REQ-006]. *(Amended per 08-REVIEW-016 resolution: deferral removed; authentication requirement is positively pinned.)*

---

### 8.20 API Key Management

**08-REQ-095a**: The application shall provide an **API Key Management** view accessible to every authenticated user, through which the user may create new API keys per [05-REQ-051] and revoke API keys they previously created per [05-REQ-052]. The view shall list the user's active and revoked API keys with at minimum each key's human-chosen label, creation timestamp, and revocation timestamp where applicable.

**08-REQ-095b**: When an API key is created via the API Key Management view, the UI shall display the key's plaintext exactly once, at the moment of creation, consistent with [05-REQ-046] and [03-REQ-034]. After that single display, the UI shall never present the plaintext again. The UI shall provide an explicit affordance for the user to copy the plaintext to their clipboard before dismissing the creation dialog.

**08-REQ-095c** *(negative)*: The API Key Management view shall never display, store, or transmit API key plaintext except during the single creation-time disclosure of [08-REQ-095b]. Subsequent views of the key shall show only its label and metadata per [08-REQ-095a].

**08-REQ-095d**: The API Key Management view shall visibly communicate to the user that an API key's authorization scope is bounded by the user's own current authorization scope per [05-REQ-047], so that the user understands that losing team roles or membership will correspondingly reduce what actions their API keys can perform (subject to 05-REVIEW-004).

---

### 8.21 Admin Experience

**08-REQ-096a**: When the authenticated user holds the platform admin role ([05-REQ-065]), the application shall expose the following additional capabilities:

- **Team visibility**: The admin shall be able to view all Centaur Teams, their members, roles, and nominated server domains, regardless of membership ([05-REQ-066]).
- **Game visibility**: The admin shall be able to view all games (active and completed), including those in rooms or involving teams the admin is not a member of ([05-REQ-066]).
- **Replay access**: The admin shall be able to view the team-perspective replay (sub-turn within-turn actions) for any team in any game, regardless of team membership ([05-REQ-066]). For finished games this access is shared with all authenticated users; the admin distinction is meaningful for live-game cross-team visibility, where the admin holds implicit coach permission for every team per [05-REQ-067].
- **Live coach access**: The admin shall be able to enter the live operator interface of any in-progress game in any team's read-only coach mode ([08-REQ-052a]) without being explicitly designated as a coach of that team.

**08-REQ-096b** *(negative)*: The admin experience shall be read-only with respect to game state and Centaur-subsystem state. Admin users shall not be able to stage moves, edit Drive portfolios, toggle per-operator ready-state, or otherwise act as operators for teams they do not belong to. Admin visibility is observational, not operational.

---

### 8.22 Lifecycle and Session Boundaries

**08-REQ-081a**: The application's live operator interface shall become available on the team's navigation for a given game at the moment that game transitions to `playing` ([05-REQ-028]) and shall remain available until that game transitions to `finished`.

**08-REQ-082a**: On a game transitioning to `finished`, the live operator interface shall be replaced for connected operators by a terminal state indicator that surfaces the final scores ([05-REQ-038]) and a link to open the same game in the replay viewer. The terminal state shall not offer any mutating affordances.

**08-REQ-083a**: When the application loses its subscription to either SpacetimeDB or Convex, it shall surface the loss to the operator and shall not fabricate missing state from stale caches. On recovery, the application shall resubscribe and resume rendering from fresh state.

**08-REQ-084a** *(negative)*: The application shall not persist any authoritative state of its own across sessions. All operator-visible state is derived from [04], [05], or [06] on each session, consistent with [07-REQ-057]'s posture for the framework.

---

### 8.23 Cross-Cutting UI Invariants

**08-REQ-100**: The application shall surface Convex-side invariant rejections to the user as explicit, user-legible feedback at the point of the rejected action. The UI shall not silently swallow rejection errors.

**08-REQ-101**: The application shall treat any affordance whose authoritative enablement is governed by a Convex-side invariant (for example, mid-game roster freeze, minimum team count, ready-check gate) as an affordance whose *enabled* state in the UI must be derivable from Convex-held state, not from client-held optimism. Where this derivation is not yet possible because the invariant lives only in Convex mutation handlers, the UI shall still dispatch the mutation and surface the result per [08-REQ-100].

**08-REQ-102**: The application shall honour the distinction between the immutable parameter snapshot bound to a game ([05-REQ-024]) and the current parameter defaults held on a room. In particular, viewing a game's configuration — whether the game is `playing`, `finished`, or referenced from replay or history — shall show the game's snapshotted parameters, not the room's current defaults, even if the two differ.

**08-REQ-103**: The application shall be resilient to a Centaur Team being archived per [05-REQ-015a]: views that reference historical teams (game histories, leaderboards, profiles) shall continue to render using the participating-team snapshot, and views that reference a currently-live team that has been archived shall present the archived state to the user explicitly rather than failing or showing broken references. *(Amended per 08-REVIEW-017 resolution: archive-only semantics for Centaur Teams.)*

**08-REQ-104**: Every mutating action taken by the application shall be dispatched against the platform Convex runtime of [05] and shall be subject to the same invariants as the equivalent HTTP API call, including the mid-game roster freeze of [05-REQ-013]. The UI shall not attempt to bypass or work around any Convex-side invariant; where an action is disallowed by Convex, the UI shall surface the rejection to the user.

---

## REVIEW Items

### 08-REVIEW-001: Role gating of heuristic configuration and bot parameters — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: Informal spec §7.1 and §7.2 both say the heuristic config and bot parameters are "editable by any team member". §8.2 separately says team identity, server registration, and membership are captain-only — an explicit distinction that implies team-internal competitive configuration is deliberately not captain-only. [06-REQ-008] and [06-REQ-012] echo this by requiring only that the caller be a team member. This is a plausible reading but is surprising: a new operator could, immediately upon being added to the team, change the team's global heuristic defaults in ways that affect subsequent games for everyone. No mechanism in the current draft provides a safeguard.
**Question**: Should the heuristic configuration page and the bot parameters page be gated on a role (captain, timekeeper) rather than general team membership?
**Options**:
- A: Any team member can edit. (Current draft, matches informal spec literally.)
- B: Captain-only for both pages.
- C: Captain-or-timekeeper for both pages.
- D: Page is read-only to general members; an "edit mode" affordance requires the captain to promote.
**Informal spec reference**: §7.1, §7.2, §8.2.

**Decision**: Captain-only for team-scoped defaults; any team member for game-scoped overrides. Only the Captain can edit `global_centaur_params` and team-level heuristic defaults in `heuristic_config`. Any team member can edit game-scoped heuristic weight overrides (per-snake Drive weights, Preference activation, temperature overrides during a live game). There is no longer a timekeeper role (eliminated per 05-REVIEW-014).
**Rationale**: Team-scoped defaults (global temperature, default operator mode, heuristic default weights, dropdown ordering) represent strategic decisions that affect all future games for the entire team. Restricting these to the Captain prevents a newly-added operator from unilaterally changing team strategy. Game-scoped overrides, by contrast, are tactical in-game adjustments that operators need to make in real time during gameplay — requiring Captain approval for every weight tweak during a live game would be operationally unworkable. This split aligns with the existing Captain/member distinction in team management (§8.5b) and is consistent with the elimination of the timekeeper role per 05-REVIEW-014.
**Affected requirements/design elements**: 08-REQ-019 amended (team-scoped heuristic defaults are Captain-only). 08-REQ-008 amended (references updated role list). 08-REQ-017 amended (Captain-only for team-scoped mutations). 08-REQ-021 amended (Captain-only for bot params). 06-REQ-008 amended (Captain-only for team-scoped heuristic config writes). 06-REQ-012 amended (Captain-only for bot param writes). Design §2.2.1 authorization updated.

---

### 08-REVIEW-002: Mid-game effect of default-operator-mode edits — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 08-REQ-022 says the default operator mode affects only future games, since the running game's mode is owned by the session's in-memory state and toggled by the timekeeper. But [06-REQ-011] treats the default operator mode as a team-scoped record and [06-REQ-009] says team-scoped edits do not retroactively affect in-progress games' portfolio state — that rule addresses heuristic config, not the operator mode. A strict reading of [06] leaves the mid-game behaviour of a default-operator-mode edit undefined.
**Question**: Does editing the default operator mode during a game affect the running game's current mode, the next game only, or neither (treated as a no-op until the next game starts)?
**Options**:
- A: Edit takes effect only on the next game's initial mode; running game is unaffected. (Current draft.)
- B: Edit takes effect immediately — the running game's current mode is reset to the new default.
- C: Edit is silently blocked while the team has a game in `playing` status.
**Informal spec reference**: §7.2.

**Decision**: Option A — all global defaults (including default operator mode) take effect only upon creating game-specific state at game launch. Running games are unaffected by edits to team-scoped defaults.
**Rationale**: This is already the semantics expressed by [06-REQ-009] for heuristic config, and the same principle applies uniformly to all team-scoped defaults including `global_centaur_params`. At game start, `initializeGameCentaurState` ([06-REQ-014], [06-REQ-040a]) copies team defaults into game-scoped state as a point-in-time snapshot. Once the game is live, the game-scoped `game_centaur_state` record is the live source of truth; the team defaults are irrelevant until the next game starts. This avoids the confusion of Option B (mid-game mode resets would be disruptive) and the unnecessary restriction of Option C (teams should be free to prepare their defaults for the next game while a current game is in progress).
**Affected requirements/design elements**: 08-REQ-022 amended with explicit language that all `global_centaur_params` edits affect the next game only. 06-REQ-009 confirmed as already correct (applies to all team-scoped defaults). 06-REQ-040a confirmed as already expressing the snapshot semantics correctly.

---

### 08-REVIEW-003: Game history visibility scope — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 08-REQ-024 and 08-REQ-027 currently restrict the game history list to games the authenticated human participated in. Informal spec §7.3 says "completed games the logged-in user participated in", which supports this. But a coach or captain may want to review all of the team's past games regardless of personal participation. The informal spec does not contemplate this and the draft takes the narrow reading.
**Question**: Should the game history list show (a) only games the current human participated in, (b) all of the team's games, or (c) both with a toggle?
**Options**:
- A: Personal participation only. (Current draft.)
- B: All team games.
- C: Personal by default, toggle to show all.
**Informal spec reference**: §7.3.

**Decision**: A user sees a game in their history if they were either (a) a member of a participating team at the time of the game (per the game's participating-team snapshot of [05-REQ-029]) or (b) a current member of one of the participating teams now. Additionally, replay access for MVP is fully public: all replay data (including within-turn operational data of both teams) is publicly accessible to all authenticated users once a game has finished. The game history visibility rule only determines which games are proactively listed in a user's interface; if someone has a direct link to a game, any registered user can view the full replay. Private games are eliminated entirely for MVP.
**Rationale**: The expanded visibility rule (historical OR current membership) gives captains and coaches visibility into team games that occurred before they joined, which is important for team strategy review. Making replays fully public for MVP simplifies the access model dramatically — there is no privacy-gating complexity — and aligns with the open competitive spirit of the platform. The private-games concept added significant cross-module complexity for a feature that is not essential to MVP. It can be reintroduced in a future version if needed.
**Affected requirements/design elements**: 08-REQ-024 amended (historical or current team membership). 08-REQ-027 amended (removed negative restriction). 08-REQ-091 amended (Player Profile game history uses historical-or-current rule). 08-REQ-095 amended (Team Profile game history). 08-REQ-075d, 08-REQ-075e, 08-REQ-075f removed (private games eliminated). §8.15a removed. Private games removed across all modules: 02-REQ-066, 02-REQ-067 removed; 05-REQ-069, 05-REQ-070, 05-REQ-071, 05-REQ-072 removed; the original privacy-bypass 05-REQ-067 was removed (the 05-REQ-067 number slot has since been reused for the unrelated Coach Role); §5.12 removed (the §5.12 section number has since been reused for the unrelated Coach Role section); 05-REQ-023 game privacy row removed; 06 getCentaurActionLog privacy clause removed; 03-REQ-063 amended (privacy reference removed). GameConfig.gamePrivacy field removed.

---

### 08-REVIEW-004: Presence state store — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 08-REQ-032 and 08-REQ-035 require a presence display of other connected team operators in the header. Neither [05] nor [06] defines a presence state field, and [06-REQ-018]'s selection record encodes only the current selector of a snake, not the set of connected operators who are unselected. A plausible implementation is that the Snek Centaur Server runtime itself holds presence state and serves it over its own subscription (outside Convex), but no module currently defines this contract. See 08-REQ-003 which already acknowledges the Snek Centaur Server as a source for in-memory bot-framework state the browser reads directly; presence likely rides the same channel. Requires explicit specification somewhere.
**Question**: Where does operator presence state live, and which module owns its specification?
**Options**:
- A: Snek Centaur Server in-memory state exposed to the browser via a server-hosted subscription. Requires [02] to acknowledge this subscription exists, and [08] to specify its shape.
- B: Convex ephemeral presence table owned by [06], with TTL-based cleanup.
- C: Derived from selection state only — "connected" means "has ever held a selection this session". Loses unselected-operator visibility.
**Informal spec reference**: §7.5 ("Connected operators shown as coloured dots with nicknames").

**Decision**: Roughly Option B — Convex-hosted presence solution. Operator presence state shall be managed through a Convex-hosted presence mechanism. The design phase should use the `@convex-dev/presence` library, which provides ephemeral presence state with heartbeat-based TTL cleanup natively within the Convex reactive query system.
**Rationale**: A Convex-hosted presence solution keeps operator presence within the same reactive data layer that the operator interface already subscribes to for all other state, avoiding the need for a separate subscription channel between the browser and the Snek Centaur Server. The `@convex-dev/presence` library provides exactly the semantics needed: ephemeral per-user presence with automatic cleanup when a client disconnects, delivered via Convex's reactive query system. This is simpler than Option A (which would require a separate real-time channel and server-side presence management) and richer than Option C (which loses visibility of unselected but connected operators).
**Affected requirements/design elements**: 08-REQ-032 amended to reference Convex-hosted presence. 08-REQ-035 amended to reference Convex-hosted presence. Design-phase note added: the implementation should use the `@convex-dev/presence` library for operator presence state.

---

### 08-REVIEW-005: Drive dropdown ordinal collisions — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: [06-REQ-007] says each Drive type has an ordinal dropdown position, and 08-REQ-052 orders the dropdown by that ordinal. Nothing in either module prevents two Drive types from having the same ordinal. In that case the ordering is underspecified; tiebreak behaviour could be alphabetic, insertion order, or stable-by-id. This matters because operators rely on the dropdown position as muscle-memory shorthand.
**Question**: What is the tiebreak when two Drive types have the same ordinal?
**Options**:
- A: Secondary sort by Drive type name (alphabetical). Stable and predictable.
- B: Secondary sort by Drive type registration order.
- C: Enforce uniqueness of ordinals in the heuristic config contract ([06-REQ-007]).
**Informal spec reference**: §7.6.

**Decision**: Replace the `dropdownOrder` ordinal system entirely with a pinned-heuristics list and lexicographic fallback. A `pinnedHeuristics` field (ordered array of heuristic IDs) is added to `global_centaur_params`. A `nickname` field is added to `heuristic_config`. The `dropdownOrder` field is removed from `heuristic_config`. Drive dropdown ordering is: pinned heuristics appear first in the order specified by the `pinnedHeuristics` array; remaining heuristics are ordered lexicographically by `nickname`, then by `heuristicId` as tiebreaker.
**Rationale**: The ordinal system was fragile — it required manual coordination of ordinal values across all Drive types, had no collision prevention, and was difficult to reorder (changing one Drive's position required updating others). The pinned-heuristics approach is more intuitive: the Captain pins the most-used Drives to the top in a specific order, and everything else falls into a stable alphabetic order by its human-readable nickname. The `nickname` field gives teams a way to assign meaningful short names to heuristics (which have machine-readable `heuristicId` values defined in source code). This eliminates the collision problem entirely and makes reordering a simple array manipulation on a single field.
**Affected requirements/design elements**: 06-REQ-007 amended (dropdownOrder replaced with nickname; ordering rule specified). 06-REQ-011 amended (pinnedHeuristics added to global_centaur_params). `heuristic_config` schema updated (dropdownOrder removed, nickname added). `global_centaur_params` schema updated (pinnedHeuristics added). 08-REQ-052 amended (new ordering scheme). 07-REQ-027, 07-REQ-028 updated (references to configured Drive ordering updated). Exported interface types updated.

---

### 08-REVIEW-006: Tab cycle deterministic tie-break in targeting — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 08-REQ-054 orders Tab-cycled targeting candidates by A*-distance from the selected snake's head. Two candidate targets may be equidistant; the order they are visited by Tab is then undefined. As with the dropdown, this matters because operators come to rely on specific sequences during rapid play.
**Question**: What is the tiebreak when two candidate targets have equal A* distance?
**Options**:
- A: Secondary sort by target identity (snake id or cell coordinates in row-major order).
- B: Secondary sort by angle from the snake's head in a fixed rotation direction.
- C: Leave undefined; the operator must click directly if Tab produces ambiguity.
**Informal spec reference**: §7.6 ("in order of A* distance from the snake's head").

**Decision**: Option B with Option A as a tertiary fallback. The Tab cycle order shall be fully deterministic with three sort keys, in priority: (1) A*-distance from the selected snake's head, ascending; (2) clockwise angle in board coordinates from the snake's current head direction, starting at 0° (straight ahead) and increasing through 360°; (3) target identity — snake id ascending for snake targets, cell coordinates in row-major order (row then column ascending) for cell targets. The third key exists only to fully discharge the determinism obligation in pathological cases (e.g., two distinct candidates that share the same A*-distance and the same clockwise angle from the head — practically impossible for cell targets and only possible for snake targets if two candidate snakes' bodies somehow project onto exactly the same head-relative angle, which the head-A* distance key has already disambiguated whenever the candidate snakes occupy distinct cells).
**Rationale**: Clockwise-from-head is rotationally meaningful to the operator: the snake has an orientation, and "next clockwise" maps onto the operator's head-relative mental model of the board. A pure global identity sort (Option A) produces orientationally meaningless cycle orders that vary unpredictably as targets move around the board relative to the snake. Option C (leaving the tiebreak undefined) fails the determinism property that operator muscle memory depends on. The identity-based tertiary key keeps Option B fully deterministic without sacrificing its head-relative semantics in any realistic case.
**Affected requirements/design elements**: 08-REQ-054 amended to specify the three-key deterministic Tab cycle order.

---

### 08-REVIEW-007: Timekeeper affordance availability when no timekeeper is assigned — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: [05-REQ-011] says a team has at most one timekeeper at any time, implying the role may be absent. 08-REQ-065 and 08-REQ-067 say only the current timekeeper sees and can invoke the affordances. If no timekeeper is assigned, no member of the team can submit the turn in Centaur mode, and the game can only end by clock expiry. This is possibly intentional (a team that fails to assign a timekeeper is accepting that consequence) but is worth confirming.
**Question**: When a team has no timekeeper, who — if anyone — can invoke the mode toggle and turn-submit affordances?
**Options**:
- A: No-one. Centaur-mode games proceed only until clock expiry. (Current draft.)
- B: The captain acquires the affordances as a fallback.
- C: Any team member acquires the affordances as a fallback.
- D: The team is blocked from entering Centaur mode at all if no timekeeper is assigned.
**Informal spec reference**: §7.5 ("Timekeeper controls (visible only to the designated timekeeper)"); §8.2.

**Decision**: Moot — the timekeeper role has been eliminated per 05-REVIEW-014 resolution. All former timekeeper affordances (operator-mode toggle and turn-submit) are now Captain-only. The Captain is a structural role (`centaur_teams.captainUserId`) that always exists on every team, so the "no timekeeper assigned" edge case cannot arise. See amended §8.14 (now titled "Captain Controls") and 08-REQ-065 through 08-REQ-068.
**Rationale**: The timekeeper was eliminated as unnecessary MVP complexity. The Captain, being structurally required on every team, inherits the capabilities without any gap in coverage.
**Affected requirements/design elements**: 08-REQ-065, 08-REQ-066, 08-REQ-067, 08-REQ-068 amended (timekeeper → Captain). §8.14 retitled "Captain Controls". 02-REQ-043 amended (timekeeper assignment removed).

---

### 08-REVIEW-008: Replay-mode selection and Centaur state — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 08-REQ-074 asserts that replay-mode selection is a local UI concept that does not issue any Centaur state mutation. [06-REQ-018] defines the selection record as a per-(game, snake) Convex row. The replay viewer reads, but does not write, Centaur state. This is straightforward for the "invisible observer" reading but leaves one ambiguity: if two humans open replays of the same game simultaneously and each inspects a different snake, both can be inspecting different snakes without conflict (since neither writes). But if the team replay viewer in the future is extended to support shared replay sessions where multiple people see each other's positions, that extension would require either a new replay-selection record or a reuse of the selection record with a "replay selector" flag. The current draft does not contemplate shared replay sessions; this is a forward-compatibility concern.
**Question**: Confirm that replay-mode selection is purely client-local and does not require any additional Convex state.
**Options**:
- A: Purely client-local; no Convex state. (Current draft.)
- B: Add a replay-scoped selection record to [06] for future shared replay sessions.
**Informal spec reference**: §13.3 ("The replay viewer acts as an invisible additional observer").

**Decision**: Option A — non-mutating snake viewing (replay viewer per [08-REQ-074] and live-game coach mode per [08-REQ-052a]) is purely client-local; no Convex state is added and no SpacetimeDB write is issued. Even if shared replay sessions are added in the future, the exclusive-lock semantics of the existing selection mechanic ([06-REQ-018] through [06-REQ-024]) are inappropriate for shared replay gaze-tracking, because two replay viewers inspecting different snakes must not displace each other's view; that future extension would require a different (non-exclusive) state model and is out of scope here. Live-game coach inspection ([05-REQ-067], [08-REQ-052a]) needs the same affordance and the same semantics as replay inspection, since both are "invisible additional observer" use cases.

The decision additionally adopts the following terminology distinction across Module 08, applied uniformly to prose, requirement wording, identifier-style names, mutation names, Convex field names, and UI affordance labels:

- **selection** / **selector** / **selected snake** / `selectSnake` / `deselectSnake` / `operatorUserId` — retained for the existing exclusive-lock control affordance owned by [06]. A selection grants the holding operator the right to stage moves and toggle manual mode for the snake; only one operator at a time may hold a selection on any given snake; selections are persisted in Convex (`snake_operator_state.operatorUserId`) and produce per-operator coloured **selection shadows** on the board ([08-REQ-039]). All [06] identifiers and the existing [08] selection-acquisition prose ([08-REQ-039], [08-REQ-042], [08-REQ-043]) keep the "selection" name unchanged.
- **inspection** / **inspector** / **inspected snake** / `inspectSnake` / `clearInspection` / `inspectedSnakeId` — the new, non-mutating, purely client-local affordance by which a single viewer client (a replay viewer per [08-REQ-074] or a coach in live-game coach mode per [08-REQ-052a] / [08-REQ-052c]) chooses which snake's portfolio, stateMap, decision breakdown, worst-case world, and per-direction candidate highlights are displayed in their own UI. Inspection state is held in client-local UI state only; `inspectedSnakeId` is a client-local field, **never** a Convex field. Inspection never produces a selection shadow on the board, never issues any Convex or SpacetimeDB mutation, never displaces or interacts with any operator's selection, and is invisible to every other client.

Each viewer client may have at most one inspected snake at a time. Replay inspection and coach inspection share identical semantics; the only difference is the data source on which the inspection view is rendered (persisted replay + reconstructed action log for replay inspection; live SpacetimeDB and Convex subscriptions for coach inspection).

**Alternative names considered and rejected** (for traceability of the naming choice):
- **focus** / `focusedSnakeId` — overloaded with the established UI meaning of "input focus" (the focused element receiving keyboard events); also lacks a clean noun form for the holder ("focuser" reads awkwardly).
- **spotlight** / `spotlightedSnakeId` — connotes a presentational/broadcast metaphor (the snake is highlighted to others) rather than a private viewing decision; misleading for a per-client affordance.
- **gaze** / `gazedSnakeId` — matches the "gaze-tracking" framing in the original review prompt but is awkward as a verb in identifier names (`gazeSnake`, `gazeAtSnake`) and has no commonly understood adjective form.
- **preview** / `previewedSnakeId` — already used in this module to mean the worst-case world preview ([08-REQ-048]) and the board preview ([08-REQ-027i]); reusing it for snake viewing would collide with both.
- **view-selection** / `viewSelectedSnakeId` — preserves "selection" in the name and would defeat the entire purpose of the terminology distinction.

**Recommended term: "inspection"**, because (a) [08-REQ-074] already uses the phrase "select a snake for inspection", so the verb is already in this module's vocabulary; (b) "inspection" is semantically distinct from "selection" in everyday English (one inspects without taking ownership); (c) the noun/verb/adjective forms (inspect / inspector / inspected / inspection) are uniformly available and read naturally in identifier names, prose, and UI labels.

**Rationale**: Option A keeps [06]'s existing exclusive-lock selection semantics — and its Convex schema, mutations, and invariants — entirely unchanged for the existing operator-control affordance. The non-mutating viewing affordance for replay viewers and coaches is introduced without any Convex schema change or any new mutation; it is realised purely as client-local UI state in this module's web application. The "selection vs inspection" terminology distinction makes it lexically obvious at every use site which of the two affordances is intended, eliminating the structural ambiguity that motivated the original review.

**Affected requirements/design elements**: 08-REQ-074 reworded to use "inspection" terminology and to make explicit per-client / no-shadow / no-mutation semantics. 08-REQ-075 reworded to "inspection of any snake". 08-REQ-052c added (coach mode inspection affordance with semantics identical to replay inspection). 08-REQ-052d added *(negative)* (coach inspection must not use a gesture grammar confusable with operator selection). 08-REQ-071 reworded to refer to "snake inspection" within team-perspective replay rather than "snake selection". Module 06 §6.5 receives a single-sentence clarifying note that "selection" in that module refers exclusively to the exclusive-lock control affordance and that the separate non-mutating per-client **inspection** affordance is owned by [08] and adds no state to [06]; no [06] schema, mutation, identifier, or interface changes. [05-REQ-067] read scope is unchanged and is cross-referenced from the new coach-inspection requirement.

---

### 08-REVIEW-009: Scope of application customisation — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: [02-REQ-032(c)] (now removed) permitted "optional customization of the operator web application" as one of three extension points. Neither [02] nor [08]'s draft specified what "customisation" meant concretely: can a team replace entire pages? Inject arbitrary UI? Swap out the move interface? Override the board renderer? The boundary mattered because aggressive customisation could present the operator with affordances inconsistent with [06]'s invariants even though those invariants remained enforced server-side.
**Question**: What is the intended scope of customisation — theming only, component swapping, or full page replacement?
**Options**:
- A: Theming and layout tweaks only. Functional components are fixed.
- B: Component-level swapping with a stable component contract; functional boundaries preserved.
- C: Full page replacement; only the data-source abstraction (§8.12) and [06]'s function contracts are load-bearing.
**Informal spec reference**: §7 ("The Centaur Server library provides a reference implementation of the full web application; teams may customise the UI.").

**Decision**: Full source ownership via fork (supersedes options A/B/C). The operator web application is no longer an extension point of the Centaur Server library. Per [02-REQ-032a], teams obtain the operator app by forking the reference implementation repository and have complete freedom to modify any aspect of the UI — theming, component replacement, page restructuring, or full rewrites. The customisation scope is unbounded at the UI layer. Correctness is enforced externally by Convex function contracts ([06]) per [02-REQ-033], not by constraining what the UI may present. The data-source abstraction ([08-REQ-076]) exported by centaur-lib is the stable interface between the library and the operator app; teams' forks depend on this API surface for data access.
**Rationale**: Defining a bounded customisation interface within the library is unnecessary because the operator app is a separate forkable artifact, not a library extension point — the question of where to draw the customisation boundary dissolves once UI ownership transfers to the team's fork.
**Affected requirements/design elements**: [02-REQ-032(c)] removed; [02-REQ-032a] added; [08-REQ-076] data-source abstraction designated as the stable centaur-lib API surface.

---

### 08-REVIEW-010: Speed-control set in replay viewer — **RESOLVED**

**Type**: Proposed Addition
**Phase**: Requirements
**Context**: The informal spec §13.3 mentions that the team replay viewer has "play/pause, and speed controls", without enumerating a speed set. Informal spec §8.6 enumerates `{0.5×, 1×, 2×, 4×}` for the platform replay viewer. The draft pins `{0.5×, 1×, 2×, 4×}` for the board-level replay mode. If the team-perspective mode needs a different speed set (sub-turn scrubbing operates at finer granularity), it should be pinned now.
**Question**: Should the team-perspective replay mode use the same speed set as the board-level mode, and if not, what set?
**Options**:
- A: Leave to Phase 2 design; do not pin. (Current draft for team-perspective.)
- B: Pin `{0.5×, 1×, 2×, 4×}` for consistency.
- C: Team-perspective replay requires finer-grained control — different set.
**Informal spec reference**: §8.6; §13.3.

**Decision**: Supersede the single-speed-set framing entirely. The unified Replay Viewer's timeline control shall expose a **mode toggle** with two settings — **Per-Turn mode** and **Timeline mode** — each with its own scrubbing semantics, keyboard navigation, turn-marker rendering, and playback-speed set. The toggle is persistent across the viewer's lifetime within a single session and applies to both the board-level and team-perspective replay modes (08-REQ-069), so a single timeline control governs scrubbing for either replay mode.

- **Per-Turn mode**: scrubber shows turns as equidistant tick marks (one tick per turn); scrubbing snaps to the **end of each turn** (the centaur-state state-of-the-world that operators saw at the moment they were declaring submissions). No intra-turn positions are addressable in this mode. Playback advances one turn per tick at the configured rate. Speed-control set: **{0.25, 0.5, 1, 2, 4, 8} turns/second**.
- **Timeline mode**: scrubber's horizontal axis represents wall-clock time of the original game from game start (left) to game end (right). Turn boundaries are rendered along the timeline as **turn-marker glyphs** at the actual clock-time at which each turn was declared over (not equidistant — separation reflects the variable real wall-clock duration of each turn under the chess-clock mechanism). Scrubbing is continuous along clock time. Playback advances at a scalar multiple of real time. Speed-control set: **{0.25×, 0.5×, 1×, 2×, 4×, 8×}**.
- **Keyboard navigation in Timeline mode**: `Left`/`Right` (no modifier) seek ±1 second of clock time; `Shift+Left`/`Shift+Right` seek ±200 ms; `Ctrl+Left`/`Ctrl+Right` (use `Cmd` on macOS) snap to the previous/next turn-marker keyframe (the timeline-mode analogue of per-turn scrubbing without leaving timeline mode).
- **Keyboard navigation in Per-Turn mode**: `Left`/`Right` advance one turn backward/forward. Whether modifier keys are unbound or bound to a coarser/finer step (e.g., ±5 turns and ±1 turn respectively) is left as an explicit Phase-2 design decision.
- **Speed-control rendering**: the speed-control widget renders the current mode's unit in the label (e.g., "2 turns/s" vs "2× speed") so the operator is never ambiguous about what the multiplier means.
- **Mode toggle persistence**: the chosen mode and the chosen speed-within-mode are persisted in the viewer's client-local UI state and restored across navigation within the session. They are *not* persisted to Convex; this is purely a client preference.

**Rationale**: The prior draft pinned a single speed set without contemplating that the user's mental model differs between turn-level review (where "1×" means "one turn") and clock-time review (where "1×" means "real time"). Forcing both modes to share a single set conflates these. The toggle gives operators direct control over whether they are exploring strategic structure (per-turn) or timing dynamics (timeline). The variable inter-turn spacing in Timeline mode preserves the chess-clock signal that some turns burned more clock budget than others.

**Affected requirements/design elements**: 08-REQ-072 amended to incorporate the per-mode semantics and remove the prior `{0.5×, 1×, 2×, 4×}` pin; 08-REQ-072a added (mode toggle and persistence); 08-REQ-072b added (Per-Turn mode semantics and speeds); 08-REQ-072c added (Timeline mode semantics, turn-marker glyphs, and speeds); 08-REQ-072d added (keyboard navigation in both modes); 08-REQ-070a and 08-REQ-071 cross-link the unified control so both replay modes pick it up.

---

### 08-REVIEW-011: Interaction between automatic-mode timer and manual overrides mid-turn — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 08-REQ-062 (prior version) said the Automatic-mode timer proceeds independently of operator UI interactions. But [07-REQ-046] says manual-mode snakes are never auto-staged. If during an Automatic-mode turn an operator flips several snakes to manual mode and stages human moves for them, and then the Automatic timer fires, is the team's turn declared over with those human moves in place and the remaining automatic snakes' latest bot-staged moves? Informal spec §7.5 implies yes ("submitting all currently staged moves"). The requirements as drafted omitted this detail.
**Question**: On Automatic-mode timer expiry, does the turn-over declaration submit exactly the current staged moves for all owned snakes (mix of bot and human staging), or does it require all automatic-mode snakes to have a bot-staged move before firing?
**Options**:
- A: Declare turn over with whatever is currently staged. (Informal spec §7.5 reading.)
- B: Wait for [07]'s final-submission pass to flush all automatic-mode dirty flags before declaring.
- C: Combine: the timer expiry triggers [07]'s final pass synchronously, then declares.
**Informal spec reference**: §7.5 (header "Timekeeper controls — Submit shortcut key: immediately declares the team's turn over, submitting all currently staged moves").

**Decision**: Supersede the team-level operator-mode (Centaur / Automatic) model entirely with a **per-operator ready-state** model. The original ambiguity is dissolved at the source: there is no longer a team-level "Automatic-mode timer" whose expiry has to be reconciled with operator manual overrides. Instead:

- Each operator currently connected to the team's game session independently signals **ready / not-ready** for the current turn (per [08-REQ-061], persisted in [06]'s new `operator_ready_state` table per [06-REQ-040b]).
- The framework's automatic turn submission process is **gated** on **all currently-connected operators being simultaneously `ready`** (per [08-REQ-062]). The all-ready quorum is a *passive necessary precondition*, not a positive declaration — it simply permits the framework to finalise via `declare_turn_over` according to its own existing automatic submission rules ([07-REQ-044] / [07-REQ-045]), which are not restated here. The Captain's explicit turn-submit affordance ([08-REQ-065]) is an *independent override* path that bypasses this precondition entirely, immediately submitting whatever is currently staged and suppressing the framework's final flush per [07-REQ-045a]. Otherwise, the team's existing per-turn clock and time budget ([01-REQ-037], [01-REQ-038]) continue to govern the upper bound on turn duration.
- The framework's submission process — the team-level scheduled-pass cadence of [07-REQ-044] iterating over all dirty automatic-mode snakes, and the team-level final-flush deadline of [07-REQ-045] (`min(automaticTimeAllocationMs, remainingTimeBudget)`) — is unchanged in shape; manual-mode snakes remain excluded per [07-REQ-046]. The only substantive change to [07] is that the separate `turn0AutomaticTimeAllocationMs` carve-out is removed: turn 0 now uses the same `automaticTimeAllocationMs`, naturally bounded by the chess-clock's turn-0 budget via `remainingTimeBudget`.
- The `defaultOperatorMode` and `turn0AutomaticTimeAllocationMs` fields are removed from `global_centaur_params` and `game_centaur_state` (per [06-REQ-011] and [06-REQ-040a]). The remaining `automaticTimeAllocationMs` field is retained with its existing team-level turn-deadline semantics. The action-log event `mode_toggled` is removed and replaced by `operator_ready_toggled` (per [06-REQ-040b]).

**Rationale**: A single team-level mode forced an awkward question about whether a timer expiry should cooperate with mid-turn manual overrides. Per-operator ready-state matches the actual coordination problem teams face — every connected operator signals when they're done thinking — and elegantly accommodates mixed bot/manual staging because every operator simply waits to mark themselves `ready` until they're satisfied with the current state of *all* the snakes they care about. The Captain's turn-submit override remains as a tie-breaker for stuck or absent teammates. Coaches and admins, being read-only observers (per [08-REQ-052a]), have no ready-state and are never counted in the unanimity condition.

**Affected requirements/design elements**:
- **Module 08**: §8.12 retitled and rewritten ([08-REQ-061]–[08-REQ-064] rewritten; [08-REQ-064a] added for coach/admin no-ready-state); [08-REQ-020] / [08-REQ-022] amended (bot-parameters page no longer exposes operator-mode default or turn-0 time allocation); [08-REQ-032] amended (header presence display now shows per-operator ready-state instead of team-level operator-mode indicator); [08-REQ-034] removed; [08-REQ-052a] disabled-affordances list updated; [08-REQ-065] amended (Captain controls reduced to turn-submit only); [08-REQ-067] / [08-REQ-068] amended (per-operator ready-state is not Captain-only; `operator_ready_toggled` replaces `mode_toggled`); [08-REQ-071] amended (replay's read-only disabled-affordance list); [08-REQ-072] amended (replay reconstructs per-operator ready-state at scrubbed `t`); [08-REQ-086] / [08-REQ-096b] amended (mutating-affordance prohibitions reworded for ready-state).
- **Module 06**: [06-REQ-011] amended to drop `defaultOperatorMode` and `defaultTurn0AutomaticTimeAllocationMs` from `global_centaur_params`; [06-REQ-040a] amended to drop the corresponding game-scoped fields from `game_centaur_state`; [06-REQ-040b] added introducing the `operator_ready_state` table and the `setOperatorReady` mutation; [06-REQ-036] action-log event union amended (`mode_toggled` removed; `operator_ready_toggled` added); §2.1.1, §2.1.5, §2.2.6, §2.4 schemas/contracts updated; `toggleOperatorMode` (§2.2.3) removed and replaced by `setOperatorReady`; exported interfaces (§3.x) amended.
- **Module 07**: 07-REQ-045 amended (separate `turn0AutomaticTimeAllocationMs` carve-out removed; turn 0 uses the same `automaticTimeAllocationMs`, naturally bounded by `remainingTimeBudget` which already encompasses the chess-clock's turn-0 budget); 07-REQ-045a amended re: flush-suppression trigger; §2.13 deadline computation updated for the same turn-0 carve-out removal. 07-REQ-044 (team-level scheduled submission pass), 07-REQ-046 (manual-mode exclusion), and the team-level semantics of `automaticTimeAllocationMs` are unchanged. *(Subsequent corrections: (i) the original Affected entry incorrectly described 07-REQ-044 / 07-REQ-046 as amended and recharacterised `automaticTimeAllocationMs` as a "per-snake auto-submission timer that is no longer team-level" — none of that ever happened in [07]; corrected above. (ii) An interim draft of 07-REQ-045a generalised the flush-suppression trigger to "any turn-over declaration," covering both the Captain's manual button and the all-operators-ready quorum path; that generalisation was an overreach and has been reverted — flush suppression remains Captain-only. 08-REQ-062 and the §8.12 commentary above were also reframed to remove a related false claim that the bot framework's compute queue must be empty as part of the gating precondition.)*
- **Module 05**: [05-REQ-012] (operator-mode toggling) reworded to refer to per-operator ready-state toggling. The `defaultOperatorMode` and `defaultTurn0AutomaticTimeAllocationMs` rows mentioned by the cascade plan never existed in §5.5 / 05-REQ-023 (those fields live exclusively on Module 06's `global_centaur_params`); no parameter-table edits to §5.5 are required.
- **AGENTS.md**: Module 08 status line updated to record the resolution; cascade notes added for Modules 05, 06, 07.

---

### 08-REVIEW-012: Informal spec filename drift — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: Consistent with 02-REVIEW-001, 06-REVIEW-007, 07-REVIEW-010. Requirements in this module were extracted from `team-snek-centaur-platform-spec-v2.2.md`. Resolution is shared with the prior reviews.
**Question**: Confirm v2.2 is canonical. See 02-REVIEW-001.
**Informal spec reference**: N/A (meta).

**Decision**: A — v2.2 is canonical, consistent with the prior resolution of 02-REVIEW-001 (and the parallel resolutions of 06-REVIEW-007 and 07-REVIEW-010).
**Rationale**: Shared with 02-REVIEW-001. The `SPEC-INSTRUCTIONS.md` filename reference to v2.1 is stale; v2.2 is the current informal spec from which this module's requirements were extracted.
**Affected requirements/design elements**: None (meta-question).

---

### 08-REVIEW-013: Who marks a team ready — **RESOLVED**

**Type**: Gap (inherited from 05-REVIEW-007)
**Phase**: Requirements
**Context**: [08-REQ-027f] defers to [05] on which role within a team is permitted to mark the team ready. The informal spec §9.4 says "Captain or any operator", but 05-REVIEW-007 leaves the persistence and scope of readiness unresolved. Until 05-REVIEW-007 is resolved, the UI cannot fully specify its enablement logic.
**Question**: Which roles within an enrolled team may mark the team ready and unmark it?
**Options**:
- A: Captain only.
- B: Captain or any member with the Operator role.
- C: Any current team member regardless of role.
**Informal spec reference**: §9.4 step 3.

**Decision**: A — Captain only.
**Rationale**: This aligns the operator UI's enablement logic with the upstream Captain-only ready-check authorization that [05] already pins via [05-REQ-031] (after the 05-REVIEW-007 resolution). It also preserves the principle that team-level commitments (like declaring readiness for a game) are the Captain's prerogative, consistent with the broader Captain-only scoping established by 08-REVIEW-001 for team-scoped configuration.
**Affected requirements/design elements**: 08-REQ-027f amended (deferral text removed; Captain-only enablement made explicit; non-Captain members see a read-only readiness indicator).

---

### 08-REVIEW-014: Board preview generation locality — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: [08-REQ-027i] describes a miniature board preview that regenerates as the administrative actor edits room configuration parameters. Two questions are underspecified: (a) is the preview generated client-side by running a JavaScript port of the board-construction algorithm owned by [01], or server-side by Convex calling into a shared engine codebase per [02-REQ-035]; (b) does the preview need to be deterministic with a seed such that locking one in ([08-REQ-027j]) reliably reproduces the same layout at game start?
**Question**: Where is the preview generated, and is determinism via seed required for lock-in to work?
**Options**:
- A: Client-side generation using a shared algorithm port; lock-in persists the seed only; [04] honours the seed at game init.
- B: Server-side generation via a Convex action; lock-in persists the server-generated layout directly; [04] honours the layout as a supplied parameter rather than regenerating from a seed.
- C: Client-side generation without lock-in guarantee (the preview is decorative only); lock-in is removed as a feature.
**Informal spec reference**: §8.4 (Room Lobby, Board preview).

**Decision**: Custom — the Convex preview mutation defined by [05-REQ-032b] is the sole authority for generating a board from input parameters. The preview runs `generateBoardAndInitialState()` from the shared engine codebase ([02-REQ-035]) inside a Convex mutation on each parameter edit and is delivered to the web client reactively via Convex's reactive query model. SpacetimeDB never generates a starting board — its `initialize_game` payload always carries the complete pre-computed initial game state plus dynamic gameplay parameters; board-generation parameters are consumed entirely within Convex. The application performs no client-side board generation. This simply ratifies the already-pinned upstream architecture of [05-REQ-022] and [05-REQ-032b] (the "config-on-game" architecture established by 05-REVIEW-008 and the board-generation locality established by Task #8).
**Rationale**: A single source of truth for board generation eliminates client/server determinism concerns, eliminates any need for a JavaScript port of the construction algorithm, and matches the upstream architecture already pinned by [05]. Determinism via persisted seed is therefore moot — the preview is itself the persisted starting state, regenerated on demand by Convex.
**Affected requirements/design elements**: 08-REQ-027i amended (Convex preview mutation is the generator; no client-side board generation; preview delivered reactively). Module-08 sweep performed: only 08-REQ-027i / 027j / 027k mention board preview generation, and they are corrected together with 08-REVIEW-015. Cross-reference: [05-REQ-022] and [05-REQ-032b] are unchanged by this resolution — it ratifies them.

---

### 08-REVIEW-015: Where a locked-in board preview is persisted — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: [08-REQ-027j] says lock-in of a board preview must cause the subsequent game-start orchestration of [05-REQ-032] to seed the game with the locked-in layout. But [05] does not currently have a requirement acknowledging this — [05-REQ-024] talks about parameter snapshots, not generated-content snapshots. A locked-in preview is neither a parameter value nor a derived-from-parameters quantity; it is a concrete board layout that needs to live somewhere in the Convex schema and be plumbed through to [04]'s `initialize_game` reducer.
**Question**: Does the locked-in preview belong in the room record, the next-game's record, or in a separate preview table? And does it extend [05-REQ-032]'s required init payload?
**Options**:
- A: Add a field on the room record holding the currently-locked preview, consumed and cleared at next game-start.
- B: Create the game record eagerly at lock-in time and attach the preview to it.
- C: The locked preview is not persisted at all; it is re-rendered at game-start from a persisted seed and the current parameters.
**Informal spec reference**: §8.4 (Room Lobby, Board preview lock-in); §9.4 (Game Lifecycle).

**Decision**: Custom (essentially Option A scoped to the not-yet-started game record, not the room record). The starting game state always lives on the not-yet-started game record's configuration document, alongside its other configuration parameters. A separate `boardPreviewLocked: boolean` flag on the same game record indicates whether locking is in effect. Every preview generation by [05-REQ-032b] writes the resulting starting state onto the game record, regardless of lock-in status; the flag governs only whether [05-REQ-032] step 2 reuses the persisted state (true) or regenerates from a fresh seed at game-launch initiation (false). When unlocked, the regenerated starting state is not displayed to any participant via the configuration UI — it is only seen by operators after it reaches their Centaur interface via the SpacetimeDB subscription. This extends to the starting game state itself the principle (already pinned by 05-REVIEW-008 and materialised by [05-REQ-022] / [05-REQ-032b]) that all configuration parameters are configured on a not-yet-started game record, never on the room record.
**Rationale**: Keeps configuration on a single document (the game), eliminates a separate preview table, and reduces "lock in" to a single boolean affecting one well-defined behaviour at game-launch initiation. Persisting on every regeneration (rather than only on lock-in) keeps the data shape uniform and makes the unlocked-but-not-yet-started case trivially reactive in the UI.
**Affected requirements/design elements**: 08-REQ-027j amended (explicit semantics of `boardPreviewLocked`; persistence on every regeneration; unlocked regeneration is not surfaced to configuration-mode UI). Cascade to [05]: [05-REQ-032b] amended (every preview generation persists onto the game record; `boardPreviewLocked` flag governs reuse). [05-REQ-032] step 2 amended (conditional on `boardPreviewLocked`, not on "if a preview was locked in").

---

### 08-REVIEW-016: Public vs authenticated-only visibility of profiles and leaderboard — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: The informal spec §8.7 and §8.8 describe Player Profile and Team Profile pages as "public" in one place and as accessible to "any authenticated user" in others. The current draft assumes authentication is required for all platform views ([08-REQ-006]) but this is in tension with the "public" framing. A related question is whether email addresses on Player Profiles should be visible to all authenticated users or only to the profile owner and their team-mates.
**Question**: Are team and player profiles public (accessible without authentication) or authenticated-only? And what is the visibility scope of email addresses on Player Profiles?
**Options**:
- A: Authentication required for all views (current draft of 08-REQ-006). Emails visible to all authenticated users.
- B: Team and player profile pages are public and indexable. Emails hidden except on the user's own profile.
- C: Team profile public, player profile authenticated-only. Emails hidden everywhere except self-view.
**Informal spec reference**: §8.7, §8.8.

**Decision**: A, with one clarification — emails are never exposed to any user query. Authentication is required for all platform views per [08-REQ-006]. User identity surfaced to other authenticated users is the OAuth-provided display name only (per [03] §3.14). Email addresses are stored in Convex (necessary for OAuth identity matching and admin recovery flows) but are not exposed in any user-facing query: not on Player Profile (including the user's own self-view), not on Team Profile, not on team-member listings, not on game-history attributions, and not on leaderboards.
**Rationale**: Minimises PII surface area while preserving the platform's auth-required posture. The user's email is owned by the OAuth provider; the application has no authoritative reason to display it back to the user, and exposing it to other authenticated users (even within a team) is an unnecessary leak. The "public" framing in the informal spec conflates "accessible to any user of the platform" with "accessible to anyone on the internet"; this resolution pins the former.
**Affected requirements/design elements**: 08-REQ-090 amended (deferral removed; explicit auth-only). 08-REQ-091 amended (email removed from Player Profile display). 08-REQ-094 amended (deferral removed; explicit auth-only). 08-REQ-094f amended (deferral removed). 08-REQ-091a added as a new module-08-owned negative requirement: "No application view shall expose any user's email address to any other user, nor to the user themselves" — this constrains [05]'s query surface (no [05] user-scoped query may include email in its returned shape). Downstream impact (recorded as a constraint, not a [05] requirement amendment in this task): [05]'s query layer must enforce 08-REQ-091a; this constraint should be honoured by [05] Phase 2 design and any future [05] query additions.

---

### 08-REVIEW-017: Deleted teams in leaderboards — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: [05-REQ-015a] permits Centaur Team deletion while preserving historical participating-team snapshots. [08-REQ-094e] currently says the leaderboard continues to resolve historical teams via snapshots, implying a deleted team could still appear in leaderboards under its historical identity. This may be undesirable — a team might be deleted because it was created in error, was used for spam, or belonged to a departed user — and the leaderboard may want to hide it. On the other hand, hiding it rewrites historical outcomes.
**Question**: Should deleted Centaur Teams continue to appear in the global leaderboard?
**Options**:
- A: Yes — deleted teams continue to appear under their historical identity; deletion is purely a live-state operation. (Current draft.)
- B: No — deleted teams are excluded from leaderboard listings but remain in per-game history where they participated.
- C: Configurable per leaderboard view with a "include deleted teams" toggle.
**Informal spec reference**: N/A (gap). See also 05-REVIEW-011.

**Decision**: The question is moot — Centaur Teams cannot be deleted. Per [05-REQ-015a] (resolved by 05-REVIEW-011), Centaur Teams are archive-only: archiving hides the team from default listings and prevents new-game enrolment but preserves all live and historical state, and historical game records continue to resolve the team's historical identity for attribution. The leaderboard, which already uses participating-team snapshots per [08-REQ-094e], therefore continues to display the team under its archived identity. Archived teams shall continue to appear in the default leaderboard view, consistent with the principle that archiving is a live-state hide-from-listings action and not a historical-state rewrite (the same pattern as room archiving per [05-REQ-021a]). A future enhancement may add an opt-out filter for archived teams, but it is not required.
**Rationale**: Deletion is not a thing in this platform; the original premise of the question is invalidated by the upstream resolution (05-REVIEW-011). Hiding archived teams from the leaderboard would rewrite historical outcomes; preserving them costs nothing and keeps competitive history intact.
**Affected requirements/design elements**: 08-REQ-094e amended ("deleted" → "archived"; deferral removed; positive statement that archived teams remain in default leaderboard view). 08-REQ-093, 08-REQ-097, 08-REQ-103 incidentally amended in the same sweep ("deleted" → "archived") to enforce platform-wide archive-only terminology. References [05-REQ-015a] / 05-REVIEW-011 as the upstream resolution.

---

### 08-REVIEW-018: Live spectating when invisibility is active — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: [08-REQ-083] says the spectator view honours invisibility filtering per [04-REQ-047] — i.e., invisible snakes simply are not delivered to spectator subscriptions. But the spectator is nonetheless a third-party observer whose scoreboard ([08-REQ-084]) aggregates alive-snake lengths per team. If a team has an invisible snake, the spectator's scoreboard either (a) reflects the reduced visible length (misleading — the snake is still alive), (b) reflects the true aggregate (requires server-side calculation with team privilege, violating the spectator-view data model), or (c) omits the invisible snake from the count while marking the score as "partial." This tension is not addressed by the informal spec.
**Question**: How does the spectator scoreboard handle invisible snakes?
**Options**:
- A: The scoreboard shows only what the spectator subscription delivers; invisible snakes are simply not counted. The spectator experience is intentionally lossy.
- B: The scoreboard shows true aggregates computed server-side using a privileged aggregate query that bypasses per-snake visibility; only aggregates are disclosed, not per-snake state.
- C: The scoreboard distinguishes "visible length" from "total length, some hidden," alerting the spectator that hidden snakes exist on that team.
**Informal spec reference**: §8.5 (Live Spectating); §4.3 (Invisibility potion semantics).

**Decision**: Custom (Option B generalised). Clients are dumb readers of state shared by SpacetimeDB views; they do not compute scores from raw snake data. The spectator scoreboard shall be backed by a dedicated SpacetimeDB scoreboard view that publishes per-team aggregate scores (computed server-side over the true alive-snake set, including invisible snakes) and exposes only the aggregates — never per-snake state for invisible snakes. This is generalised beyond the scoreboard: the broader principle is that client UIs render state delivered by SpacetimeDB views and do not reconstruct game-mechanics quantities (score, length aggregates, win conditions) from raw subscription data they may have an incomplete view of.
**Rationale**: A single server-side authority over score eliminates client/server divergence, eliminates the invisibility leak that would arise from clients aggregating only visible snakes, and aligns with [04-REQ-047]'s server-side filter posture. The per-snake invisibility filter ([08-REQ-083]) remains in force; the scoreboard view is the only server-side aggregate channel and per-snake state is still filtered by visibility.
**Affected requirements/design elements**: 08-REQ-084 amended (scoreboard sourced from a dedicated SpacetimeDB scoreboard view, not client-aggregated; "proxy for team score pending 05-REVIEW-006" parenthetical dropped — score semantics are owned upstream and the client just renders them). 08-REQ-084b added as a negative requirement: the application shall not compute team-level aggregate quantities by aggregating raw per-snake subscription data on the client. 08-REQ-083 unchanged. Downstream impact (recorded as a constraint, not a [04] requirement amendment in this task): [04] Phase 2 design (already drafted, §2.9 / §2.12) must add a scoreboard view to its visibility-filtering / view design; concretely, a `scoreboard_view` per game is needed exposing `(teamId, teamScore, aliveSnakeCount, aggregateLength)` computed over the true snake set, subscribable by spectator and operator clients alike. This is recorded here as a downstream impact for [04] Phase 2 design to address; an accompanying open `04-REVIEW-020` item is filed (see [04]'s REVIEW Items section) so the work is not lost.

---

### 08-REVIEW-019: Timeline scrubber data delivery for long games — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: [08-REQ-087] asserts the spectator timeline scrubber leverages [04-REQ-057] historical reconstruction. [04-REQ-054]'s subscription patterns mention that a client joining mid-game can subscribe to full history. For short games this is fine, but for long games (tournament rounds, extended max-turn games) the initial delivery could be sizable. The question is whether the UI must demand full history up-front on entry to the spectator view or can lazily fetch historical slices as the user scrubs.
**Question**: Does live spectating entry require an up-front full-history subscription, or does the UI fetch historical slices on demand?
**Options**:
- A: Up-front full subscription — simplest client code, possibly slow entry on long games.
- B: Live-only subscription on entry; lazy-fetch historical slices via query only when the user scrubs backward.
- C: Hybrid — subscribe to current turn + a configurable window (e.g., last 20 turns) on entry; lazy-fetch beyond that.
**Informal spec reference**: §8.5 (Live Spectating timeline scrubber); §10 (Client Query Patterns).

**Decision**: A — up-front full-history subscription on entry to the spectator view. Games are bounded to at most a few hundred turns and a few seconds of loading is acceptable for the spectator entry experience (worst case).
**Rationale**: Simplest client implementation, no lazy-fetch state machine, no fallback paths to maintain; the worst-case latency is acceptable per the explicit user tolerance. Lazy fetching would add a moving-window state machine and visibly stutter when the user scrubs to a turn outside the prefetched window — a worse UX in exchange for a small entry-time saving on a small population of unusually long games.
**Affected requirements/design elements**: 08-REQ-087 amended (positive statement that the UI subscribes to the game's full historical state up-front on entry, per [04-REQ-054]'s mid-game-join subscription pattern, accepting bounded entry latency proportional to game length).

---

### 08-REVIEW-020: Game-in-progress discoverability on the home view — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: [08-REQ-010a] says the home view lists "games currently in progress in which any of the user's Centaur Teams are participating." But the spectator affordance is available to *any* authenticated user — users may want to discover interesting games in progress even in rooms they have no team affiliation with. The informal spec §8.1 describes the home view narrowly around memberships and recents, leaving general discovery to the Room Browser. Whether a dedicated "live games" discovery surface is needed is not answered.
**Question**: Should the home view or the Room Browser expose a dedicated listing of all games currently in progress regardless of team affiliation?
**Options**:
- A: Only games involving the user's teams on the home view; no platform-wide live-games listing. (Current draft.)
- B: Add a "live games" section to the home view showing all platform-wide games in progress.
- C: Add a filter to the Room Browser for "rooms with a game in progress."
**Informal spec reference**: §8.1, §8.3.

**Decision**: A — only games involving the user's teams are listed on the home view; no platform-wide live-games discovery surface is added in this revision.
**Rationale**: Matches the current draft and the informal spec §8.1's narrow framing of the home view around memberships and recents; general discovery remains the Room Browser's responsibility (already accessible from the global navigation per [08-REQ-010]). A platform-wide live-games surface can be added later if user behaviour warrants it.
**Affected requirements/design elements**: None — [08-REQ-010a] is left as-is in substance. No "see 08-REVIEW-020" deferral text exists in any requirement (the deferral was confined to the REVIEW item itself), so no body-text amendment is required.

---

### 08-REVIEW-021: Heuristic registry drift between server and team configuration — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: [06-REQ-005] states that heuristic defaults are per-CentaurTeam and that when a team replaces its Centaur Server, the new server inherits the existing heuristic defaults. [08-REQ-058] says the application shall not expose Drives whose types are not registered in the team's heuristic default configuration. However, there is no specification for what happens when the set of heuristic IDs registered in a team's Centaur Server source code diverges from the set of heuristic IDs in the team's `heuristic_config` table. This drift can occur in two directions: (a) the new server introduces heuristic IDs that have no `heuristic_config` entry (new Drives/Preferences added in code), and (b) the team's `heuristic_config` contains entries for heuristic IDs that the new server does not register (stale entries from a previous server). The original draft said stale entries are "ignored at runtime and may be cleaned up by the team" (06-REVIEW-001 resolution) but did not specify how the UI handles this — in particular, whether stale Drives appear in the dropdown, whether new (unconfigured) Drives are accessible, and whether the heuristic configuration page surfaces the mismatch.
**Question**: How should the UI handle heuristic ID mismatches between the running server's registered heuristic set and the team's persisted `heuristic_config`?

**Decision**: The Snek Centaur Server's bot framework ([07] §2.3) defines a build-time-shared TypeScript module `HEURISTIC_REGISTRY: ReadonlyArray<HeuristicRegistration>` that is imported by both the framework runtime and the SvelteKit frontend (this module — they share a workspace package and compile against the same source file at build time). Drift between "what the server can simulate" and "what the UI can render" is therefore structurally impossible within one build artifact.

The frontend's behaviour:

1. **In-game Drive dropdown** ([08-REQ-052]): sources its options from the **intersection** `heuristic_config ∩ HEURISTIC_REGISTRY` filtered to `heuristicType = "drive"`, ordered per [06-REQ-007]'s pinned-then-lexicographic scheme. Drives present in `heuristic_config` but absent from the registry are hidden from the dropdown (stale). Drives present in the registry but absent from `heuristic_config` are also hidden from the dropdown (the lazy-insert below ensures this state does not persist past a Captain visit to the global params page).

2. **Lazy-insert on global centaur params page visit** ([08-REQ-014]): when the Captain visits the global centaur params page, the page calls a new `insertMissingHeuristicConfig({ centaurTeamId, registrations })` mutation on Module 06 (added per [07] §2.19) under the Captain's Convex auth credential. The mutation is **insert-only and never overwrites**: for each registration whose `heuristicId` is not already in the team's `heuristic_config`, it inserts a row using the registry's `defaultWeight`, `activeByDefault`, and `nickname` as initial values; for IDs already present, it does nothing. Once written, `heuristic_config.weight`/`activeByDefault`/`nickname` override the source-code `defaultWeight`/`activeByDefault`/`nickname` (Convex is authoritative).

3. **Stale-entry display on global centaur params page** ([08-REQ-014]): heuristic IDs present in `heuristic_config` but absent from the current registry are visually distinguished as "stale" (e.g., greyed out with a "no longer registered by this server" annotation) and offered a delete affordance that calls `deleteHeuristicConfig`. They are **not** surfaced in the in-game Drive dropdown, only on the global centaur params page where the Captain can see and clean them up.

4. **No framework writes to `heuristic_config`**: the bot framework itself never invokes `insertMissingHeuristicConfig` or any other `heuristic_config` mutation ([07-REQ-018]). The lazy-insert is invoked from this module's frontend under the Captain's credential because the Captain is the trust anchor for changes to team configuration ([06] §2.6; 08-REVIEW-001).

**Rationale**: A build-time-shared TypeScript module eliminates runtime drift at the build-artifact level, requires no new wire protocol, and propagates literal heuristic-ID types end-to-end into the frontend's component props. The lazy-insert pattern (rather than automatic background sync) keeps the Captain in control of when registry defaults become persisted configuration: the Captain's act of visiting the global centaur params page constitutes the consent. Insert-only-never-overwrites preserves Captain-edited values on subsequent registry expansions.

**Affected requirements/design elements**: [07] §2.3, §2.18, §2.19, §3.1, §3.7 added in [07] Phase 2. [06] amended to add the `insertMissingHeuristicConfig` mutation per [07] §2.19. This module's frontend (Phase 2) imports `HEURISTIC_REGISTRY` from the workspace package and wires the lazy-insert call into the global centaur params page load lifecycle.

**Informal spec reference**: §7.1 (heuristic configuration); §7.6 (Drive dropdown).
