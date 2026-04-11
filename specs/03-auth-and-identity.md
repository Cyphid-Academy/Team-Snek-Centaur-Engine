# Module 03: Authentication & Identity

## Requirements

### 3.1 Identity Model

**03-REQ-001**: The platform shall recognize exactly two kinds of persistent identity: **human identities** and **Centaur Team identities**. A third kind of identity, **game-participant identities**, shall exist as derived identities scoped to individual games. Every authenticated actor on the platform shall hold one of these identity kinds, and no other kinds shall exist.

**03-REQ-002**: A **human identity** shall represent an individual natural person who holds a Google account. Human identities shall be uniquely identified by the email address associated with that Google account. (See resolved 03-REVIEW-002 and 03-REVIEW-003.)

**03-REQ-003**: A **Centaur Team identity** shall represent one registered Centaur Team and shall be uniquely identified by a platform-assigned ID. A Centaur Team identity is the persistent competitive unit on the platform. A Centaur Team has a nominated Snek Centaur Server domain ([02-REQ-005]), but the server domain is a configuration field, not an identity element — changing the domain does not create a new Centaur Team identity.

**03-REQ-004**: A **game-participant identity** shall represent a single authenticated connection to a specific SpacetimeDB game instance for a specific team in one of three roles: **human participant**, **bot participant**, or **spectator participant**. Human participant identities are derived from a human identity. Bot participant identities are derived from a Centaur Team identity (via the per-Centaur-Team game credential held by the Snek Centaur Server). Spectator participant identities are derived from a human identity.

**03-REQ-005**: Human and Centaur Team identities shall be distinguishable from one another wherever they are observed by platform code. No platform code path shall be obligated to handle an identity whose kind is ambiguous.

**03-REQ-006** *(negative)*: The platform shall not support anonymous or unauthenticated participants in any role that stages moves, modifies game state, or modifies Centaur subsystem state.

**03-REQ-049** *(negative)*: "Centaur Server identity" is eliminated as a platform identity type. Snek Centaur Servers have no persistent identity on the platform. A server domain is a string field on a Centaur Team record, not an identity. A Snek Centaur Server receives credentials only when invited to host a game, and those credentials are scoped to a Centaur Team and a game, not to the server itself.

---

### 3.2 Human Authentication

**03-REQ-007**: Human identities shall be established through Google OAuth integrated with the Convex platform runtime. Establishing a human identity shall produce a persistent Convex session that survives across browser page loads until the session is explicitly revoked or expires. (See resolved 03-REVIEW-002.)

**03-REQ-008**: The platform shall identify a human by the email address associated with their Google account. Any two successful Google OAuth authentications that yield the same email address shall be treated as the same human identity, irrespective of other provider-side attributes such as the OAuth subject claim. A change to the email address of a Google account at the provider shall have the effect of creating a new, distinct human identity on the platform; the prior email's identity shall remain attached to its historical state and shall not be migrated. (See resolved 03-REVIEW-003.)

**03-REQ-009** *(negative)*: The platform shall not store passwords, password hashes, or any shared secret that would permit direct authentication of a human without Google OAuth.

**03-REQ-010**: Human authentication shall be a prerequisite for every affordance the Snek Centaur Server web application ([08]) offers that reads or writes user-scoped state, with the sole exception of public read-only views whose scope is specified in [08].

---

### 3.3 Game-Start Invitation Flow

**03-REQ-050**: When a game transitions from `not-started` to `playing`, Convex shall initiate the game-start sequence. After freezing configuration and provisioning the SpacetimeDB instance, Convex shall send a **game invitation** to each participating Centaur Team's nominated Snek Centaur Server domain.

**03-REQ-051**: The game invitation shall be delivered via HTTP POST to a well-known endpoint on the nominated domain (e.g., `POST /.well-known/snek-game-invite`).

**03-REQ-052**: DNS shall be treated as sufficient proof of domain ownership for inbound invitation delivery. Convex is sending TO the domain, not receiving credentials FROM it, so no challenge is needed. The security property is: only the legitimate operator of the domain receives the POST.

**03-REQ-053**: The invitation payload shall contain a per-Centaur-Team game credential sufficient for the Snek Centaur Server to: (a) write to Convex on behalf of that Centaur Team (centaur subsystem state, action log), and (b) obtain SpacetimeDB admission tickets for that Centaur Team's bot participant connection.

**03-REQ-054**: The Snek Centaur Server must **accept** the invitation for the game to proceed. The reference implementation shall auto-accept all invitations by default.

**03-REQ-055**: Custom Snek Centaur Servers may **reject** invitations. The reference implementation shall include a server-side configuration file that allows whitelisting by player email or Centaur Team ID. The default configuration shall have no restrictions (accept all).

**03-REQ-056**: If any participating Centaur Team's nominated server rejects the invitation or fails to respond within a timeout, the game start shall fail. The game shall return to `not-started` with an error indicating which server(s) declined or timed out.

**03-REQ-012** *(negative)*: The platform shall not store, exchange, or transmit a shared secret between the platform runtime and a Snek Centaur Server at any point during the server nomination process. Secrets are delivered only via game invitations at game start.

---

### 3.4 Per-Centaur-Team Game Credential

**03-REQ-057**: A per-Centaur-Team game credential shall be scoped to exactly one Centaur Team and one game. A credential issued for Centaur Team A in game X shall not grant access to Centaur Team B's state, nor to any other game's state.

**03-REQ-058**: The lifetime of a per-Centaur-Team game credential shall be bounded to the game — it shall expire when the game ends or shortly after.

**03-REQ-059**: A per-Centaur-Team game credential shall grant the holder:
- (a) Write access to Convex for that Centaur Team's centaur subsystem state only (snake config, drives, action log entries).
- (b) The ability to request SpacetimeDB admission tickets for that Centaur Team's bot participant role.

**03-REQ-016** *(negative)*: A per-Centaur-Team game credential shall not be transferable: possession of a credential issued to Centaur Team A shall not grant any access to Centaur Team B's state.

**03-REQ-017**: When presented with a per-Centaur-Team game credential, the Convex platform runtime shall be able to resolve the calling identity to the specific Centaur Team the credential was issued for, and shall expose the identity kind (Centaur Team game credential rather than human) to function code that observes the authenticated identity.

---

### 3.5 Admin Role

**03-REQ-060**: The platform shall support an **admin** role as a platform-level (Convex-side) concept. Admin is not a per-server concept.

**03-REQ-061**: Admin users shall be able to browse ALL Centaur Teams, not just ones they belong to.

**03-REQ-062**: Admin users shall be able to see ALL games in history pages across all Centaur Teams.

**03-REQ-063**: Admin users shall be able to watch ANY replay, including within-turn actions of any Centaur Team, regardless of game privacy settings.

**03-REQ-064**: How admin accounts are designated (e.g., a list of Google emails in Convex configuration, a database flag) is a design-phase decision, but the requirement that the role exists and has these capabilities must be stated.

---

### 3.6 Read-Access Principle

**03-REQ-065**: A user's read access to Convex data shall be determined entirely by their Google identity, with no conditioning on which Snek Centaur Server they are visiting.

**03-REQ-066**: Any Snek Centaur Server serves the same platform UI and the user sees the same data regardless of which server they visit. The Snek Centaur Server is an open-source client to Convex.

**03-REQ-067**: The platform specification shall explicitly state the trust implication: a malicious Snek Centaur Server could inject client-side code that exfiltrates the user's Convex-readable data. This is an accepted trust trade-off — users should only log into servers they trust, similar to any web application.

---

### 3.7 SpacetimeDB Admission Tickets

**03-REQ-019**: Admission of any connection to a SpacetimeDB game instance shall be mediated by a cryptographically signed **admission ticket** issued by the Convex platform runtime. The SpacetimeDB game instance shall not accept gameplay connections on any other basis.

**03-REQ-020**: An admission ticket shall carry, at minimum, the following information:
- (a) the identifier of the game instance for which admission is granted;
- (b) the identifier of the Centaur Team on whose behalf the connection is acting (except for spectator tickets, per 03-REQ-026);
- (c) the role of the connection: **human participant**, **bot participant**, or **spectator**;
- (d) for human participants, the email address identifying the human;
- (e) an expiry time beyond which the ticket shall not be accepted.

**03-REQ-021**: The SpacetimeDB game instance shall validate each presented admission ticket by verifying a signature against a secret shared between the Convex runtime and that specific SpacetimeDB instance. A successfully validated ticket shall cause the SpacetimeDB instance to associate that connection with the team and role asserted by the ticket. Admission ticket validation shall occur only at the moment of connection registration; the team and role association established at admission shall persist for the lifetime of that connection without further ticket re-checks, and subsequent expiry of the admission ticket shall not cause an already-admitted connection to be disconnected.

**03-REQ-022**: The admission-ticket validation secret shall be unique per SpacetimeDB instance and shall be provisioned into the SpacetimeDB instance at game initialization time, before any connection is accepted. No admission-ticket validation secret shall be shared across distinct game instances.

**03-REQ-023**: The SpacetimeDB game instance shall reject any admission ticket that:
- (a) fails signature verification against the instance's admission secret;
- (b) names a different game instance than the receiving instance;
- (c) is presented after its expiry time;
- (d) names a team that is not registered as a participant of this game instance;
- (e) for human participants, names an email address that is not listed among the team's authorized members for this game instance.

**03-REQ-024**: Human participants shall obtain admission tickets by calling a Convex endpoint authenticated by their human identity. The Convex runtime shall refuse to issue a human admission ticket unless the requesting human is, at the moment of the request, a member of a team registered to the target game.

**03-REQ-025**: Bot participants shall obtain admission tickets by calling the same class of Convex endpoint authenticated by a per-Centaur-Team game credential. The Convex runtime shall refuse to issue a bot admission ticket unless the game credential is valid and the credential's Centaur Team is registered to the target game.

**03-REQ-026**: **Spectator admission tickets** shall be issuable by the Convex runtime to any authenticated human identity that requests to spectate a game, subject to any spectator eligibility rules owned by [08]. Spectator admission tickets shall carry the spectator role, shall not carry a team binding, and shall confer no move-staging privilege. They shall otherwise share the ticket format defined in 03-REQ-020.

**03-REQ-027**: Admission tickets for all roles (human participant, bot participant, spectator) shall have a lifetime of **15 minutes** from issuance. A ticket holder shall be able to obtain a replacement ticket before expiry without re-authenticating with Google OAuth (for humans) or re-obtaining a game credential (for bot participants), provided the underlying identity's credential is still valid. Because admission tickets are validated only at connection registration ([03-REQ-021]), the 15-minute lifetime governs the window within which a ticket can be used to establish or re-establish a connection — including reconnection after a network interruption during a game — and does not bound the lifetime of an already-admitted connection. (See resolved 03-REVIEW-004.)

---

### 3.8 Authorization Semantics Inside a Game

**03-REQ-028**: A connection admitted to a SpacetimeDB game instance as a **human participant** for team T or as a **bot participant** for team T shall be authorized to stage moves for any snake belonging to team T, subject to [02-REQ-011] and the turn-resolution semantics of [01]. Staging discipline shall be determined by last-write-wins within the SpacetimeDB instance.

**03-REQ-029** *(negative)*: A connection admitted to a SpacetimeDB game instance shall not be authorized to stage, alter, or observe in a non-filtered manner any state belonging to a team other than the team it was admitted for, and spectators shall not be authorized to stage, alter, or observe-through-filtering any team's private state.

**03-REQ-030** *(negative)*: The SpacetimeDB game instance shall not be authoritative for, or hold any record of, which specific human within a team is operating which snake. Selection discipline ([02-REQ-018]) is enforced outside SpacetimeDB.

**03-REQ-031**: The SpacetimeDB game instance shall subject every admitted connection — including bot participants, human participants, and spectators — to the invisibility filter of [02-REQ-010] whenever the connection does not belong to the snake's owning team. Spectator connections shall be filtered on the same terms as opponent connections.

**03-REQ-032**: Each staged move recorded in the game's turn log (per [04], informal spec Section 14) shall carry a `stagedBy` attribution. Within the SpacetimeDB game instance, `stagedBy` shall hold an opaque SpacetimeDB connection Identity — the Identity of the connection that most recently wrote the move. SpacetimeDB turn-resolution logic shall not read, interpret, or branch on this Identity, consistent with [02-REQ-030]. (See resolved 03-REVIEW-005.)

**03-REQ-044**: The SpacetimeDB game instance shall maintain, in the `team_permissions` entries seeded by the `register` reducer from admission-ticket contents, a mapping sufficient to resolve any Identity recorded in any `stagedBy` field to one of the following two forms: (a) the email address of a human participant, or (b) a reference designating the bot participant of a specific participating Centaur Team. This mapping shall be retained for the full duration of the game — including for Identities of connections that have since been closed or replaced by reconnection — so that historical `stagedBy` values remain resolvable at game end. (See resolved 03-REVIEW-005.)

**03-REQ-045**: When Convex persists the game record from the SpacetimeDB game instance at game end (per [02-REQ-022]), each `stagedBy` value in the serialized record shall be resolved to its Convex-interpretable form — a human email address or a Centaur Team reference — using the mapping maintained under [03-REQ-044]. The persisted game record shall not contain raw SpacetimeDB Identities in any `stagedBy` field. (See resolved 03-REVIEW-005.)

---

### 3.9 Platform HTTP API Authorization

**03-REQ-033**: The platform's HTTP API ([05], informal spec Section 12) shall authorize each request by a bearer API key presented in the request's authorization header. API keys shall be created by authenticated humans via the Snek Centaur Server web application and shall be revocable.

**03-REQ-034**: API keys shall be stored by the platform only in a form from which the original key cannot be recovered (e.g., as a one-way hash). The plaintext of a newly created API key shall be shown to its creator exactly once, at creation time.

**03-REQ-035**: Each API key shall be bound to the human identity that created it, and its authorization scope shall be no broader than the actions that human would be permitted to take through the web application UI, subject to any additional scope restrictions owned by [05].

**03-REQ-036** *(negative)*: API keys shall not authorize the creation of new human identities, and shall not authorize any action that requires Google OAuth interaction.

---

### 3.10 Identity Mapping Across Runtimes

**03-REQ-037**: The Convex platform runtime shall be the sole issuer of all credentials that grant access to any other runtime in the platform. Neither the SpacetimeDB game runtime nor any Snek Centaur Server shall issue credentials that the other runtimes accept.

**03-REQ-038**: Every Centaur Team identifier used to seed a SpacetimeDB game instance ([02-REQ-022], informal spec Section 10) shall correspond to exactly one persistent Centaur Team record in Convex for the duration of that game's lifetime. Team-identifier collisions across games are prevented by [02-REQ-004] instance isolation.

**03-REQ-039**: For each game, the set of authorized human email addresses and the Centaur Team identity for each participating team shall be determined at game initialization time from Convex's persistent team membership state. This snapshot shall be binding for the full duration of the game, and the Convex runtime shall not alter the in-game authorization state of any running game in response to subsequent mutations of team records. (See resolved 03-REVIEW-006.)

**03-REQ-046**: While a game is in progress — defined as the interval during which the game's Convex record has `status = "playing"` (informal spec §11) — the Convex platform runtime shall reject mutations to the rosters of the participating Centaur Teams, including member additions, member removals, and changes to the team's nominated server domain. Such mutations shall be permitted only when no game involving the team is in the `playing` state. (See resolved 03-REVIEW-006.)

**03-REQ-047**: The per-game authorization snapshot taken under [03-REQ-039] shall be treated as an append-only historical fact tied to the game record. A human who is removed from a team's roster after a game has ended shall retain their attribution in that game's persisted historical record ([03-REQ-045]); the historical snapshot shall not be a derivation of current team membership. (See resolved 03-REVIEW-006.)

---

### 3.11 Credential and Key Management

**03-REQ-040**: The platform shall maintain signing material for per-Centaur-Team game credentials. The mechanism must allow Convex to generate and validate these credentials without requiring external key infrastructure during game-time writes.

**03-REQ-041**: The platform shall maintain separate signing material for per-Centaur-Team game credentials and for SpacetimeDB admission tickets (per-instance symmetric secret, to enable SpacetimeDB validation without distributing the signing key). Compromise of one scheme shall not compromise the other. (See REVIEW-007.)

**03-REQ-043** *(negative)*: Credential or key material shall not be transmitted over unauthenticated channels to any party other than its intended holder. In particular, SpacetimeDB admission-ticket validation secrets shall be transmitted only from Convex to the specific SpacetimeDB instance they validate, and only over a channel the platform trusts for provisioning. Per-Centaur-Team game credentials shall be transmitted only via the game invitation POST to the nominated server domain.

---

### 3.12 Convex Access to the SpacetimeDB Runtime

**03-REQ-048**: The Convex platform runtime shall be able to authenticate itself to the SpacetimeDB hosting platform for the purpose of provisioning and tearing down per-game instances ([02-REQ-020], [02-REQ-021]), and shall be able to authenticate itself to each provisioned SpacetimeDB game instance for the purpose of invoking privileged operations on that instance. The privileged operations that require such authentication include, at minimum: initialisation of the game at game start ([04-REQ-013]), registration of Convex as a subscriber to the instance's game-end notification mechanism ([04-REQ-061a]), and retrieval of the complete historical record at game end ([04-REQ-061]). Convex does not hold a live gameplay subscription to any SpacetimeDB game instance; live gameplay reads during play are performed by web clients directly ([02]) and do not require a Convex-held credential. The mechanisms by which Convex obtains and presents these credentials shall use best-practice affordances of the SpacetimeDB hosting platform and are a Phase 2 Design concern.

---

## REVIEW Items

### 03-REVIEW-001: "JWT" and "HMAC" as implementation artifacts — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: The instructions prohibit requirements from referencing "implementation artifacts (table names, reducer names, specific libraries)". The informal spec §3 uses the terms JWT, HMAC, JWKS, and RSA explicitly, and Module 02's related requirements are silent on whether these terms cross the line into implementation detail. The current draft treats JWT/HMAC/JWKS/RSA as domain-level concepts only when they are required to state an invariant (e.g., "a cryptographically signed admission ticket" instead of "a JWT"), and avoids naming them in requirements. This introduces some awkwardness — e.g., 03-REQ-041 hints at RSA/HMAC distinction via parenthetical guidance but does not name the schemes.
**Question**: Should requirements be permitted to name specific cryptographic constructions (JWT, HMAC, RSA, JWKS), or should all such naming be deferred to Design?
**Options**:
- A: Keep requirements construction-neutral; move all naming to Design. (Current draft.)
- B: Permit specific cryptographic constructions in requirements on the basis that interoperability between Convex's customJwt provider and SpacetimeDB's validator forces particular choices — these are effectively architectural commitments, not library choices.
**Informal spec reference**: §3 throughout.

**Decision**: A. Keep requirements neutral with respect to cryptographic primitives.
**Rationale**: Specific cryptographic constructions are design-phase concerns; requirements should only assert the invariants (signed, verifiable, bounded-lifetime, independence-of-compromise) that those constructions serve. This preserves flexibility to swap primitives if, for example, a future SpacetimeDB validator gains native public-key verification. If future reviewers find 03-REQ-041's parenthetical guidance drifts toward being load-bearing, that guidance should be demoted rather than hardened.
**Affected requirements/design elements**: None — the current draft already conformed to option A. 03-REQ-041's parenthetical scheme hints remain as non-normative guidance toward Design.

---

### 03-REVIEW-002: "Google OAuth" vs "federated identity provider" — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: The informal spec names Google specifically and repeatedly ("Google OAuth", "Google OAuth accounts"). The current draft generalizes this to "a federated identity provider integrated with Convex" to keep requirements provider-neutral. This may be over-generalization: if the platform is deliberately committing to Google as the sole provider (e.g., to keep the email address the canonical identity), that is a domain-level commitment, not an implementation detail.
**Question**: Is Google specifically mandated, or is Google an implementation choice and the requirement is "some federated identity provider that yields a canonical email"?
**Options**:
- A: Name Google OAuth as the provider in requirements.
- B: Generalize to "federated identity provider" and cover the Google choice in Design. (Current draft.)
**Informal spec reference**: §3, "Human Authentication".

**Decision**: A. Google OAuth is a binding requirement, not an implementation choice.
**Rationale**: The platform operator (Chris) has out-of-scope reasons for committing to Google specifically — notably, email addresses from Google accounts are used as stable identifiers across other systems beyond this spec. Generalizing to "federated identity provider" would understate the commitment and invite a future change that silently broke those out-of-scope integrations. If the platform ever genuinely needs to support additional providers, the right path is to revise these requirements deliberately rather than to discover the breakage through drift.
**Affected requirements/design elements**: 03-REQ-002, 03-REQ-007, 03-REQ-009, 03-REQ-027, 03-REQ-036 — all references to "federated identity provider" replaced with "Google" or "Google OAuth".

---

### 03-REVIEW-003: Email-as-identity stability — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 03-REQ-008 asserts that the email address identifies a human, and that two provider subjects with the same email are distinct humans. The informal spec says humans are "Identified by email address" (§3) and team membership is "authorized email addresses" (§3). But email addresses can be reassigned at providers (rare with Google Workspace, non-trivial with personal Google accounts), and a provider-issued subject is the standard stable identifier in OAuth/OIDC. The current draft privileges the subject as "uniquely identifies" while still using email for team membership lookups, which has a latent inconsistency: a human whose email changes at the provider would retain their subject but lose team memberships.
**Question**: Is the canonical human identity the email address (simple, matches the informal spec literally) or the provider subject (robust to email change, closer to OIDC practice)? If the former, what should happen when a provider's email for a subject changes?
**Options**:
- A: Email is canonical; subject is auxiliary. Email changes at the provider create a new human identity.
- B: Subject is canonical; email is a display attribute that can change. Team membership is looked up by subject, not email.
- C: Email and subject are both canonical and are required to match a prior (subject, email) binding at authentication time; mismatches force re-linking.
**Informal spec reference**: §3, "Identity Model".

**Decision**: A. Email is canonical; the OAuth subject is not an identity element on this platform.
**Rationale**: The email address is used as a stable identifier across systems outside the scope of this spec, so privileging any other attribute would desynchronize those systems from the platform's view of who a human is. An email change at Google is treated as the arrival of a distinct human, and historical state (team memberships, action log entries, replays) stays attached to the original email. This has the consequence that a human who loses access to their email cannot "move" their platform identity without operator intervention; that is an accepted trade-off. If a future rule change introduces platform-internal account recovery, revisit this decision because the mechanism for recovery will need somewhere stable to anchor on.
**Affected requirements/design elements**: 03-REQ-002 (removed provider-subject as unique identifier; email is the sole identifier), 03-REQ-008 (rewritten to state the merge rule for same-email authentications and the fork rule for email changes).

---

### 03-REVIEW-004: Admission ticket lifetime — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 03-REQ-027 requires admission ticket lifetimes to be "bounded" and "short enough that a leaked ticket ceases to grant access within a time window commensurate with the expected duration of a game phase." The informal spec says "short expiry" for Centaur Server JWTs (§3) but does not specify lifetimes for admission tickets. Making this testable requires a concrete bound, but choosing one requires knowledge of typical game durations (which depend on turn timeout configuration in [01]) and a threat model for ticket leakage.
**Question**: What are the specific maximum lifetimes for (a) game credentials, (b) human admission tickets, (c) bot admission tickets, (d) spectator admission tickets? And is it acceptable for the requirement to specify an order-of-magnitude bound (e.g., "at most one hour") rather than a hard number?
**Options**:
- A: Leave the requirement qualitative and resolve the numeric bound in Design.
- B: Specify concrete bounds at the requirements level, pending human input on numbers.
**Informal spec reference**: §3, "Centaur Server Authentication (Challenge-Callback)".

**Decision**: B with concrete numbers. Admission tickets of every role expire 15 minutes after issuance. Per-Centaur-Team game credentials have lifetimes bounded to the game (they expire when the game ends). Admission ticket validation is also clarified as register-only (no periodic re-validation of established connections).
**Rationale**: Nominal game duration is ~5 minutes and admission tickets are validated only at the `register` reducer, so the ticket's post-game-start relevance is primarily reconnection after a network interruption. A 15-minute window gives a reconnecting client 3× a nominal game to re-use the ticket it fetched at game start without forcing a refresh. If future rule changes introduce game durations substantially longer than 15 minutes and reconnection-during-game becomes a problem, revisit this.
**Affected requirements/design elements**: 03-REQ-021 (clarified as register-only validation with connection-persists semantics), 03-REQ-027 (admission ticket lifetime set to 15 min with reconnection rationale noted), 03-REQ-058 (game credential lifetime bounded to game).

---

### 03-REVIEW-005: `stagedBy` attribution granularity for human participants — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: The informal spec Section 14 mentions `stagedBy` capture in the `snake_moved` event. 03-REQ-032 asserts that `stagedBy` records enough information to distinguish a bot participant from a human and, for humans, recover the email. However, the SpacetimeDB identity associated with a human participant connection is derived from an admission ticket that carries the email, and it is not yet resolved whether the SpacetimeDB authoritative record should be (a) the connection's SpacetimeDB Identity (opaque, per-connection, does not persist across reconnections), (b) the email extracted from the admission ticket (persistent, globally meaningful), or (c) both. The informal spec is silent on this specific question. Module [02]'s 02-REQ-030 establishes that SpacetimeDB "has no concept of which human within a team is acting on which snake," which is in tension with recording human email in `stagedBy`.
**Question**: Should `stagedBy` for human participants carry the email address (which gives SpacetimeDB some "concept of which human"), or only a team+connection-level marker with the detailed attribution living in Convex's `centaur_action_log` ([06])? Is 02-REQ-030 violated if the email appears in `stagedBy`?
**Options**:
- A: Record email in `stagedBy`; reconcile with 02-REQ-030 on the grounds that SpacetimeDB merely transcribes the admission ticket and does not interpret it.
- B: Record only team+role in `stagedBy`; detailed per-human attribution lives only in Convex's action log.
- C: Record a stable human identifier (not email) in `stagedBy`.
**Informal spec reference**: §14, "Turn Event Schema"; §3 "SpacetimeDB Admission Tickets"; §11 (centaur_action_log).

**Decision**: A, with a refinement that resolves the tension with 02-REQ-030. Within SpacetimeDB's working state, `stagedBy` holds only an opaque SpacetimeDB connection Identity; SpacetimeDB does not read or branch on it. The mapping from Identity back to email (for humans) or Centaur Team reference (for bot participants) lives in the `team_permissions` table, which is populated from admission-ticket contents on each `register` call and retained for the lifetime of the game. Resolution from Identity to email/Centaur Team reference happens at a single boundary: serialization of the game record to Convex at game end.
**Rationale**: This preserves the letter and spirit of 02-REQ-030 — SpacetimeDB's runtime logic has no concept of "which human" during gameplay; it just records opaque Identities. The act of interpretation is isolated to the moment the game record crosses the boundary into Convex, where email-based attribution is meaningful. Retaining the `team_permissions` mapping across reconnections is necessary because an old `stagedBy` Identity from turn 10 may refer to a connection that was closed and replaced by minute 4, and the game-end serialization still needs to resolve it. Raw Identities must not appear in the persisted game record, so that downstream consumers (replay viewer, action log cross-referencing) have uniform shapes to work against.
**Affected requirements/design elements**: 03-REQ-032 rewritten to state the opaque-Identity semantics within SpacetimeDB and the no-interpretation constraint. Added 03-REQ-044 (SpacetimeDB maintains the mapping in `team_permissions` for the game's duration, including across reconnections). Added 03-REQ-045 (Convex-side serialization resolves `stagedBy` to email or Centaur Team reference; persisted records contain no raw Identities).

---

### 03-REVIEW-006: Membership changes mid-game — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 03-REQ-039 states that game authorization state is snapshot at initialization time and not retroactively changed by later membership edits. The informal spec does not address the case where a human is removed from a team mid-game or added to one during a game. This is a policy question with implications for admission-ticket issuance: if a human is removed from team T at turn 30, does their previously obtained admission ticket still work until expiry, or is the `team_permissions` snapshot in SpacetimeDB the binding source?
**Question**: Which source of team membership governs mid-game admission:
- the snapshot seeded into SpacetimeDB at `initialize_game` time, or
- the live Convex team record at the moment Convex issues an admission ticket, or
- both (live for ticket issuance, snapshot for ticket validation)?
**Options**:
- A: Snapshot is binding for the whole game; mid-game membership changes have no effect. (Current draft.)
- B: Live Convex state is binding at ticket-issuance time; the SpacetimeDB snapshot mirrors the snapshot-at-init only as a default, and Convex can push updates.
- C: Both checks apply and the stricter wins.
**Informal spec reference**: §3 (admission tickets); §9.2 (team management).

**Decision**: A, strengthened: team membership is not merely snapshot-and-ignored, it is explicitly frozen at game start and cannot be mutated in Convex while the game is in progress. Convex rejects roster edits for participating teams while the game is in the `playing` state. The snapshot is treated as append-only historical fact for post-game attribution.
**Rationale**: Forbidding the mutation entirely at the source is cleaner than snapshot-plus-ignore. Under the snapshot-plus-ignore reading, the UI would permit a captain to remove a member during a game, but the removal would silently have no effect on the running game — a confusing user experience and an attractive surface for bugs where live vs snapshot state diverges. Hard-blocking the mutation surfaces the freeze to the captain immediately and keeps Convex and SpacetimeDB's views of team membership in lockstep for the game's duration. Historical attribution (e.g., a removed player's moves in a completed game) is preserved via [03-REQ-045] and [03-REQ-047].
**Affected requirements/design elements**: 03-REQ-039 strengthened (snapshot is binding for the full game). Added 03-REQ-046 (Convex must reject roster mutations while a participating team has a game in the `playing` state). Added 03-REQ-047 (the snapshot is treated as an append-only historical fact; post-game roster edits do not erase historical attribution).

**Sub-question surfaced but not resolved here**: The decision frames "in progress" as `games.status = "playing"`. Between tournament rounds (informal spec §9.4 step 4), a tournament's outer lifecycle is active but no individual round is in the `playing` state. As written, roster mutations would be permitted between rounds of a tournament. If tournaments should freeze rosters across the whole event rather than per-round, a new REVIEW item should be opened against Module [05] or Module [08] where tournament mode lifecycle is owned. Flagging here rather than silently deciding.

---

### 03-REVIEW-007: Asymmetric signing for two different validation contexts — **RESOLVED**

**Type**: Proposed Addition
**Phase**: Requirements
**Context**: 03-REQ-041 elevates the implementation pattern described in the informal spec — separate signing material for game credentials (so Convex can validate them) and HMAC for admission tickets (so each SpacetimeDB instance holds only the secret for its own instance) — to a requirements-level invariant about independence of compromise. This is a proposed addition, not explicit in the informal spec. The justification is defense-in-depth: if either scheme is broken, the other continues to function.
**Question**: Is the independence-of-compromise invariant an intended architectural commitment, or is it an inference from an implementation choice that should not be locked in at the requirements level?
**Options**:
- A: Keep as a requirement — architectural invariant worth preserving. (Current draft.)
- B: Drop from Requirements; describe the scheme choice in Design only.
**Informal spec reference**: §3, "Centaur Server Authentication" and "SpacetimeDB Admission Tickets".

**Decision**: A. Independence of compromise between the game credential signing scheme and the admission ticket signing scheme is an intended architectural invariant.
**Rationale**: Elevating this to a requirement means a future design change that (for example) unified the two signing paths under a single secret would be visible as a requirements violation rather than slipping in as an implementation simplification. The inconvenience of carrying this as a requirement is small; the cost of losing defense-in-depth silently is large.
**Affected requirements/design elements**: None — current 03-REQ-041 conforms.

---

### 03-REVIEW-008: Convex as sole issuer (03-REQ-037) vs healthcheck/library extension surface — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 03-REQ-037 asserts Convex is the sole issuer of all credentials. But 02-REQ-029 requires Snek Centaur Servers to expose a healthcheck endpoint the platform calls. If that healthcheck requires no authentication, 03-REQ-037 is consistent; if it requires a credential, something must issue it. The current draft assumes healthchecks are unauthenticated on the basis that they only need to verify reachability.
**Question**: Are Snek Centaur Server healthcheck calls authenticated, and if so, by what credential?
**Options**:
- A: Unauthenticated; they verify only reachability. (Current draft assumption.)
- B: Authenticated with a dedicated shared secret at registration time (contradicts 03-REQ-012).
- C: Authenticated with a Convex-issued token delivered via a different mechanism.
**Informal spec reference**: §2, "Centaur Servers"; §3.

**Decision**: A. Snek Centaur Server healthcheck calls are unauthenticated; they verify only reachability.
**Rationale**: Healthchecks answer a single question — "is the server reachable and responsive?" — which needs no identity binding. Keeping them unauthenticated preserves 03-REQ-037 (Convex remains sole issuer of all credentials) and 03-REQ-012 (no shared secret at nomination) without special-casing. The attack surface is minimal: a healthcheck endpoint that only returns liveness information leaks no team state. If a future change extends the healthcheck payload to include sensitive information, revisit this decision because the threat model would change.
**Affected requirements/design elements**: None — current draft conforms. Flagged guidance for Phase 2 Design: the healthcheck response payload should be minimal and contain no team-scoped state.

---

### 03-REVIEW-009: Spectator eligibility and rate-limiting — **RESOLVED**

**Type**: Gap
**Phase**: Requirements
**Context**: 03-REQ-026 permits any authenticated human to obtain a spectator admission ticket, deferring eligibility rules to [08]. The informal spec §8.5 says "Any authenticated user can spectate a game in progress" but does not address private games, room-level visibility settings, or abuse (a single human requesting thousands of spectator tickets). This may be adequately covered by [08]; flagging to ensure it is not silently dropped between modules.
**Question**: Does any spectator access restriction belong in [03] (e.g., per-human rate limit on admission ticket issuance), or is all of it [08]'s concern?
**Options**:
- A: All spectator-access policy lives in [08]; [03] only defines the ticket mechanism. (Current draft.)
- B: [03] owns at least a rate-limit or abuse-prevention requirement on admission ticket issuance.
**Informal spec reference**: §8.5; §3.

**Decision**: A. Module [03] defines only the spectator ticket mechanism; all spectator eligibility policy (private games, room visibility, rate-limiting, abuse prevention) belongs to [08] or to whichever later module owns the feature.
**Rationale**: Keeping [03] narrowly scoped to identity and credential mechanics makes its boundary clean and avoids duplicating policy. If [08]'s Phase 1 author encounters this and needs [03] to carry a rate-limit requirement, that can be negotiated as a cross-module requirement change at that point — this decision is not load-bearing against such a change. The risk being accepted here is that [08]'s author might assume spectator rate-limiting is handled upstream in [03] and silently drop it; to mitigate, a cross-reference note should be carried forward.
**Affected requirements/design elements**: None — current 03-REQ-026 conforms. Cross-module reminder: when [08] Phase 1 begins, verify that spectator eligibility rules (visibility, rate-limiting, abuse prevention) are explicitly captured there. If [08]'s author needs [03] to participate in any of that, a new REVIEW item should be raised against this module.
