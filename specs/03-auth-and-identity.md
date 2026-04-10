# Module 03: Authentication & Identity

## Requirements

### 3.1 Identity Model

**03-REQ-001**: The platform shall recognize exactly three kinds of identity: **human identities**, **Centaur Server identities**, and **game-participant identities**. Every authenticated actor on the platform shall hold one of these identity kinds, and no other kinds shall exist.

**03-REQ-002**: A **human identity** shall represent an individual natural person who holds a Google account. Human identities shall be uniquely identified by the email address associated with that Google account. (See resolved 03-REVIEW-002 and 03-REVIEW-003.)

**03-REQ-003**: A **Centaur Server identity** shall represent one registered Centaur Server and shall be bound one-to-one with the Centaur Team that registered it, consistent with [02-REQ-005]. A Centaur Server identity shall be uniquely identified by the domain under which the Centaur Server is registered.

**03-REQ-004**: A **game-participant identity** shall represent a single authenticated connection to a specific SpacetimeDB game instance for a specific team in one of two roles: **human participant**, **Centaur Server participant**, or **spectator participant**. A game-participant identity shall be derived from exactly one underlying human or Centaur Server identity, except spectator participants which are derived from a human identity only.

**03-REQ-005**: Human and Centaur Server identities shall be distinguishable from one another wherever they are observed by platform code. No platform code path shall be obligated to handle an identity whose kind is ambiguous.

**03-REQ-006** *(negative)*: The platform shall not support anonymous or unauthenticated participants in any role that stages moves, modifies game state, or modifies Centaur subsystem state.

---

### 3.2 Human Authentication

**03-REQ-007**: Human identities shall be established through Google OAuth integrated with the Convex platform runtime. Establishing a human identity shall produce a persistent Convex session that survives across browser page loads until the session is explicitly revoked or expires. (See resolved 03-REVIEW-002.)

**03-REQ-008**: The platform shall identify a human by the email address associated with their Google account. Any two successful Google OAuth authentications that yield the same email address shall be treated as the same human identity, irrespective of other provider-side attributes such as the OAuth subject claim. A change to the email address of a Google account at the provider shall have the effect of creating a new, distinct human identity on the platform; the prior email's identity shall remain attached to its historical state and shall not be migrated. (See resolved 03-REVIEW-003.)

**03-REQ-009** *(negative)*: The platform shall not store passwords, password hashes, or any shared secret that would permit direct authentication of a human without Google OAuth.

**03-REQ-010**: Human authentication shall be a prerequisite for every affordance the Game Platform ([09]) offers that reads or writes user-scoped state, with the sole exception of public read-only views whose scope is specified in [09].

---

### 3.3 Centaur Server Registration and Authentication

**03-REQ-011**: A Centaur Server shall be registered to a Centaur Team by a human holding the Captain role of that team. Registration shall require the Captain to supply the domain URL at which the Centaur Server is reachable, and shall not require the Captain or the Centaur Server to supply a shared secret.

**03-REQ-012** *(negative)*: The platform shall not store, exchange, or transmit a shared secret between the platform runtime and a Centaur Server at any point during registration.

**03-REQ-013**: The platform shall authenticate a Centaur Server via a **challenge-callback protocol** initiated by the Centaur Server, satisfying all of the following:
- (a) The Centaur Server shall initiate authentication by requesting a challenge from an unauthenticated platform endpoint, supplying its registered domain.
- (b) The platform shall generate a fresh cryptographically random nonce for each authentication attempt, with sufficient entropy that nonces cannot be predicted or collided across attempts.
- (c) The platform shall deliver the nonce by making an outbound HTTP request to a well-known path on the Centaur Server's registered domain.
- (d) The Centaur Server at that domain shall echo the nonce back in its HTTP response.
- (e) Only upon successful echo shall the platform issue a Centaur Server credential (see 03-REQ-015) to the caller.

**03-REQ-014**: The correctness of the challenge-callback protocol shall depend only on the property that the platform's outbound HTTP request reaches the legitimate holder of the registered domain. The protocol shall not require or assume any pre-shared secret, mutual TLS, or out-of-band verification step between platform and Centaur Server.

**03-REQ-015**: A successful challenge-callback shall result in the platform issuing a **Centaur Server credential** that the Centaur Server uses to authenticate subsequent Convex requests. The credential shall:
- (a) bind to the Centaur Server's Centaur Team;
- (b) expire **15 minutes** after issuance, such that a compromised credential ceases to grant access within that window without manual revocation;
- (c) be re-obtainable by the Centaur Server by repeating the challenge-callback protocol, without operator intervention.

**03-REQ-016** *(negative)*: A Centaur Server credential shall not be transferable: possession of a credential issued to Centaur Team A shall not grant any access to Centaur Team B's state.

**03-REQ-017**: When presented with a Centaur Server credential, the Convex platform runtime shall be able to resolve the calling identity to the specific Centaur Team that registered the Centaur Server, and shall expose the identity kind (Centaur Server rather than human) to function code that observes the authenticated identity.

**03-REQ-018**: The platform shall permit a Centaur Team to update or replace its registered Centaur Server domain. A domain change shall invalidate any previously issued Centaur Server credentials associated with the prior domain no later than the end of their natural expiry.

---

### 3.4 SpacetimeDB Admission Tickets

**03-REQ-019**: Admission of any connection to a SpacetimeDB game instance shall be mediated by a cryptographically signed **admission ticket** issued by the Convex platform runtime. The SpacetimeDB game instance shall not accept gameplay connections on any other basis.

**03-REQ-020**: An admission ticket shall carry, at minimum, the following information:
- (a) the identifier of the game instance for which admission is granted;
- (b) the identifier of the Centaur Team on whose behalf the connection is acting (except for spectator tickets, per 03-REQ-026);
- (c) the role of the connection: **human participant**, **Centaur Server participant**, or **spectator**;
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

**03-REQ-025**: Centaur Server participants shall obtain admission tickets by calling the same class of Convex endpoint authenticated by a Centaur Server credential. The Convex runtime shall refuse to issue a Centaur Server admission ticket unless the requesting Centaur Server is, at the moment of the request, bound to a team registered to the target game.

**03-REQ-026**: **Spectator admission tickets** shall be issuable by the Convex runtime to any authenticated human identity that requests to spectate a game, subject to any spectator eligibility rules owned by [09]. Spectator admission tickets shall carry the spectator role, shall not carry a team binding, and shall confer no move-staging privilege. They shall otherwise share the ticket format defined in 03-REQ-020.

**03-REQ-027**: Admission tickets for all roles (human participant, Centaur Server participant, spectator) shall have a lifetime of **15 minutes** from issuance. A ticket holder shall be able to obtain a replacement ticket before expiry without re-authenticating with Google OAuth (for humans) or re-running the challenge-callback protocol (for Centaur Servers), provided the underlying identity's credential is still valid. Because admission tickets are validated only at connection registration ([03-REQ-021]), the 15-minute lifetime governs the window within which a ticket can be used to establish or re-establish a connection — including reconnection after a network interruption during a game — and does not bound the lifetime of an already-admitted connection. (See resolved 03-REVIEW-004.)

---

### 3.5 Authorization Semantics Inside a Game

**03-REQ-028**: A connection admitted to a SpacetimeDB game instance as a **human participant** for team T or as a **Centaur Server participant** for team T shall be authorized to stage moves for any snake belonging to team T, subject to [02-REQ-011] and the turn-resolution semantics of [01]. Staging discipline shall be determined by last-write-wins within the SpacetimeDB instance.

**03-REQ-029** *(negative)*: A connection admitted to a SpacetimeDB game instance shall not be authorized to stage, alter, or observe in a non-filtered manner any state belonging to a team other than the team it was admitted for, and spectators shall not be authorized to stage, alter, or observe-through-filtering any team's private state.

**03-REQ-030** *(negative)*: The SpacetimeDB game instance shall not be authoritative for, or hold any record of, which specific human within a team is operating which snake. Selection discipline ([02-REQ-018]) is enforced outside SpacetimeDB.

**03-REQ-031**: The SpacetimeDB game instance shall subject every admitted connection — including Centaur Server participants, human participants, and spectators — to the invisibility filter of [02-REQ-010] whenever the connection does not belong to the snake's owning team. Spectator connections shall be filtered on the same terms as opponent connections.

**03-REQ-032**: Each staged move recorded in the game's turn log (per [04], informal spec Section 14) shall carry a `stagedBy` attribution. Within the SpacetimeDB game instance, `stagedBy` shall hold an opaque SpacetimeDB connection Identity — the Identity of the connection that most recently wrote the move. SpacetimeDB turn-resolution logic shall not read, interpret, or branch on this Identity, consistent with [02-REQ-030]. (See resolved 03-REVIEW-005.)

**03-REQ-044**: The SpacetimeDB game instance shall maintain, in the `team_permissions` entries seeded by the `register` reducer from admission-ticket contents, a mapping sufficient to resolve any Identity recorded in any `stagedBy` field to one of the following two forms: (a) the email address of a human participant, or (b) a reference designating the Centaur Server participant of a specific participating team. This mapping shall be retained for the full duration of the game — including for Identities of connections that have since been closed or replaced by reconnection — so that historical `stagedBy` values remain resolvable at game end. (See resolved 03-REVIEW-005.)

**03-REQ-045**: When Convex persists the game record from the SpacetimeDB game instance at game end (per [02-REQ-022]), each `stagedBy` value in the serialized record shall be resolved to its Convex-interpretable form — a human email address or a Centaur Server team reference — using the mapping maintained under [03-REQ-044]. The persisted game record shall not contain raw SpacetimeDB Identities in any `stagedBy` field. (See resolved 03-REVIEW-005.)

---

### 3.6 Platform HTTP API Authorization

**03-REQ-033**: The platform's HTTP API ([05], informal spec Section 12) shall authorize each request by a bearer API key presented in the request's authorization header. API keys shall be created by authenticated humans via the Game Platform and shall be revocable.

**03-REQ-034**: API keys shall be stored by the platform only in a form from which the original key cannot be recovered (e.g., as a one-way hash). The plaintext of a newly created API key shall be shown to its creator exactly once, at creation time.

**03-REQ-035**: Each API key shall be bound to the human identity that created it, and its authorization scope shall be no broader than the actions that human would be permitted to take through the Game Platform UI, subject to any additional scope restrictions owned by [05].

**03-REQ-036** *(negative)*: API keys shall not authorize the creation of new human or Centaur Server identities, and shall not authorize any action that requires Google OAuth interaction.

---

### 3.7 Identity Mapping Across Runtimes

**03-REQ-037**: The Convex platform runtime shall be the sole issuer of all credentials that grant access to any other runtime in the platform. Neither the SpacetimeDB game runtime nor the Centaur Server runtime shall issue credentials that the other runtimes accept.

**03-REQ-038**: Every Centaur Team identifier used to seed a SpacetimeDB game instance ([02-REQ-022], informal spec Section 10) shall correspond to exactly one persistent Centaur Team record in Convex for the duration of that game's lifetime. Team-identifier collisions across games are prevented by [02-REQ-004] instance isolation.

**03-REQ-039**: For each game, the set of authorized human email addresses and the single authorized Centaur Server for each participating team shall be determined at game initialization time from Convex's persistent team membership state. This snapshot shall be binding for the full duration of the game, and the Convex runtime shall not alter the in-game authorization state of any running game in response to subsequent mutations of team records. (See resolved 03-REVIEW-006.)

**03-REQ-046**: While a game is in progress — defined as the interval during which the game's Convex record has `status = "playing"` (informal spec §11) — the Convex platform runtime shall reject mutations to the rosters of the participating Centaur Teams, including member additions, member removals, and changes to the team's Centaur Server registration. Such mutations shall be permitted only when no game involving the team is in the `playing` state. (See resolved 03-REVIEW-006.)

**03-REQ-047**: The per-game authorization snapshot taken under [03-REQ-039] shall be treated as an append-only historical fact tied to the game record. A human who is removed from a team's roster after a game has ended shall retain their attribution in that game's persisted historical record ([03-REQ-045]); the historical snapshot shall not be a derivation of current team membership. (See resolved 03-REVIEW-006.)

---

### 3.8 Credential and Key Management

**03-REQ-040**: The platform shall maintain a signing key that the Convex runtime uses to sign Centaur Server credentials. The corresponding verification key shall be publishable at a platform-hosted endpoint in a form consumable by standard Convex identity-provider configuration.

**03-REQ-041**: The platform shall maintain separate signing material for Centaur Server credentials (public-key cryptography, to enable Convex self-verification via its customJwt provider mechanism) and for SpacetimeDB admission tickets (per-instance symmetric secret, to enable SpacetimeDB validation without distributing the signing key). Compromise of one scheme shall not compromise the other. (See REVIEW-007.)

**03-REQ-042**: The platform shall be able to revoke a registered Centaur Server. Revocation shall cause subsequent challenge-callback attempts to fail and any currently outstanding Centaur Server credentials for that server to cease being useful no later than their natural expiry.

**03-REQ-043** *(negative)*: Credential or key material shall not be transmitted over unauthenticated channels to any party other than its intended holder. In particular, SpacetimeDB admission-ticket validation secrets shall be transmitted only from Convex to the specific SpacetimeDB instance they validate, and only over a channel the platform trusts for provisioning.

---

## REVIEW Items

### 03-REVIEW-001: "JWT" and "HMAC" as implementation artifacts — **RESOLVED**

**Type**: Ambiguity
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
**Context**: 03-REQ-027 requires admission ticket lifetimes to be "bounded" and "short enough that a leaked ticket ceases to grant access within a time window commensurate with the expected duration of a game phase." The informal spec says "short expiry" for Centaur Server JWTs (§3) but does not specify lifetimes for admission tickets. Making this testable requires a concrete bound, but choosing one requires knowledge of typical game durations (which depend on turn timeout configuration in [01]) and a threat model for ticket leakage.
**Question**: What are the specific maximum lifetimes for (a) Centaur Server credentials, (b) human admission tickets, (c) Centaur Server admission tickets, (d) spectator admission tickets? And is it acceptable for the requirement to specify an order-of-magnitude bound (e.g., "at most one hour") rather than a hard number?
**Options**:
- A: Leave the requirement qualitative and resolve the numeric bound in Design.
- B: Specify concrete bounds at the requirements level, pending human input on numbers.
**Informal spec reference**: §3, "Centaur Server Authentication (Challenge-Callback)".

**Decision**: B with concrete numbers. All credentials — Centaur Server credentials and admission tickets of every role — expire 15 minutes after issuance. Admission ticket validation is also clarified as register-only (no periodic re-validation of established connections).
**Rationale**: Nominal game duration is ~5 minutes and admission tickets are validated only at the `register` reducer, so the ticket's post-game-start relevance is primarily reconnection after a network interruption. A 15-minute window gives a reconnecting client 3× a nominal game to re-use the ticket it fetched at game start without forcing a refresh, which removes a potential source of friction precisely when players are already dealing with flaky networks. The same 15-minute figure is used for Centaur Server credentials because that class of credential is continuously auto-refreshed by the library's refresh loop, so the nominal cost of a short lifetime is absorbed by automation rather than user friction. Uniformity across all credential types also makes the refresh-loop implementation simpler. If future rule changes introduce game durations substantially longer than 15 minutes (e.g., timekeeper-banked time that routinely extends games past that window) and reconnection-during-game becomes a problem, revisit this — the 15-min figure assumes games rarely exceed it.
**Affected requirements/design elements**: 03-REQ-015 (Centaur Server credential lifetime set to 15 min), 03-REQ-021 (clarified as register-only validation with connection-persists semantics), 03-REQ-027 (admission ticket lifetime set to 15 min with reconnection rationale noted).

---

### 03-REVIEW-005: `stagedBy` attribution granularity for human participants — **RESOLVED**

**Type**: Ambiguity
**Context**: The informal spec Section 14 mentions `stagedBy` capture in the `snake_moved` event. 03-REQ-032 asserts that `stagedBy` records enough information to distinguish a Centaur Server from a human and, for humans, recover the email. However, the SpacetimeDB identity associated with a human participant connection is derived from an admission ticket that carries the email, and it is not yet resolved whether the SpacetimeDB authoritative record should be (a) the connection's SpacetimeDB Identity (opaque, per-connection, does not persist across reconnections), (b) the email extracted from the admission ticket (persistent, globally meaningful), or (c) both. The informal spec is silent on this specific question. Module [02]'s 02-REQ-030 establishes that SpacetimeDB "has no concept of which human within a team is acting on which snake," which is in tension with recording human email in `stagedBy`.
**Question**: Should `stagedBy` for human participants carry the email address (which gives SpacetimeDB some "concept of which human"), or only a team+connection-level marker with the detailed attribution living in Convex's `centaur_action_log` ([06])? Is 02-REQ-030 violated if the email appears in `stagedBy`?
**Options**:
- A: Record email in `stagedBy`; reconcile with 02-REQ-030 on the grounds that SpacetimeDB merely transcribes the admission ticket and does not interpret it.
- B: Record only team+role in `stagedBy`; detailed per-human attribution lives only in Convex's action log.
- C: Record a stable human identifier (not email) in `stagedBy`.
**Informal spec reference**: §14, "Turn Event Schema"; §3 "SpacetimeDB Admission Tickets"; §11 (centaur_action_log).

**Decision**: A, with a refinement that resolves the tension with 02-REQ-030. Within SpacetimeDB's working state, `stagedBy` holds only an opaque SpacetimeDB connection Identity; SpacetimeDB does not read or branch on it. The mapping from Identity back to email (for humans) or Centaur Server reference (for Centaur Server participants) lives in the `team_permissions` table, which is populated from admission-ticket contents on each `register` call and retained for the lifetime of the game. Resolution from Identity to email/Centaur Server reference happens at a single boundary: serialization of the game record to Convex at game end.
**Rationale**: This preserves the letter and spirit of 02-REQ-030 — SpacetimeDB's runtime logic has no concept of "which human" during gameplay; it just records opaque Identities. The act of interpretation is isolated to the moment the game record crosses the boundary into Convex, where email-based attribution is meaningful. Retaining the `team_permissions` mapping across reconnections is necessary because an old `stagedBy` Identity from turn 10 may refer to a connection that was closed and replaced by minute 4, and the game-end serialization still needs to resolve it. Raw Identities must not appear in the persisted game record, so that downstream consumers (replay viewer, action log cross-referencing) have uniform shapes to work against.
**Affected requirements/design elements**: 03-REQ-032 rewritten to state the opaque-Identity semantics within SpacetimeDB and the no-interpretation constraint. Added 03-REQ-044 (SpacetimeDB maintains the mapping in `team_permissions` for the game's duration, including across reconnections). Added 03-REQ-045 (Convex-side serialization resolves `stagedBy` to email or Centaur Server reference; persisted records contain no raw Identities).

---

### 03-REVIEW-006: Membership changes mid-game — **RESOLVED**

**Type**: Ambiguity
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

**Sub-question surfaced but not resolved here**: The decision frames "in progress" as `games.status = "playing"`. Between tournament rounds (informal spec §9.4 step 4), a tournament's outer lifecycle is active but no individual round is in the `playing` state. As written, roster mutations would be permitted between rounds of a tournament. If tournaments should freeze rosters across the whole event rather than per-round, a new REVIEW item should be opened against Module [05] or Module [09] where tournament mode lifecycle is owned. Flagging here rather than silently deciding.

---

### 03-REVIEW-007: Asymmetric signing for two different validation contexts — **RESOLVED**

**Type**: Proposed Addition
**Context**: 03-REQ-041 elevates the implementation pattern described in the informal spec — RSA for Centaur credentials (so Convex can self-verify via JWKS) and HMAC for admission tickets (so each SpacetimeDB instance holds only the secret for its own instance) — to a requirements-level invariant about independence of compromise. This is a proposed addition, not explicit in the informal spec. The justification is defense-in-depth: if either scheme is broken, the other continues to function.
**Question**: Is the independence-of-compromise invariant an intended architectural commitment, or is it an inference from an implementation choice that should not be locked in at the requirements level?
**Options**:
- A: Keep as a requirement — architectural invariant worth preserving. (Current draft.)
- B: Drop from Requirements; describe the scheme choice in Design only.
**Informal spec reference**: §3, "Centaur Server Authentication" and "SpacetimeDB Admission Tickets".

**Decision**: A. Independence of compromise between the Centaur Server credential signing scheme and the admission ticket signing scheme is an intended architectural invariant.
**Rationale**: Elevating this to a requirement means a future design change that (for example) unified the two signing paths under a single secret would be visible as a requirements violation rather than slipping in as an implementation simplification. The inconvenience of carrying this as a requirement is small; the cost of losing defense-in-depth silently is large. Note: this decision interacts with resolved 03-REVIEW-001 (cryptographic primitives kept neutral in requirements) — 03-REQ-041 currently names RSA/HMAC in a parenthetical, which is borderline for REVIEW-001's resolution. Consider demoting those parentheticals to Design notes when module 03 enters Phase 2; the load-bearing invariant is "independence of compromise," not the specific primitives.
**Affected requirements/design elements**: None — current 03-REQ-041 conforms. Flagged follow-up: reconsider parenthetical primitive names in 03-REQ-041 during Phase 2 to fully align with REVIEW-001's resolution.

---

### 03-REVIEW-008: Convex as sole issuer (03-REQ-037) vs healthcheck/library extension surface — **RESOLVED**

**Type**: Ambiguity
**Context**: 03-REQ-037 asserts Convex is the sole issuer of all credentials. But 02-REQ-029 requires Centaur Servers to expose a healthcheck endpoint the platform calls. If that healthcheck requires no authentication, 03-REQ-037 is consistent; if it requires a credential, something must issue it. The current draft assumes healthchecks are unauthenticated on the basis that they only need to verify reachability.
**Question**: Are Centaur Server healthcheck calls authenticated, and if so, by what credential?
**Options**:
- A: Unauthenticated; they verify only reachability. (Current draft assumption.)
- B: Authenticated with a dedicated shared secret at registration time (contradicts 03-REQ-012).
- C: Authenticated with a Convex-issued token delivered via a different mechanism.
**Informal spec reference**: §2, "Centaur Servers"; §3.

**Decision**: A. Centaur Server healthcheck calls are unauthenticated; they verify only reachability.
**Rationale**: Healthchecks answer a single question — "is the server reachable and responsive?" — which needs no identity binding. Keeping them unauthenticated preserves 03-REQ-037 (Convex remains sole issuer of all credentials) and 03-REQ-012 (no shared secret at registration) without special-casing. The attack surface is minimal: a healthcheck endpoint that only returns liveness information leaks no team state. If a future change extends the healthcheck payload to include sensitive information (e.g., current game identifiers, snake state summaries), revisit this decision because the threat model would change. The healthcheck endpoint should be kept deliberately information-free to avoid that coupling.
**Affected requirements/design elements**: None — current draft conforms. Flagged guidance for Phase 2 Design and for [02]'s treatment of healthchecks: the healthcheck response payload should be minimal and contain no team-scoped state, so that its unauthenticated status remains safe.

---

### 03-REVIEW-009: Spectator eligibility and rate-limiting — **RESOLVED**

**Type**: Gap
**Context**: 03-REQ-026 permits any authenticated human to obtain a spectator admission ticket, deferring eligibility rules to [09]. The informal spec §8.5 says "Any authenticated user can spectate a game in progress" but does not address private games, room-level visibility settings, or abuse (a single human requesting thousands of spectator tickets). This may be adequately covered by [09]; flagging to ensure it is not silently dropped between modules.
**Question**: Does any spectator access restriction belong in [03] (e.g., per-human rate limit on admission ticket issuance), or is all of it [09]'s concern?
**Options**:
- A: All spectator-access policy lives in [09]; [03] only defines the ticket mechanism. (Current draft.)
- B: [03] owns at least a rate-limit or abuse-prevention requirement on admission ticket issuance.
**Informal spec reference**: §8.5; §3.

**Decision**: A. Module [03] defines only the spectator ticket mechanism; all spectator eligibility policy (private games, room visibility, rate-limiting, abuse prevention) belongs to [09] or to whichever later module owns the feature.
**Rationale**: Keeping [03] narrowly scoped to identity and credential mechanics makes its boundary clean and avoids duplicating policy. If [09]'s Phase 1 author encounters this and needs [03] to carry a rate-limit requirement, that can be negotiated as a cross-module requirement change at that point — this decision is not load-bearing against such a change. The risk being accepted here is that [09]'s author might assume spectator rate-limiting is handled upstream in [03] and silently drop it; to mitigate, a cross-reference note should be carried forward.
**Affected requirements/design elements**: None — current 03-REQ-026 conforms. Cross-module reminder: when [09] Phase 1 begins, verify that spectator eligibility rules (visibility, rate-limiting, abuse prevention) are explicitly captured there. If [09]'s author needs [03] to participate in any of that, a new REVIEW item should be raised against this module.
