# Module 08: Centaur Server Web Application

## Requirements

### 8.1 Scope and Runtime Placement

**08-REQ-001**: This module shall define the behavioural requirements of the web application served to human operators by a Centaur Server ([02-REQ-004], [02-REQ-030]). The application is the team's sole interface for team-internal competitive operation: heuristic configuration, bot parameters, live gameplay, and team replay. Cross-team and platform-level concerns are owned by [09] and shall be out of scope.

**08-REQ-002**: The application shall be served by the Centaur Server runtime to members of the owning Centaur Team. It shall not be served to members of any other team, nor to unauthenticated visitors. (Discharges [02-REQ-049] from the application side.)

**08-REQ-003**: The application shall execute as a browser client that communicates with (a) its own team's Centaur Server runtime for real-time subscriptions to in-memory bot-framework state it does not read directly from Convex, (b) the Convex deployment for reads and mutations against Centaur state ([06]) and platform-wide state ([05]) per [02-REQ-039], and (c) the team's current game's SpacetimeDB instance via admission ticket per [02-REQ-038] when a game is live.

**08-REQ-004** *(negative)*: The application shall not provide user-interface affordances for cross-team or platform-level concerns including room creation, room browsing, platform leaderboards, platform-wide profiles, team identity editing, Centaur Server registration, or team membership management. These are owned by [09] and are restated negatively here to fix the boundary. (Restates [02-REQ-049].)

**08-REQ-005**: The application shall link to the Game Platform ([09]) for navigation to those cross-team concerns it does not itself host. The link target is a design-phase decision but the affordance is required.

---

### 8.2 Authentication and Authorization

**08-REQ-006**: The application shall require Google OAuth authentication of the human using the same human identity type defined in [03]. It shall not maintain its own independent credential store. Unauthenticated requests to any page of the application shall be refused.

**08-REQ-007**: After authentication, the application shall admit the human only if that human is a current member of the Centaur Team owning the Centaur Server that served the application. A human authenticated to the platform but not a member of this team shall be shown an access-denied state and no team-scoped data.

**08-REQ-008**: The application shall gate affordances that are restricted to specific team roles ([05-REQ-011]) — in particular the timekeeper affordances of §8.10 — on the authenticated human's current role as read from [05] via [06]. Role changes observed through the subscription of [06-REQ-043] shall take effect in the UI without requiring the operator to reload the page.

**08-REQ-009** *(negative)*: The application shall never issue a SpacetimeDB admission ticket on its own. Admission tickets for the team's current game are obtained through the Convex-mediated issuance path of [05-REQ-035] and presented to SpacetimeDB by the browser.

---

### 8.3 Navigation and Page Structure

**08-REQ-010**: The application shall provide a top-level navigation surface from which the authenticated operator can reach each of the following pages: heuristic configuration (§8.4), bot parameters (§8.5), game history (§8.6), and — whenever a game in which the team is a participant is in the `playing` status ([05-REQ-027]) — the live operator interface (§8.7).

**08-REQ-011**: When the team has a game in the `playing` status, the navigation surface shall make the live operator interface prominent such that an operator arriving at the application is not required to search the navigation to find the active game.

**08-REQ-012**: The application shall not present a page for live gameplay when the team has no game in the `playing` status. Attempts to navigate to the live interface under those conditions shall be refused with an explanatory empty state.

**08-REQ-013**: Navigating into the team replay viewer shall occur exclusively from the game history page (§8.6). The team replay viewer shall not appear as a standalone top-level navigation target.

---

### 8.4 Heuristic Configuration Page

**08-REQ-014**: The heuristic configuration page shall display every Drive type and every Preference registered with the team's Centaur Server, sourced from the team's heuristic default configuration ([06-REQ-005]) via [06-REQ-032]'s read surface.

**08-REQ-015**: For each registered Preference, the page shall display and allow editing of: (a) whether the Preference is active on new snakes by default and (b) its default portfolio weight ([06-REQ-006]).

**08-REQ-016**: For each registered Drive type, the page shall display and allow editing of: (a) its default portfolio weight when added to a snake and (b) its ordinal position in the Drive dropdown presented during Drive management ([06-REQ-007], §8.9).

**08-REQ-017**: Mutations initiated from this page shall be routed through the Centaur state function contract surface ([06-REQ-030]) and shall be rejected by that surface if the authenticated caller is not a current member of the owning team ([06-REQ-008], [06-REQ-031]). The application shall surface any such rejection to the operator.

**08-REQ-018**: The page shall make explicit to the operator that edits affect defaults for future games only and shall not retroactively affect any game currently in progress ([06-REQ-009]). The concrete UI affordance by which this is communicated is a design-phase decision.

**08-REQ-019** *(negative)*: The heuristic configuration page shall not permit mutations to any per-snake or per-game state. It operates exclusively on team-scoped heuristic defaults. See REVIEW 08-REVIEW-001.

---

### 8.5 Bot Parameters Page

**08-REQ-020**: The bot parameters page shall display and allow editing of the team's bot parameter record ([06-REQ-011]), comprising at minimum: the softmax global temperature, the default operator mode (Centaur or Automatic), the automatic-mode time allocation applied to turns other than turn 0, and the automatic-mode time allocation applied to turn 0.

**08-REQ-021**: Mutations initiated from this page shall be routed through the Centaur state function contract surface ([06-REQ-030]) and rejected if the caller is not a member of the owning team ([06-REQ-012], [06-REQ-031]).

**08-REQ-022**: The page shall make clear to the operator that the default operator mode takes effect on the next game the team enters, not on any game currently in progress. See REVIEW 08-REVIEW-002.

**08-REQ-023** *(negative)*: The bot parameters page shall not expose any parameter that is a game-configuration parameter owned by [05-REQ-023]. Game-configuration parameters are set in the Game Platform's room lobby ([09]).

---

### 8.6 Game History Page

**08-REQ-024**: The game history page shall list completed games in which the authenticated human participated as a member of the owning team, in reverse chronological order.

**08-REQ-025**: Each listing shall display at minimum: room name, date, opponent teams, the team's result (win/loss/draw — subject to resolution of score semantics per [05-REVIEW-006]), and final scores ([05-REQ-038]). Listing data shall be sourced from [05]'s read surface.

**08-REQ-026**: Selecting a listing shall open the team replay viewer (§8.11) for that game. Navigation into the team replay viewer shall not be exposed anywhere else in the application.

**08-REQ-027** *(negative)*: The game history page shall not expose games the authenticated human did not participate in, including games played by other members of the same team before the human joined. See REVIEW 08-REVIEW-003.

---

### 8.7 Live Operator Interface — Principles

**08-REQ-028**: The live operator interface shall default to AI control of all owned snakes. On entry to the interface for a fresh game, every owned snake shall be in automatic mode (`manualMode = false` in its selection record, [06-REQ-018]) and the bot framework shall be staging moves for it per [07-REQ-044].

**08-REQ-029**: Selecting a snake in the interface shall not, by itself, place that snake in manual mode. Selection is a view-only operation that makes the snake the subject of the move interface, Drive management, decision breakdown, and worst-case world preview, but does not remove the snake from the automatic submission pipeline of [07].

**08-REQ-030**: Manual mode for a snake shall be entered exclusively by (a) the currently selecting operator checking the manual checkbox of §8.9 or (b) the currently selecting operator selecting a concrete direction via the move interface, which auto-sets the manual flag as a side effect per [06-REQ-025]. Exiting manual mode shall occur exclusively by that operator unchecking the manual checkbox, returning the snake to automatic mode immediately such that [07]'s submission pipeline resumes staging for it on its next scheduled pass.

**08-REQ-031**: The interface shall reflect [07]'s compute scheduling principle that compute follows attention: automatic-mode snakes receive continuous scheduled compute, currently-selected manual-mode snakes receive high-priority compute, and unselected manual-mode snakes receive compute last ([07-REQ-040]). This requirement is behavioural on [07]; the UI shall not add extra scheduling logic of its own.

---

### 8.8 Live Operator Interface — Header

**08-REQ-032**: The header of the live operator interface shall display at minimum: the current turn number, the team clock countdown, the team's remaining time budget, an indicator of the current operator mode (Centaur or Automatic), the measured network latency to the team's SpacetimeDB instance, a presence display of other operators currently connected to the same game from the same team, and — conditionally, per §8.10 — the timekeeper controls.

**08-REQ-033**: The team clock countdown shall be presented with sufficient precision to convey imminent deadline: the concrete presentation of seconds-to-one-decimal and a warning state below a sub-one-second threshold is the informal spec's proposal and is the minimum required resolution. When the team's turn has been declared over ([01-REQ-039]) the countdown shall be replaced by a "turn submitted" indicator and shall not flicker back to a countdown while the other team(s) finish their declarations.

**08-REQ-034**: The operator-mode indicator shall reflect the current operator mode of the game as recorded in [06]'s selection or mode state. Changes to the mode initiated by the timekeeper (§8.10) shall update the indicator for all connected operators on the team without a page reload, via the subscription of [06-REQ-043].

**08-REQ-035**: The presence display shall show each other currently-connected operator on the team by their display name and a per-operator colour that is stable within the game's lifetime and is the same colour used for that operator's selection shadow on the board (§8.9). See REVIEW 08-REVIEW-004.

**08-REQ-036**: The network latency indicator shall be a client-measured round-trip time against the team's SpacetimeDB subscription and shall not require any new Convex or Centaur-state field to support it. The exact measurement methodology is a design-phase decision.

---

### 8.9 Live Operator Interface — Board Display, Selection, and Move Interface

**08-REQ-037**: The board display shall render the full current board with: grid lines; all terrain types ([01]) including hazard cells and fertile tiles; all items currently on the board (food, invulnerability potions, invisibility potions); all currently-alive snakes with team colour fill, a per-snake letter designation rendered at the head, and the snake's current length rendered at the neck segment.

**08-REQ-038**: The board display shall render snake effect states ([01]) such that an invulnerability level greater than zero is indicated by a distinctive (e.g. blue) outline on the snake and an invulnerability level less than zero by a distinctive (e.g. red) outline, and such that invisibility is indicated by a translucent/shimmer rendering visible to members of the owning team only ([04]'s RLS visibility rules; [01]'s invisibility semantics). The interface shall not reveal invisibility states of snakes belonging to other teams.

**08-REQ-039**: The board display shall render the current selection state ([06-REQ-018]) as a per-snake selection glow in the colour of the operator who holds the selection. Multiple concurrent selections on distinct snakes by distinct operators shall each render in their respective operators' colours.

**08-REQ-040**: The board display shall render, for the currently-selected owned snake, per-direction move candidate highlighting on the four adjacent cells where each candidate cell is coloured by the bot's current stateMap score for that direction (highest score to lowest using a monotone colour ramp). If no stateMap entry is currently defined for a candidate direction ([07-REQ-049]), that candidate shall be rendered in a distinct neutral state that is visually distinguishable from any score value.

**08-REQ-041**: The board display shall render the currently-staged move for each owned snake with a distinctive marker (e.g. purple border) on the destination cell. The marker shall update without page reload as the staged move changes, whether the change originated from the bot's submission pipeline ([07-REQ-044]) or from an operator action on any connected client.

**08-REQ-042**: Snake selection shall be initiated by clicking the body of an owned snake whose selection the caller is eligible to take per [06-REQ-024]. Selection shall be terminated by pressing Escape or by selecting a different snake. Selecting a snake currently selected by a different operator shall present a displacement confirmation that, upon explicit operator confirmation, issues a selection mutation with the displacement flag set ([06-REQ-022]). Without confirmation, the current selection shall remain with its existing holder.

**08-REQ-043** *(negative)*: The application shall not display, construct, or allow interaction with a direction-candidate for a snake the operator does not currently hold a selection on. All move-staging and Drive-management affordances are gated on the caller being the current selector of the snake being acted on ([06-REQ-025]).

**08-REQ-044**: The move interface shall provide four direction buttons (Up, Down, Left, Right), each labelled with that direction's current stateMap score ([07-REQ-035]) and coloured consistently with the board display's candidate highlighting. Each direction button shall be pre-set to reflect the currently-staged direction for the selected snake (whether staged by the bot or by a human), and direction buttons whose direction is immediately lethal ([01-REQ-044a], [01-REQ-044b]) shall be visibly disabled but shall remain selectable as last-resort candidates per [07-REQ-019].

**08-REQ-045**: Selecting a direction — via click on a direction button or via the keyboard arrow keys while the board has focus — shall simultaneously (a) stage that direction in SpacetimeDB via the staged-move mechanism ([02-REQ-011]) as an operator-originated move, (b) auto-set the snake's manual-mode flag to true per [06-REQ-025], and (c) trigger the worst-case world preview of §8.9a for that direction.

**08-REQ-046**: Staged moves shall be freely changeable at any moment before the team's turn is declared over ([01-REQ-039]); the interface shall not expose a separate "commit" action. The operator shall be made aware by affordance design that each direction selection temporarily stages that direction, so that exploring a direction is not distinguishable to the game engine from committing to it until the turn ends.

**08-REQ-047**: The manual checkbox shall be displayed whenever an owned snake is selected, shall reflect the current value of the snake's manual-mode flag ([06-REQ-018]), and shall be editable by the current selector only. Checking the box shall set the flag to true without staging a new move (the currently-staged move, bot or human, is locked). Unchecking the box shall set the flag to false, at which point [07]'s automatic submission pipeline resumes staging for the snake.

---

### 8.9a Live Operator Interface — Worst-Case World Preview

**08-REQ-048**: When an owned snake is selected and a direction is selected (whether via direction button or arrow key), the board display shall additionally render the worst-case simulated world for that (snake, direction) pair, as read from the computed display state of [06-REQ-026]. Current positions of all snakes shall remain rendered solidly and the worst-case simulated positions shall be rendered as translucent overlays.

**08-REQ-049**: Annotations computed against the worst-case world — such as the Voronoi-style territory overlay the informal spec references, and any other team-configured annotations — shall be rendered against the worst-case world rather than against the current board. They shall be sourced from the `annotations` field of the computed display state ([06-REQ-026]).

**08-REQ-050**: The worst-case world preview shall update reactively as the bot framework writes new computed display state snapshots ([07-REQ-039]), so that an operator who leaves a direction selected while compute proceeds sees the worst-case world evolve in place.

**08-REQ-051**: When no direction is selected, or when no computed display state exists yet for the selected snake, the worst-case world preview shall not render and the board shall show only the current board state.

---

### 8.9b Live Operator Interface — Drive Management

**08-REQ-052**: The move interface for a selected snake shall expose a control by which the current selector can add a Drive to that snake. Adding shall present a dropdown of registered Drive types ordered by each type's configured dropdown ordinal ([06-REQ-007]). See REVIEW 08-REVIEW-005.

**08-REQ-053**: Selecting a Drive type from the dropdown shall activate the targeting mode appropriate to that Drive type's target type:
- **Snake targeting**: the board enters a mode in which only those snakes for which the Drive's target-eligibility predicate ([07-REQ-007]) returns true are highlighted as clickable; ineligible snakes are visually dimmed; clicking an eligible snake confirms it as the Drive's target.
- **Cell targeting**: the board enters a mode in which only those cells for which the Drive's target-eligibility predicate returns true are highlighted as clickable; ineligible cells are visually dimmed; clicking an eligible cell confirms it as the Drive's target.

**08-REQ-054**: In either targeting mode, pressing Tab shall cycle the highlighted candidate target through eligible targets in order of A*-distance from the selected snake's head, nearest first. Pressing Escape shall cancel targeting without adding the Drive and shall not alter the snake's selection state. See REVIEW 08-REVIEW-006.

**08-REQ-055**: Confirmation of a target shall cause the Drive to be added to the snake's portfolio at that Drive type's default weight via [06-REQ-015]. No additional operator confirmation beyond the target click shall be required.

**08-REQ-056**: Active Drives on the selected snake shall be listed in the snake's control panel, each showing the Drive type, the target, the current portfolio weight, an editable weight control, and a remove affordance. Weight edits and removals shall take effect immediately via [06-REQ-015]; the framework shall react per [07-REQ-015].

**08-REQ-057**: Drive assignments, weight overrides, activation overrides, and the per-snake temperature override shall persist across turns and across deselection, per [06-REQ-016]. The interface shall not reset any of these fields as a side effect of selection changes or turn transitions.

**08-REQ-058** *(negative)*: The application shall not provide an affordance to add Drives whose types are not registered in the team's heuristic default configuration ([06-REQ-005]). Drive type registration is a code-level concern of the team's Centaur Server library usage, not a runtime UI affordance.

---

### 8.9c Live Operator Interface — Decision Breakdown Table

**08-REQ-059**: The interface shall render, for the currently-selected owned snake, a per-direction decision breakdown table showing one row per heuristic (Drive or Preference) active on that snake. Each row shall display at minimum: the heuristic's name, its raw normalised output in the worst-case world ([06-REQ-026]'s `heuristicOutputs` field), its current portfolio weight, its weighted contribution to the direction's score, and its relative impact on the direction's total score.

**08-REQ-060**: The decision breakdown shall update reactively as computed display state snapshots are written by the framework and as the operator switches which direction is selected.

---

### 8.9d Live Operator Interface — Operator Mode and Turn Submission

**08-REQ-061**: The live operator interface shall operate under one of two operator modes — Centaur or Automatic — at any given moment during a game. The mode is a property of the team's game session as a whole, not of individual snakes or operators.

**08-REQ-062**: In Automatic mode, the Centaur Server shall declare the team's turn over ([01-REQ-039]) at the sooner of (a) the bot-framework's compute queue being cleared for all owned snakes and (b) the configured automatic-mode time allocation from bot parameters ([06-REQ-011]) elapsing within the current turn. Operator interactions — selection, Drive edits, manual overrides — shall remain possible during this window but shall not pause or extend the automatic declaration timer. A separate turn-0 time allocation ([06-REQ-011]) shall govern the Automatic-mode submission timer on turn 0 only.

**08-REQ-063**: In Centaur mode, the Centaur Server shall not declare the team's turn over except on explicit action from the timekeeper (§8.10) or on expiry of the team's per-turn clock / time budget ([01-REQ-037], [01-REQ-038]). In this mode, the team's time budget is spent into at human time scale, enabling strategically significant decisions at human pace.

**08-REQ-064**: The initial operator mode of each game shall be read from the team's bot parameter record ([06-REQ-011]) as the default operator mode at the moment the game transitions to `playing`.

---

### 8.10 Timekeeper Controls

**08-REQ-065**: When the authenticated human is the current timekeeper of the team ([05-REQ-011]), the header of the live operator interface shall expose two timekeeper affordances: (a) an operator-mode toggle that switches between Centaur and Automatic mode, and (b) a turn-submit action that immediately declares the team's turn over ([01-REQ-039]) regardless of the current operator mode, submitting all currently-staged moves.

**08-REQ-066**: Timekeeper affordances shall additionally be bindable to keyboard shortcuts so the timekeeper can operate them without pointer input. The specific key bindings are a design-phase decision.

**08-REQ-067** *(negative)*: Operators who are not the current timekeeper shall not see the timekeeper affordances, and any attempt to invoke them — including via keyboard shortcut — shall be rejected by [06]'s function contract surface per [06-REQ-031] even if it reaches the mutation layer. See REVIEW 08-REVIEW-007.

**08-REQ-068**: Operator-mode toggles issued by the timekeeper shall produce a `mode_toggled` entry in the action log ([06-REQ-036]). Turn submissions issued by the timekeeper shall produce the team-side turn-submission event category of [06-REQ-036].

---

### 8.11 Team Replay Viewer

**08-REQ-069**: The team replay viewer shall present a completed game to the logged-in human through the same UI components as the live operator interface (§§8.7–8.9d), rendered in a read-only mode in which all mutating affordances — move staging, Drive add/remove/edit, manual-mode toggling, operator-mode toggling, turn submission — are disabled, while all state-inspection affordances — snake selection, direction preview, worst-case world preview, decision breakdown table — remain fully functional.

**08-REQ-070**: The team replay viewer shall be available exclusively for games whose status is `finished` ([05-REQ-027]) and in which the logged-in human participated as a team member, and shall be navigated to only from the game history page per [08-REQ-026].

**08-REQ-071**: The team replay viewer shall expose a timeline scrubber that operates at sub-turn temporal resolution. The scrubber shall be accompanied by play/pause and variable-speed-playback affordances. At any scrubber position `t` the viewer shall display the team's reconstructed experience at clock time `t` including: which snake each operator had selected at that moment, each snake's manual-mode flag, each snake's active Drives and their targets and weights, each snake's per-direction stateMap and worst-case world and annotations and heuristic outputs, the current operator mode, the staged moves for each snake and the identity that staged them, and temperature overrides in effect. This reconstruction is the union of [05-REQ-040]'s persisted replay and [06-REQ-035]'s action log.

**08-REQ-072**: Historical operator selections shall be rendered during replay as coloured shadows on the appropriate snakes using the same per-operator colours used in live play. An operator who was not connected at a given historical moment shall not produce a shadow for that moment.

**08-REQ-073**: The team replay viewer shall permit the logged-in human to select a snake for inspection at the scrubbed timestamp. Replay-mode selection shall not produce any selection shadow on the board and shall not issue any Centaur state mutation — the replay viewer acts as an invisible additional observer. Historical operator shadows reconstructed from the action log shall continue to be displayed alongside the invisible replay selection. See REVIEW 08-REVIEW-008.

**08-REQ-074**: The replay viewer shall permit inspection of any snake on the owning team at any scrubbed moment regardless of which operator (if any) had that snake selected at that moment in the original game.

**08-REQ-075** *(negative)*: The team replay viewer shall not display, reconstruct, or expose any state belonging to opposing teams beyond what was visible through [04]'s RLS rules to the owning team at the original time of play. In particular, any opposing snake that was invisible to the owning team at a given historical moment shall remain invisible in replay at that moment.

---

### 8.12 Data Source Abstraction

**08-REQ-076**: The application shall implement a data-source abstraction under which the UI components of §§8.7–8.9d read board state, turn number, staged moves, chess-timer state, and computed display state through a uniform interface that the live mode binds to the current game's SpacetimeDB subscription and the current team's Centaur state subscription ([06-REQ-043]), and that the replay mode binds to the persisted replay and action log read from Convex ([05-REQ-040], [06-REQ-035]).

**08-REQ-077**: A UI component of the live operator interface shall not be required to distinguish whether it is rendering live or replayed state. Read-only enforcement in replay mode shall be accomplished by the data-source abstraction refusing mutation operations, not by each UI component implementing a read-only branch of its own.

**08-REQ-078** *(negative)*: The data-source abstraction shall not expose a mutation surface at all in replay mode. Attempts to invoke a mutation through a replay-mode data source shall fail without side effect.

---

### 8.13 Extension Surface

**08-REQ-079**: The application shall be delivered as the reference implementation portion of the Centaur Server library ([02-REQ-030]). Teams shall be permitted to customise the application under the bounded extension surface of [02-REQ-032(c)]: custom Drive implementations, custom Preference implementations, and optional customisation of the operator web application itself. No customisation shall relax any of the invariants stated in this module or in [06].

**08-REQ-080** *(negative)*: No customisation of the application shall be relied upon for any security or correctness invariant, per [02-REQ-033]. All invariants that constrain Centaur-state mutations shall remain enforced by [06]'s function contract surface regardless of what a customised application chooses to present or hide. See REVIEW 08-REVIEW-009.

---

### 8.14 Lifecycle and Session Boundaries

**08-REQ-081**: The application's live operator interface shall become available on the team's navigation for a given game at the moment that game transitions to `playing` ([05-REQ-028]) and shall remain available until that game transitions to `finished`.

**08-REQ-082**: On a game transitioning to `finished`, the live operator interface shall be replaced for connected operators by a terminal state indicator that surfaces the final scores ([05-REQ-038]) and a link to open the same game in the team replay viewer. The terminal state shall not offer any mutating affordances.

**08-REQ-083**: When the application loses its subscription to either SpacetimeDB or Convex, it shall surface the loss to the operator and shall not fabricate missing state from stale caches. On recovery, the application shall resubscribe and resume rendering from fresh state.

**08-REQ-084** *(negative)*: The application shall not persist any authoritative state of its own across sessions. All operator-visible state is derived from [04], [05], or [06] on each session, consistent with [07-REQ-057]'s posture for the framework.

---

## REVIEW Items

### 08-REVIEW-001: Role gating of heuristic configuration and bot parameters

**Type**: Ambiguity
**Context**: Informal spec §7.1 and §7.2 both say the heuristic config and bot parameters are "editable by any team member". §8.2 separately says team identity, server registration, and membership are captain-only — an explicit distinction that implies team-internal competitive configuration is deliberately not captain-only. [06-REQ-008] and [06-REQ-012] echo this by requiring only that the caller be a team member. This is a plausible reading but is surprising: a new operator could, immediately upon being added to the team, change the team's global heuristic defaults in ways that affect subsequent games for everyone. No mechanism in the current draft provides a safeguard.
**Question**: Should the heuristic configuration page and the bot parameters page be gated on a role (captain, timekeeper) rather than general team membership?
**Options**:
- A: Any team member can edit. (Current draft, matches informal spec literally.)
- B: Captain-only for both pages.
- C: Captain-or-timekeeper for both pages.
- D: Page is read-only to general members; an "edit mode" affordance requires the captain to promote.
**Informal spec reference**: §7.1, §7.2, §8.2.

---

### 08-REVIEW-002: Mid-game effect of default-operator-mode edits

**Type**: Gap
**Context**: 08-REQ-022 says the default operator mode affects only future games, since the running game's mode is owned by the session's in-memory state and toggled by the timekeeper. But [06-REQ-011] treats the default operator mode as a team-scoped record and [06-REQ-009] says team-scoped edits do not retroactively affect in-progress games' portfolio state — that rule addresses heuristic config, not the operator mode. A strict reading of [06] leaves the mid-game behaviour of a default-operator-mode edit undefined.
**Question**: Does editing the default operator mode during a game affect the running game's current mode, the next game only, or neither (treated as a no-op until the next game starts)?
**Options**:
- A: Edit takes effect only on the next game's initial mode; running game is unaffected. (Current draft.)
- B: Edit takes effect immediately — the running game's current mode is reset to the new default.
- C: Edit is silently blocked while the team has a game in `playing` status.
**Informal spec reference**: §7.2.

---

### 08-REVIEW-003: Game history visibility scope

**Type**: Gap
**Context**: 08-REQ-024 and 08-REQ-027 currently restrict the game history list to games the authenticated human participated in. Informal spec §7.3 says "completed games the logged-in user participated in", which supports this. But a coach or captain may want to review all of the team's past games regardless of personal participation. The informal spec does not contemplate this and the draft takes the narrow reading.
**Question**: Should the game history list show (a) only games the current human participated in, (b) all of the team's games, or (c) both with a toggle?
**Options**:
- A: Personal participation only. (Current draft.)
- B: All team games.
- C: Personal by default, toggle to show all.
**Informal spec reference**: §7.3.

---

### 08-REVIEW-004: Presence state store

**Type**: Gap
**Context**: 08-REQ-032 and 08-REQ-035 require a presence display of other connected team operators in the header. Neither [05] nor [06] defines a presence state field, and [06-REQ-018]'s selection record encodes only the current selector of a snake, not the set of connected operators who are unselected. A plausible implementation is that the Centaur Server runtime itself holds presence state and serves it over its own subscription (outside Convex), but no module currently defines this contract. See 08-REQ-003 which already acknowledges the Centaur Server as a source for in-memory bot-framework state the browser reads directly; presence likely rides the same channel. Requires explicit specification somewhere.
**Question**: Where does operator presence state live, and which module owns its specification?
**Options**:
- A: Centaur Server in-memory state exposed to the browser via a Centaur-Server-hosted subscription. Requires [02] to acknowledge this subscription exists, and [08] to specify its shape.
- B: Convex ephemeral presence table owned by [06], with TTL-based cleanup.
- C: Derived from selection state only — "connected" means "has ever held a selection this session". Loses unselected-operator visibility.
**Informal spec reference**: §7.5 ("Connected operators shown as coloured dots with nicknames").

---

### 08-REVIEW-005: Drive dropdown ordinal collisions

**Type**: Gap
**Context**: [06-REQ-007] says each Drive type has an ordinal dropdown position, and 08-REQ-052 orders the dropdown by that ordinal. Nothing in either module prevents two Drive types from having the same ordinal. In that case the ordering is underspecified; tiebreak behaviour could be alphabetic, insertion order, or stable-by-id. This matters because operators rely on the dropdown position as muscle-memory shorthand.
**Question**: What is the tiebreak when two Drive types have the same ordinal?
**Options**:
- A: Secondary sort by Drive type name (alphabetical). Stable and predictable.
- B: Secondary sort by Drive type registration order.
- C: Enforce uniqueness of ordinals in the heuristic config contract ([06-REQ-007]).
**Informal spec reference**: §7.6.

---

### 08-REVIEW-006: Tab cycle deterministic tie-break in targeting

**Type**: Gap
**Context**: 08-REQ-054 orders Tab-cycled targeting candidates by A*-distance from the selected snake's head. Two candidate targets may be equidistant; the order they are visited by Tab is then undefined. As with the dropdown, this matters because operators come to rely on specific sequences during rapid play.
**Question**: What is the tiebreak when two candidate targets have equal A* distance?
**Options**:
- A: Secondary sort by target identity (snake id or cell coordinates in row-major order).
- B: Secondary sort by angle from the snake's head in a fixed rotation direction.
- C: Leave undefined; the operator must click directly if Tab produces ambiguity.
**Informal spec reference**: §7.6 ("in order of A* distance from the snake's head").

---

### 08-REVIEW-007: Timekeeper affordance availability when no timekeeper is assigned

**Type**: Gap
**Context**: [05-REQ-011] says a team has at most one timekeeper at any time, implying the role may be absent. 08-REQ-065 and 08-REQ-067 say only the current timekeeper sees and can invoke the affordances. If no timekeeper is assigned, no member of the team can submit the turn in Centaur mode, and the game can only end by clock expiry. This is possibly intentional (a team that fails to assign a timekeeper is accepting that consequence) but is worth confirming.
**Question**: When a team has no timekeeper, who — if anyone — can invoke the mode toggle and turn-submit affordances?
**Options**:
- A: No-one. Centaur-mode games proceed only until clock expiry. (Current draft.)
- B: The captain acquires the affordances as a fallback.
- C: Any team member acquires the affordances as a fallback.
- D: The team is blocked from entering Centaur mode at all if no timekeeper is assigned.
**Informal spec reference**: §7.5 ("Timekeeper controls (visible only to the designated timekeeper)"); §8.2.

---

### 08-REVIEW-008: Replay-mode selection and Centaur state

**Type**: Ambiguity
**Context**: 08-REQ-073 asserts that replay-mode selection is a local UI concept that does not issue any Centaur state mutation. [06-REQ-018] defines the selection record as a per-(game, snake) Convex row. The replay viewer reads, but does not write, Centaur state. This is straightforward for the "invisible observer" reading but leaves one ambiguity: if two humans open replays of the same game simultaneously and each inspects a different snake, both can be inspecting different snakes without conflict (since neither writes). But if the team replay viewer in the future is extended to support shared replay sessions where multiple people see each other's positions, that extension would require either a new replay-selection record or a reuse of the selection record with a "replay selector" flag. The current draft does not contemplate shared replay sessions; this is a forward-compatibility concern.
**Question**: Confirm that replay-mode selection is purely client-local and does not require any additional Convex state.
**Options**:
- A: Purely client-local; no Convex state. (Current draft.)
- B: Add a replay-scoped selection record to [06] for future shared replay sessions.
**Informal spec reference**: §13.3 ("The replay viewer acts as an invisible additional observer").

---

### 08-REVIEW-009: Scope of application customisation

**Type**: Gap
**Context**: [02-REQ-032(c)] permits "optional customization of the operator web application" as one of three extension points. Neither [02] nor [08]'s draft specifies what "customisation" means concretely: can a team replace entire pages? Inject arbitrary UI? Swap out the move interface? Override the board renderer? The boundary matters because aggressive customisation could present the operator with affordances inconsistent with [06]'s invariants even though those invariants remain enforced server-side. That is acceptable from a correctness standpoint per [02-REQ-033] / 08-REQ-080, but could be a poor user experience and might be worth bounding.
**Question**: What is the intended scope of customisation — theming only, component swapping, or full page replacement?
**Options**:
- A: Theming and layout tweaks only. Functional components are fixed.
- B: Component-level swapping with a stable component contract; functional boundaries preserved.
- C: Full page replacement; only the data-source abstraction (§8.12) and [06]'s function contracts are load-bearing.
**Informal spec reference**: §7 ("The Centaur Server library provides a reference implementation of the full web application; teams may customise the UI.").

---

### 08-REVIEW-010: Speed-control set in team replay viewer

**Type**: Proposed Addition
**Context**: The informal spec §13.3 mentions that the team replay viewer has "play/pause, and speed controls", without enumerating a speed set. Informal spec §8.6 enumerates `{0.5×, 1×, 2×, 4×}` for the platform replay viewer ([09]). The draft of [08] leaves the specific speed set to design, but if consistency across the two replay viewers matters, it should be pinned now as a cross-module contract.
**Question**: Should [08]'s team replay viewer use the same speed set as [09]'s platform replay viewer, and if so, pin it now?
**Options**:
- A: Leave to Phase 2 design; do not pin. (Current draft.)
- B: Pin `{0.5×, 1×, 2×, 4×}` for consistency with [09].
- C: Team replay requires finer-grained control — different set.
**Informal spec reference**: §8.6; §13.3.

---

### 08-REVIEW-011: Interaction between automatic-mode timer and manual overrides mid-turn

**Type**: Ambiguity
**Context**: 08-REQ-062 says the Automatic-mode timer proceeds independently of operator UI interactions. But [07-REQ-046] says manual-mode snakes are never auto-staged. If during an Automatic-mode turn an operator flips several snakes to manual mode and stages human moves for them, and then the Automatic timer fires, is the team's turn declared over with those human moves in place and the remaining automatic snakes' latest bot-staged moves? Informal spec §7.5 implies yes ("submitting all currently staged moves"). The requirements currently omit this detail.
**Question**: On Automatic-mode timer expiry, does the turn-over declaration submit exactly the current staged moves for all owned snakes (mix of bot and human staging), or does it require all automatic-mode snakes to have a bot-staged move before firing?
**Options**:
- A: Declare turn over with whatever is currently staged. (Informal spec §7.5 reading.)
- B: Wait for [07]'s final-submission pass to flush all automatic-mode dirty flags before declaring.
- C: Combine: the timer expiry triggers [07]'s final pass synchronously, then declares.
**Informal spec reference**: §7.5 (header "Timekeeper controls — Submit shortcut key: immediately declares the team's turn over, submitting all currently staged moves").

---

### 08-REVIEW-012: Informal spec filename drift

**Type**: Ambiguity
**Context**: Consistent with 02-REVIEW-001, 06-REVIEW-007, 07-REVIEW-010. Requirements in this module were extracted from `team-snek-centaur-platform-spec-v2.2.md`. Resolution is shared with the prior reviews.
**Question**: Confirm v2.2 is canonical. See 02-REVIEW-001.
**Informal spec reference**: N/A (meta).
