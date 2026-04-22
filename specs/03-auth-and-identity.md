# Module 03: Authentication & Identity

## Requirements

### 3.1 Identity Model

**03-REQ-001**: The platform shall recognize exactly two kinds of persistent identity: **human identities** and **Centaur Team identities**. A third kind of identity, **game-participant identities**, shall exist as derived identities scoped to individual games. Every authenticated actor on the platform shall hold one of these identity kinds, and no other kinds shall exist.

**03-REQ-002**: A **human identity** shall represent an individual natural person who holds a Google account. Human identities shall be uniquely identified by the email address associated with that Google account. (See resolved 03-REVIEW-002 and 03-REVIEW-003.)

**03-REQ-003**: A **Centaur Team identity** shall represent one registered Centaur Team and shall be uniquely identified by a platform-assigned ID. A Centaur Team identity is the persistent competitive unit on the platform. A Centaur Team has a nominated Snek Centaur Server domain ([02-REQ-005]), but the server domain is a configuration field, not an identity element — changing the domain does not create a new Centaur Team identity.

**03-REQ-004**: A **game-participant identity** shall represent a single authenticated connection to a specific SpacetimeDB game instance for a specific team in one of three roles: **human participant**, **bot participant**, or **spectator participant**. Human participant identities are derived from a human identity. Bot participant identities are derived from a Centaur Team identity (via the per-Centaur-Team game credential held by the Snek Centaur Server). Spectator participant identities are derived from a human identity.

**03-REQ-005**: Human and Centaur Team identities shall be distinguishable from one another wherever they are observed by platform code. No platform code path shall be obligated to handle an identity whose kind is ambiguous.

**03-REQ-006** *(negative)*: The platform shall not support anonymous or unauthenticated participants in any role that stages moves, modifies game state, or modifies Centaur subsystem state.

**03-REQ-049** *(negative)*: Snek Centaur Servers shall have no persistent identity on the platform. A server domain is a configuration field on a Centaur Team record (per 03-REQ-003), not an identity. A Snek Centaur Server shall receive credentials only when invited to host a game, and those credentials shall be scoped to a Centaur Team and a game, not to the server itself.

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

**03-REQ-053**: The invitation payload shall contain a per-Centaur-Team game credential sufficient for the Snek Centaur Server to: (a) write to Convex on behalf of that Centaur Team (centaur subsystem state, action log), and (b) obtain SpacetimeDB access tokens for that Centaur Team's bot participant connection.

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
- (b) The ability to request SpacetimeDB access tokens for that Centaur Team's bot participant role.

**03-REQ-016** *(negative)*: A per-Centaur-Team game credential shall not be transferable: possession of a credential issued to Centaur Team A shall not grant any access to Centaur Team B's state.

**03-REQ-017**: When presented with a per-Centaur-Team game credential, the Convex platform runtime shall be able to resolve the calling identity to the specific Centaur Team the credential was issued for, and shall expose the identity kind (Centaur Team game credential rather than human) to function code that observes the authenticated identity.

---

### 3.5 Admin Role

**03-REQ-060**: The platform shall support an **admin** role as a platform-level (Convex-side) concept. Admin is not a per-server concept.

**03-REQ-061**: Admin users shall be able to browse ALL Centaur Teams, not just ones they belong to.

**03-REQ-062**: Admin users shall be able to see ALL games in history pages across all Centaur Teams.

**03-REQ-063**: Admin users shall be able to watch ANY replay, including within-turn actions of any Centaur Team, regardless of team membership. Admin users shall additionally hold implicit coach permission for every Centaur Team per [05-REQ-067], granting them read-only visibility into the live state of any in-progress game.

**03-REQ-064**: How admin accounts are designated (e.g., a list of Google emails in Convex configuration, a database flag) is a design-phase decision, but the requirement that the role exists and has these capabilities must be stated.

---

### 3.6 Read-Access Principle

**03-REQ-065**: A user's read access to Convex data shall be determined entirely by their Google identity, with no conditioning on which Snek Centaur Server they are visiting.

**03-REQ-066**: Any Snek Centaur Server serves the same platform UI and the user sees the same data regardless of which server they visit. The Snek Centaur Server is an open-source client to Convex.

**03-REQ-067**: The platform specification shall explicitly state the trust implication: a malicious Snek Centaur Server could inject client-side code that exfiltrates the user's Convex-readable data. This is an accepted trust trade-off — users should only log into servers they trust, similar to any web application.

---

### 3.7 SpacetimeDB Connection Authentication

**03-REQ-019**: Admission of any connection to a SpacetimeDB game instance shall be mediated by an **RS256-signed JWT** issued by the Convex platform runtime and validated by SpacetimeDB via standard OIDC discovery. The SpacetimeDB game instance shall not accept gameplay connections on any other basis.

**03-REQ-020**: A SpacetimeDB access token shall carry, at minimum, the following information:
- (a) the identifier of the game instance for which admission is granted (as the JWT `aud` claim);
- (b) a structured `sub` claim encoding the connection's identity kind and team binding: `"centaur:{centaurTeamId}"` for bot participants, `"operator:{operatorUserId}"` for operator participants, `"spectator:{spectatorUserId}"` for spectators, or `"coach:{coachUserId}:{centaurTeamId}"` for coach-mode read-only connections per [05-REQ-067];
- (c) an expiry time beyond which the token shall not be accepted.

**03-REQ-021**: SpacetimeDB shall validate each connection's JWT by verifying its RS256 signature against the platform's public key, obtained via OIDC discovery from the issuer URL. Validation occurs automatically at connection time via SpacetimeDB's built-in OIDC support; the `client_connected` lifecycle callback then reads the validated claims from `ctx.sender_auth().jwt()` and associates the connection with the team and role derived from the `sub` claim. The team and role association established at connection shall persist for the lifetime of that connection without further token re-checks, and subsequent expiry of the access token shall not cause an already-connected client to be disconnected.

**03-REQ-022**: The Convex platform runtime shall serve two HTTP actions at its stable `CONVEX_SITE_URL` (`.convex.site`) that implement OIDC discovery:
- (a) `GET /.well-known/openid-configuration` — returns `{ issuer: CONVEX_SITE_URL, jwks_uri: CONVEX_SITE_URL + "/.well-known/jwks.json" }`.
- (b) `GET /.well-known/jwks.json` — returns the RSA public key in JWK format.

This makes Convex a standards-compliant OIDC issuer. The RSA key pair is platform-wide (not per-game) — the same key signs all SpacetimeDB access tokens across all game instances. The private key is stored as a Convex environment variable; the public key is derived and served via the JWKS endpoint.

**03-REQ-023**: The SpacetimeDB game instance's `client_connected` callback shall reject any connection whose JWT:
- (a) fails RS256 signature verification against the platform's OIDC-published public key;
- (b) has an `aud` claim that does not match this instance's game ID (stored in the `game_config` table by `initialize_game`);
- (c) is presented after its `exp` time;
- (d) has a `sub` claim naming a team that is not registered as a participant of this game instance.

**03-REQ-024**: Operator participants shall obtain SpacetimeDB access tokens by calling a Convex endpoint authenticated by their human identity. The Convex runtime shall refuse to issue an operator access token unless the requesting human is, at the moment of the request, a member of a team registered to the target game.

**03-REQ-025**: Bot participants shall obtain SpacetimeDB access tokens by calling the same class of Convex endpoint authenticated by a per-Centaur-Team game credential. The Convex runtime shall refuse to issue a bot access token unless the game credential is valid and the credential's Centaur Team is registered to the target game.

**03-REQ-026**: **Spectator access tokens** shall be issuable by the Convex runtime to any authenticated human identity that requests to spectate a game, subject to any spectator eligibility rules owned by [08]. Spectator access tokens shall carry the spectator role via `sub: "spectator:{spectatorUserId}"`, shall not carry a team binding, and shall confer no move-staging privilege. They shall otherwise share the token format defined in 03-REQ-020.

**03-REQ-026a**: **Coach access tokens** shall be issuable by the Convex runtime to any authenticated human identity for which `isCoachOfTeam(callerUserId, centaurTeamId)` per [05-REQ-067] returns true on a participating team of an in-progress game. Coach access tokens shall carry the coach role via `sub: "coach:{coachUserId}:{centaurTeamId}"`, shall carry the bound team binding for the purpose of read-side row-level filtering ([04-REQ-019]), and shall confer no move-staging or other mutating privilege. They shall otherwise share the token format defined in 03-REQ-020. Issuance of coach tokens is owned by [05] §3.4 (`issueCoachAccessToken`).

**03-REQ-027**: SpacetimeDB access tokens for all roles (operator participant, bot participant, spectator) shall have a lifetime of **2 hours** from issuance. A token holder shall be able to obtain a replacement token before expiry without re-authenticating with Google OAuth (for operators) or re-obtaining a game credential (for bot participants), provided the underlying identity's credential is still valid. Because access tokens are validated only at connection time ([03-REQ-021]), the 2-hour lifetime governs the window within which a token can be used to establish or re-establish a connection — including reconnection after a network interruption during a game — and does not bound the lifetime of an already-connected client. The primary security boundary against post-game token use is the ephemeral SpacetimeDB instance's teardown ([02-REQ-021]) — once the instance is torn down, the token has nothing to authenticate against. Token expiry is a defense-in-depth measure against use of a leaked token during a long-running game. (See resolved 03-REVIEW-004.)

---

### 3.8 Authorization Semantics Inside a Game

**03-REQ-028**: A connection admitted to a SpacetimeDB game instance as a **human participant** for team T or as a **bot participant** for team T shall be authorized to stage moves for any snake belonging to team T, subject to [02-REQ-011] and the turn-resolution semantics of [01]. Staging discipline shall be determined by last-write-wins within the SpacetimeDB instance.

**03-REQ-029** *(negative)*: A connection admitted to a SpacetimeDB game instance shall not be authorized to stage, alter, or observe in a non-filtered manner any state belonging to a team other than the team it was admitted for, and spectators shall not be authorized to stage, alter, or observe-through-filtering any team's private state.

**03-REQ-030** *(negative)*: The SpacetimeDB game instance shall not be authoritative for, or hold any record of, which specific human within a team is operating which snake. Selection discipline ([02-REQ-018]) is enforced outside SpacetimeDB.

**03-REQ-031**: The SpacetimeDB game instance shall subject every admitted connection — including bot participants, human participants, and spectators — to the invisibility filter of [02-REQ-010] whenever the connection does not belong to the snake's owning team. Spectator connections shall be filtered on the same terms as opponent connections.

**03-REQ-032**: Each staged move recorded in the game's turn log (per [04], informal spec Section 14) shall carry a `stagedBy` attribution. Within the SpacetimeDB game instance, `stagedBy` shall hold an `Agent` value (as defined by [01]: `{kind: 'centaur_team', centaurTeamId}` for Centaur Server connections, or `{kind: 'operator', operatorUserId}` for operator-authenticated connections), resolved from the connecting client's JWT `sub` claim at `client_connected` time per [04-REQ-020]. SpacetimeDB turn-resolution logic shall not perform any further interpretation of or branching on the `Agent` value, consistent with [02-REQ-030]. (See resolved 03-REVIEW-005 and 04-REVIEW-011.)

**03-REQ-044**: The SpacetimeDB game instance shall, at the time of each `client_connected` callback, resolve the connecting client's JWT `sub` claim to an `Agent` value (bot connections with `sub: "centaur:{centaurTeamId}"` yield `{kind: 'centaur_team', centaurTeamId}`; operator connections with `sub: "operator:{operatorUserId}"` yield `{kind: 'operator', operatorUserId}`). Coach connections with `sub: "coach:{coachUserId}:{centaurTeamId}"` are bound to the named team for read-side row-level filtering ([04-REQ-019]) but yield no `Agent` value (coach connections do not stage moves). This resolved `Agent` shall be stored in the participant attribution record per [04-REQ-020] and used immediately as the `stagedBy` value for any moves staged by that connection. The participant attribution record shall be retained for the full duration of the game — including for connections that have since been closed or replaced by reconnection — so that historical `stagedBy: Agent` values remain consistent. (See resolved 03-REVIEW-005 and 04-REVIEW-011.)

**03-REQ-045**: When Convex persists the game record from the SpacetimeDB game instance at game end (per [02-REQ-022]), `stagedBy` fields in the serialized record already carry `Agent` values (resolved at connection time per [03-REQ-044] and [04-REQ-020]); no Identity-to-Agent resolution step occurs during serialization. The persisted game record shall not contain raw SpacetimeDB Identities in any `stagedBy` field. (See resolved 03-REVIEW-005 and 04-REVIEW-011.)

---

### 3.9 Platform HTTP API Authorization

**03-REQ-033**: The platform's HTTP API ([05], informal spec Section 12) shall authorize each request by a bearer API key presented in the request's authorization header. API keys shall be created by admin users only (per [05-REQ-045]) via the Snek Centaur Server web application and shall be revocable. (See resolved 05-REVIEW-004.)

**03-REQ-034**: API keys shall be stored by the platform only in a form from which the original key cannot be recovered (e.g., as a one-way hash). The plaintext of a newly created API key shall be shown to its creator exactly once, at creation time.

**03-REQ-035**: Each API key shall be bound to the human identity that created it (who must be an admin per [03-REQ-033]). Because API keys are restricted to admin users, the authorization scope of every valid API key is global (admin-level). (See resolved 05-REVIEW-004.)

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

**03-REQ-041**: The platform shall maintain separate signing material for per-Centaur-Team game credentials (Ed25519, used for Convex Auth) and for SpacetimeDB access tokens (RS256, used for OIDC-based SpacetimeDB authentication). Compromise of one signing key shall not compromise the other. (See resolved 03-REVIEW-007.)

**03-REQ-043** *(negative)*: Credential or key material shall not be transmitted over unauthenticated channels to any party other than its intended holder. The RS256 private key for signing SpacetimeDB access tokens shall never be transmitted outside the Convex runtime — only the public key is exposed via the OIDC JWKS endpoint. Per-Centaur-Team game credentials shall be transmitted only via the game invitation POST to the nominated server domain.

---

### 3.12 Convex Access to the SpacetimeDB Runtime

**03-REQ-048**: The Convex platform runtime shall be able to authenticate itself to the self-hosted SpacetimeDB platform for the purpose of provisioning and tearing down per-game instances ([02-REQ-020], [02-REQ-021]), and shall be able to authenticate itself to each provisioned SpacetimeDB game instance for the purpose of invoking privileged operations on that instance. The privileged operations that require such authentication include, at minimum: initialisation of the game at game start ([04-REQ-013]), registration of Convex as a subscriber to the instance's game-end notification mechanism ([04-REQ-061a]), and retrieval of the complete historical record at game end ([04-REQ-061]). Convex does not hold a live gameplay subscription to any SpacetimeDB game instance; live gameplay reads during play are performed by web clients directly ([02]) and do not require a Convex-held credential. Authentication shall be via a Convex self-issued JWT presented to the self-hosted SpacetimeDB management API — see Section 3.22 for the concrete mechanism.

---

## Design

### 3.13 Identity Model Implementation

Satisfies 03-REQ-001, 03-REQ-002, 03-REQ-003, 03-REQ-004, 03-REQ-005, 03-REQ-006, 03-REQ-049.

The platform recognizes exactly three identity kinds, each with a distinct representation in Convex:

**Human identities** (03-REQ-001, 03-REQ-002). Each human who authenticates via Google OAuth is represented by a record in the Convex `users` table. The canonical identifier is the Google email address. Convex Auth's Google OAuth provider populates the user record on first authentication; subsequent authentications with the same email are merged into the existing record (03-REQ-008). The `users` table is owned by [05]; this module specifies only the identity-relevant fields:

```typescript
interface HumanIdentityFields {
  readonly email: string
}
```

`userId` for a human user is the Convex `_id` of their `users` record (type `Id<'users'>`), cast to the branded `UserId` type (`string & { readonly __brand: 'UserId' }`). No separate allocation step is required — the `_id` is assigned by Convex when the record is created. Email is the canonical identity for all platform-level lookups (team membership, admin checks, API key ownership); `userId` is the stable, opaque identifier used in `Agent` values and `sub` claims within SpacetimeDB game instances.

**Centaur Team identities** (03-REQ-001, 03-REQ-003). Each Centaur Team is represented by a record in the Convex `centaur_teams` table. The canonical identifier is the Convex document `_id`. This `_id` is also the `centaurTeamId` used in `Agent` values — there is no separate numeric identifier. The `centaur_teams` table is owned by [05]; this module specifies only the identity-relevant fields:

```typescript
interface CentaurTeamIdentityFields {
  readonly _id: Id<'centaur_teams'>
  readonly nominatedServerDomain: string | null
}
```

`centaurTeamId` for a team is the Convex `_id` of its `centaur_teams` record (type `Id<'centaur_teams'>`), cast to the branded `CentaurTeamId` type (`string & { readonly __brand: 'CentaurTeamId' }`). No counter document or allocation step is needed.

**Game-participant identities** (03-REQ-004). Game-participant identities are derived, not stored as persistent records. They exist as the association between a SpacetimeDB connection and a team+role, established when the `client_connected` lifecycle callback parses the JWT `sub` claim (Section 3.17). Three roles exist:

| Role | Derived from | Agent value | Move staging |
|------|-------------|-------------|--------------|
| Operator participant | Human identity + team membership | `{kind: 'operator', operatorUserId}` | Yes (team-scoped) |
| Bot participant | Centaur Team identity (via game credential) | `{kind: 'centaur_team', centaurTeamId}` | Yes (team-scoped) |
| Spectator | Human identity (no team binding) | N/A (no move staging) | No |

**Elimination of "Centaur Server identity"** (03-REQ-049). Snek Centaur Servers have no persistent identity on the platform. A server domain is a configuration field on the Centaur Team record (`nominatedServerDomain`), not an identity. A server receives credentials only when invited to a game, and those credentials are scoped to a Centaur Team and game, not to the server itself.

**Identity kind discrimination** (03-REQ-005). In Convex function code, the identity kind is determined by inspecting the authenticated identity's token claims:

```typescript
type PlatformIdentity =
  | { readonly kind: 'human'; readonly email: string; readonly userId: UserId }
  | { readonly kind: 'centaur_team_credential'; readonly centaurTeamId: Id<'centaur_teams'>; readonly gameId: Id<'games'> }

function resolveIdentity(identity: UserIdentity): PlatformIdentity
```

The `resolveIdentity` helper inspects the `tokenIdentifier` prefix: identities from the Google OAuth provider carry the `email` claim and are resolved as `kind: 'human'` (with `userId` derived as `Id<'users'>` cast to `UserId`); identities from the custom JWT provider (Section 3.15) carry `centaurTeamId` and `gameId` claims and are resolved as `kind: 'centaur_team_credential'` (with the `centaurTeamId` claim value directly usable as the `CentaurTeamId` branded type — the Convex `_id` and the `Agent`-level identifier are identical). No identity can be ambiguous (03-REQ-005) because the two authentication providers produce disjoint claim shapes.

**No anonymous participants** (03-REQ-006). Every Convex mutation and query that reads or writes user-scoped state requires an authenticated identity. Every SpacetimeDB connection that stages moves must present a valid RS256-signed JWT at connection time, validated via OIDC and processed by the `client_connected` callback. There is no anonymous path.

---

### 3.14 Google OAuth Integration

Satisfies 03-REQ-007, 03-REQ-008, 03-REQ-009, 03-REQ-010.

**Convex Auth configuration** (03-REQ-007). The Convex deployment is configured with Convex Auth using the Google OAuth provider. The configuration requires a Google OAuth client ID and client secret stored as Convex environment variables (`AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET`). Convex Auth handles the OAuth flow (redirect to Google, callback handling, token exchange) and produces a persistent session stored client-side via Convex Auth's token mechanism.

**Session persistence** (03-REQ-007). Convex Auth sessions survive across browser page loads. The session token is stored in the browser's `localStorage` by the Convex Auth client library. The session remains valid until the user explicitly signs out or the session expires (Convex Auth's default session lifetime). No server-side session store is needed beyond Convex Auth's built-in token validation.

**Email as canonical identity** (03-REQ-008). When Google OAuth completes, Convex Auth provides the authenticated user's profile, which includes the email address. The platform uses this email as the sole identity attribute:

- If a `users` record with the same email already exists, the session is associated with that existing record (identity merge).
- If no record exists, a new `users` record is created with the email and a newly allocated `userId`.
- If a Google account's email changes at the provider, the new email is treated as a distinct human identity. The old email's identity retains all historical state (team memberships, action log entries, replays). There is no account migration path.

**No password storage** (03-REQ-009). The platform stores no passwords, password hashes, or shared secrets for human authentication. Google OAuth is the sole human authentication mechanism.

**Authentication prerequisite** (03-REQ-010). Every page in the Snek Centaur Server web application that reads or writes user-scoped Convex state requires a valid Convex Auth session, enforced by the Convex client's authentication state. Public read-only views (if any, as specified by [08]) are the sole exception.

---

### 3.15 Per-Centaur-Team Game Credential

Satisfies 03-REQ-057, 03-REQ-058, 03-REQ-059, 03-REQ-016, 03-REQ-017, 03-REQ-040, 03-REQ-041 (game credential signing).

This is the most architecturally significant design decision in the module. The per-Centaur-Team game credential must allow a Snek Centaur Server to authenticate to Convex on behalf of a specific Centaur Team for a specific game.

**Format: JWT with Ed25519 signature**. The credential is a standard JSON Web Token (JWT) signed with the Ed25519 algorithm (EdDSA). Ed25519 produces compact 64-byte signatures, supports fast verification, and is asymmetric — Convex Auth's `customJwt` provider validates tokens using only the public key, with the signing key kept off the validation path.

**Key management**. Convex holds an Ed25519 key pair:
- The private key is stored as a Convex environment variable (`GAME_CREDENTIAL_SIGNING_KEY`), base64-encoded.
- The public key is derived from the private key at runtime and configured in the Convex Auth `customJwt` provider as an inline JWK.
- A single key pair is used for all game credentials across all games. Per-game key rotation is unnecessary because each credential carries a `gameId` claim that Convex validates against the game's current status at every request — a credential for a finished game is rejected regardless of its cryptographic validity.

**JWT claims schema**:

```typescript
interface GameCredentialClaims {
  readonly iss: 'snek-centaur-platform'
  readonly aud: 'snek-centaur-platform'
  readonly sub: string
  readonly centaurTeamId: string
  readonly gameId: string
  readonly iat: number
  readonly exp: number
}
```

- `sub`: A composite subject string `"team:{centaurTeamId}:game:{gameId}"` that uniquely identifies this credential's scope.
- `centaurTeamId`: The Convex document ID of the Centaur Team (as a string). This value IS the `centaurTeamId` used in `Agent` values (`{kind: 'centaur_team', centaurTeamId}`) — the JWT claim and the `Agent` field are the same Convex `_id`.
- `gameId`: The Convex document ID of the game (as a string).
- `iat`: Issuance timestamp (Unix seconds).
- `exp`: Expiry timestamp. Set to `iat + 7200` (2 hours). The credential's primary temporal scoping comes from Convex checking `game.status === 'playing'` on every request — a request against a finished or not-started game is rejected regardless of JWT validity — and from STDB instance teardown at game end. The 2-hour `exp` is defense-in-depth, bounding leak exposure to a 2-hour window. (See resolved 05-REVIEW-012.)

**Convex Auth integration**. The Convex Auth configuration includes a `customJwt` provider named `"gameCredential"`. When a Snek Centaur Server presents the JWT as a bearer token via the Convex client, Convex Auth validates the signature against the configured public key and makes the claims available via `auth.getUserIdentity()`. The `resolveIdentity` helper (Section 3.13) detects game credentials by the presence of the `centaurTeamId` claim.

**Runtime validation beyond JWT verification**. JWT signature verification confirms the credential was issued by Convex. But Convex function code must additionally verify at every mutation/query:
1. The `gameId` references an existing game with `status === 'playing'`.
2. The `centaurTeamId` references a Centaur Team that is a participant in the game.
3. The requested operation is within the credential's authorized scope (centaur subsystem state for the team, or SpacetimeDB access token issuance for the team's bot participants).

These checks are implemented as a shared authorization helper used by every Convex function that accepts game credentials.

**Scope isolation** (03-REQ-016, 03-REQ-057). The `centaurTeamId` and `gameId` claims bind the credential to exactly one team and one game. Every Convex function that processes a game credential checks the calling identity's `centaurTeamId` against the resource being accessed. A credential issued for team A cannot access team B's state because the `centaurTeamId` in the JWT does not match team B's ID.

**Identity resolution** (03-REQ-017). When Convex function code receives a request authenticated by a game credential, `resolveIdentity()` returns `{kind: 'centaur_team_credential', centaurTeamId, gameId}`. This is structurally distinct from human identities, so no code path is obligated to handle an ambiguous identity kind.

**Independence of compromise** (03-REQ-041). The game credential signing key (Ed25519 private key, used for Convex Auth) is entirely separate from the SpacetimeDB access token signing key (RS256 private key, used for OIDC-based SpacetimeDB authentication). Compromise of one key does not compromise the other. Both keys are stored as Convex environment variables but serve distinct authentication boundaries: Ed25519 for Snek Centaur Server → Convex, RS256 for all clients → SpacetimeDB.

---

### 3.16 Game-Start Invitation Protocol

Satisfies 03-REQ-050, 03-REQ-051, 03-REQ-052, 03-REQ-053, 03-REQ-054, 03-REQ-055, 03-REQ-056, 03-REQ-012.

When a game transitions from `not-started` to `playing`, Convex orchestrates the game-start sequence. After freezing configuration, generating the board, and provisioning the SpacetimeDB instance (per [02] §2.14, [05]), Convex sends a game invitation to each participating Centaur Team's nominated server.

**Invitation delivery** (03-REQ-051, 03-REQ-052). Each invitation is an HTTP POST to `https://{nominatedServerDomain}/.well-known/snek-game-invite`. HTTPS is required; the platform does not send invitations over plain HTTP. DNS resolution is treated as sufficient proof of domain ownership — Convex is sending to the domain, not receiving credentials from it.

**Per-team invitations** (03-REQ-053). Each participating Centaur Team receives its own invitation POST, even if multiple teams nominate the same server domain. A server hosting teams A and B in the same game receives two separate POST requests, each carrying the respective team's game credential. This simplifies the server's invitation handler — each POST is self-contained and can be processed independently.

**Invitation payload**:

```typescript
interface GameInvitationPayload {
  readonly gameId: string
  readonly centaurTeamId: string
  readonly gameCredentialJwt: string
  readonly spacetimeDbUrl: string
  readonly spacetimeDbModuleName: string
  readonly gameConfig: GameConfig
  readonly centaurTeamRoster: ReadonlyArray<{
    readonly email: string
    readonly operatorUserId: string
  }>
}
```

- `gameCredentialJwt`: The per-Centaur-Team game credential JWT (Section 3.15). This is the credential the server uses to authenticate to Convex for the duration of the game.
- `centaurTeamId`: The Convex `_id` of the Centaur Team receiving this invitation. This value is the `centaurTeamId` used in `Agent` values (`{kind: 'centaur_team', centaurTeamId}`) — the payload field and the `Agent` field are the same string.
- `spacetimeDbUrl`: The URL of the provisioned SpacetimeDB instance.
- `spacetimeDbModuleName`: The module name for connecting to the SpacetimeDB instance.
- `gameConfig`: The frozen game configuration, so the server can configure its bot framework without querying Convex.
- `centaurTeamRoster`: The roster snapshot for this team, so the server knows which humans are authorized. Each `operatorUserId` is the Convex `_id` of the operator's `users` record (a string), included so the server can correlate roster entries with `Agent` values in game events.

**Game credential delivered only via invitation** (03-REQ-012). The invitation payload carries the game credential; no secret is exchanged with the Snek Centaur Server outside an active invitation.

**Accept/reject response contract** (03-REQ-054, 03-REQ-055):

```typescript
interface GameInvitationResponse {
  readonly accepted: boolean
  readonly reason?: string
}
```

The server responds with HTTP 200 and a JSON body. If `accepted` is `true`, the game proceeds for this team. If `accepted` is `false`, the optional `reason` is recorded in the game's error state. The reference implementation auto-accepts all invitations by default. Custom servers may reject based on a server-side configuration file that whitelists by player email or Centaur Team ID.

**Timeout and failure handling** (03-REQ-056). Convex waits up to **30 seconds** for each server's response. If any server rejects the invitation, fails to respond within the timeout, or returns a non-200 HTTP status, the game start fails:
- The SpacetimeDB instance is torn down.
- Any already-accepted invitations are effectively voided (the game credentials expire because the game returns to `not-started`).
- The game record returns to `not-started` with an error message identifying which server(s) declined or timed out.

Convex sends invitations to all participating servers concurrently (not sequentially) to minimize total latency. If any invitation fails, all are considered failed and the game does not start.

---

### 3.17 SpacetimeDB Connection Authentication via Convex-as-OIDC-Issuer

Satisfies 03-REQ-019, 03-REQ-020, 03-REQ-021, 03-REQ-022, 03-REQ-023, 03-REQ-024, 03-REQ-025, 03-REQ-026, 03-REQ-027.

**Architecture: Convex as OIDC issuer**. The platform uses a single RSA key pair to sign all SpacetimeDB access tokens. Convex serves two HTTP actions at its stable `CONVEX_SITE_URL` (`.convex.site`) that make it a standards-compliant OIDC issuer:

- `GET /.well-known/openid-configuration` — returns `{ issuer: CONVEX_SITE_URL, jwks_uri: CONVEX_SITE_URL + "/.well-known/jwks.json" }`.
- `GET /.well-known/jwks.json` — returns the RSA public key in JWK format.

SpacetimeDB is configured with this issuer URL. When a client connects with a JWT, SpacetimeDB fetches the OIDC discovery document, obtains the JWKS, and validates the JWT's RS256 signature automatically — no per-instance secret needs to be seeded, and no application-level signature verification is needed.

**Key management**. Convex holds an RSA key pair:
- The private key is stored as a Convex environment variable (`SPACETIMEDB_SIGNING_KEY`), PEM- or JWK-encoded.
- The public key is derived from the private key and served via the `/.well-known/jwks.json` endpoint.
- A single key pair is used for all SpacetimeDB access tokens across all games. Per-game key rotation is unnecessary because each token carries an `aud` claim that the `client_connected` callback validates against the instance's game ID — a token for game X cannot authorize a connection to game Y.

**Token format: RS256-signed JWT**. A SpacetimeDB access token is a standard JWT with the following claims:

```typescript
interface SpacetimeDbAccessTokenClaims {
  readonly iss: string
  readonly sub: string
  readonly aud: string
  readonly iat: number
  readonly exp: number
}
```

- `iss`: The `CONVEX_SITE_URL` (e.g., `"https://snek-centaur.convex.site"`). Must match the issuer URL configured in SpacetimeDB's OIDC settings.
- `sub`: A structured subject string encoding the connection's identity kind and binding:
  - Bot participants: `"centaur:{centaurTeamId}"` (e.g., `"centaur:jh72k4xq5c6m9"`), where `centaurTeamId` is the Convex `_id` of the `centaur_teams` record.
  - Operator participants: `"operator:{operatorUserId}"` (e.g., `"operator:k57xqm2n8a3p1"`), where `operatorUserId` is the operator's `users._id`.
  - Spectators: `"spectator:{spectatorUserId}"` (e.g., `"spectator:k57xqm2n8a3p1"`), where `spectatorUserId` is the spectator's `users._id`.
  - Coaches: `"coach:{coachUserId}:{centaurTeamId}"` (e.g., `"coach:k57xqm2n8a3p1:jh72k4xq5c6m9"`), where `coachUserId` is the coach's `users._id` and `centaurTeamId` is the `centaur_teams._id` being coached. The bound team determines the row-level read filter applied by SpacetimeDB views ([04-REQ-019]).
- `aud`: The game ID (Convex document `_id` as string). The `client_connected` callback validates this against the game ID stored in the instance's `game_config` table.
- `iat`: Issuance timestamp (Unix seconds).
- `exp`: Expiry timestamp. Set to `iat + 7200` (2 hours) (03-REQ-027).

**Four token flavors**:

| Flavor | `sub` prefix | Team binding | Agent derivation |
|--------|-------------|--------------|-----------------|
| Operator participant | `"operator:"` | Resolved from roster by operatorUserId | `{kind: 'operator', operatorUserId}` |
| Bot participant | `"centaur:"` | Resolved from roster by centaurTeamId | `{kind: 'centaur_team', centaurTeamId}` |
| Spectator | `"spectator:"` | None | N/A (no move staging) |
| Coach | `"coach:"` | Embedded in sub (`{coachUserId}:{centaurTeamId}`); validated against participating roster | N/A (no move staging; read-only) |

**Token issuance by Convex**:

- **Operator participant tokens** (03-REQ-024): Issued via a Convex action callable by authenticated humans. Convex verifies: (1) the caller has a valid Google OAuth session, (2) the caller's email is listed in the target game's roster for a participating team, (3) the game has `status === 'playing'`. If all checks pass, Convex constructs the claims with `sub: "operator:{operatorUserId}"` (where `operatorUserId` is the caller's `users._id`) and `aud: gameId`, signs with the RS256 private key, and returns the JWT.
- **Bot participant tokens** (03-REQ-025): Issued via a Convex action callable by game credential holders. Convex verifies: (1) the caller has a valid game credential, (2) the credential's `centaurTeamId` matches a team registered to the target game, (3) the game has `status === 'playing'`. If all checks pass, Convex constructs the claims with `sub: "centaur:{centaurTeamId}"` (where `centaurTeamId` is the `centaur_teams._id`) and `aud: gameId`, signs, and returns.
- **Spectator tokens** (03-REQ-026): Issued via a Convex action callable by authenticated humans. Convex verifies: (1) the caller has a valid Google OAuth session, (2) the game has `status === 'playing'`. Spectator eligibility rules beyond authentication are owned by [08]. The token carries `sub: "spectator:{spectatorUserId}"` (where `spectatorUserId` is the caller's `users._id`).
- **Coach tokens** (03-REQ-026a): Issued via a Convex action callable by authenticated humans. Convex verifies: (1) the caller has a valid Google OAuth session, (2) `isCoachOfTeam(callerUserId, centaurTeamId)` per [05-REQ-067] returns true (admins satisfy this implicitly per [05-REQ-066]), (3) the game has `status === 'playing'`, (4) the named `centaurTeamId` is a participating team of the game. The token carries `sub: "coach:{coachUserId}:{centaurTeamId}"`.

**Connection validation at SpacetimeDB** (03-REQ-021, 03-REQ-023). SpacetimeDB validates the JWT's RS256 signature against the OIDC-published public key automatically before invoking `client_connected`. The `client_connected` lifecycle callback then performs application-level checks:
1. Read `ctx.sender_auth().jwt()` to access the validated claims.
2. Verify `aud` matches this instance's game ID from the `game_config` table (03-REQ-023b). If mismatched, disconnect the client immediately.
3. Parse `sub` to extract the identity kind and binding (03-REQ-020b).
4. For `centaur:` and `operator:` prefixes: verify the team binding (by centaurTeamId or operatorUserId) matches a team in the participating roster (03-REQ-023d). For the `coach:` prefix: verify the embedded `centaurTeamId` is in the participating roster; the connection is admitted as a read-only coach connection bound to that team.
5. On success, write the `centaur_team_permissions` row associating this connection with its team and derived Agent.
6. On failure at any step, disconnect the client before any application state is touched.

**Connection-time-only validation** (03-REQ-021). Token validation occurs only at connection time. Once a client is connected and `client_connected` has written the `centaur_team_permissions` row, the team and role association persists for the lifetime of that connection without further token re-checks. Subsequent expiry of the access token does not cause disconnection of an already-connected client.

**`initialize_game` must complete before clients connect**. The `client_connected` callback reads the `game_config` table to validate `aud`, so the `initialize_game` reducer must have run and populated `game_config` before any client connections are accepted. This is ensured by the game-start orchestration order in [05]: Convex provisions and initializes the instance before issuing access tokens or sending game invitations.

**Token refresh** (03-REQ-027). A connected client whose token is approaching expiry can request a new token from Convex without re-authenticating with Google OAuth (for operators) or re-obtaining a game credential (for bots), provided the underlying session or credential is still valid. The new token is used only if the client needs to reconnect (e.g., after a network interruption). No in-band token refresh mechanism exists within SpacetimeDB — refresh is purely a Convex-side operation that produces a new JWT for potential future reconnection.

**2-hour expiry rationale** (03-REQ-027). The primary security boundary is the SpacetimeDB instance's teardown — once a game ends and the instance is torn down, any outstanding tokens have nothing to authenticate against. The 2-hour `exp` is defense-in-depth against leaked tokens during a long-running game. (See resolved 03-REVIEW-004.)

---

### 3.18 In-Game Authorization and Agent-Based Attribution

Satisfies 03-REQ-028, 03-REQ-029, 03-REQ-030, 03-REQ-031, 03-REQ-032, 03-REQ-044, 03-REQ-045.

**Agent derivation at connection time** (03-REQ-044; see resolved 04-REVIEW-011). When the `client_connected` callback processes a new connection's validated JWT claims, it immediately resolves the `sub` claim to an `Agent` value and stores the mapping in a participant attribution record:

```typescript
interface ParticipantAttributionRecord {
  readonly connectionIdentity: Identity
  readonly agent: Agent | null
  readonly centaurTeamId: string | null
  readonly role: 'operator' | 'bot' | 'spectator'
  readonly registeredAt: number
}
```

- For bot connections (`sub: "centaur:{centaurTeamId}"`): the centaurTeamId (a Convex `_id` string) is validated against the participating roster, then `agent = {kind: 'centaur_team', centaurTeamId: centaurTeamId as CentaurTeamId}`.
- For operator connections (`sub: "operator:{operatorUserId}"`): `agent = {kind: 'operator', operatorUserId}` directly from the parsed sub claim, where `operatorUserId` is the Convex `users._id` string.
- For spectator connections (`sub: "spectator:{spectatorUserId}"`): no `Agent` value is assigned (spectators do not stage moves).
- For coach connections (`sub: "coach:{coachUserId}:{centaurTeamId}"`): no `Agent` value is assigned (coaches do not stage moves), but the `centaurTeamId` is recorded on the participant attribution record so the SpacetimeDB row-level read filter ([04-REQ-019]) delivers the same per-team subscription view a member of that team would receive.

The `Agent` value is derived from the JWT `sub` claim at connection time, not from the SpacetimeDB connection Identity. The connection Identity is opaque and per-connection; the `Agent` is the stable, domain-meaningful attribution value.

**Participant attribution record retention** (03-REQ-044). The attribution record is retained for the full duration of the game instance. It is not deleted or mutated when the underlying connection is closed, whether by network interruption, client shutdown, or reconnection. A client that reconnects obtains a fresh connection Identity and a fresh attribution entry; previous entries remain intact. This ensures that historical `stagedBy: Agent` values from earlier turns remain consistent even after the staging connection has been replaced.

**Move staging authorization** (03-REQ-028, 03-REQ-029). The `stage_move` reducer checks the calling connection's team association (established at connection time by `client_connected`). A connection admitted for team T can stage moves for any snake belonging to team T. Staging for snakes belonging to other teams is rejected. Spectator connections cannot stage moves at all.

**`stagedBy` attribution flow** (03-REQ-032, 03-REQ-044):
1. At connection: JWT `sub` claim → `Agent` value stored in attribution record by `client_connected`.
2. At move staging: `stage_move` reducer looks up the calling connection's `Agent` from the attribution record and records it as `stagedBy` on the staged move.
3. At turn resolution: the `stagedBy: Agent` value is carried through to movement events without further interpretation.
4. At game end: the persisted game record already contains `Agent` values in all `stagedBy` fields — no serialization-time resolution step is needed (03-REQ-045).

**No SpacetimeDB-level interpretation of Agent** (03-REQ-032). SpacetimeDB's turn-resolution logic does not inspect, branch on, or interpret the `Agent` value in any way. It is treated as an opaque attribution tag that is written at staging time and read only by downstream consumers (replay viewer, action log cross-referencing). This preserves the spirit of [02-REQ-030]: SpacetimeDB has no concept of "which human" during gameplay.

**Selection discipline** (03-REQ-030). SpacetimeDB does not enforce which human within a team operates which snake. Selection discipline (at most one operator per snake, at most one snake per operator) is enforced by Convex per [02-REQ-017] and [02-REQ-018]. SpacetimeDB's authorization granularity is team-level only.

**Invisibility filtering** (03-REQ-031). All connections — operator participants, bot participants, and spectators — are subject to the invisibility filter of [02-REQ-010]. Spectator connections are filtered on the same terms as opponent connections (they see no invisible snakes from any team, since they have no team affiliation). The RLS implementation is owned by [04].

---

### 3.19 Admin Role Mechanism

Satisfies 03-REQ-060, 03-REQ-061, 03-REQ-062, 03-REQ-063, 03-REQ-064.

**Admin designation** (03-REQ-064). Admin accounts are designated by a Convex environment variable `ADMIN_EMAILS` containing a JSON-encoded array of Google email addresses:

```
ADMIN_EMAILS=["chris@example.com","admin2@example.com"]
```

**Admin check helper**:

```typescript
function isAdmin(email: string): boolean
```

This function reads the `ADMIN_EMAILS` environment variable, parses the JSON array, and checks membership. It is called by Convex queries and mutations that need to enforce admin-gated access.

**Admin capabilities** (03-REQ-061 through 03-REQ-063):
- Browse all Centaur Teams regardless of membership (03-REQ-061).
- See all games in history pages across all teams (03-REQ-062).
- Watch any replay including within-turn actions of any team, regardless of team membership (03-REQ-063).

These capabilities are enforced by Convex query functions that check `isAdmin(callerEmail)` and bypass the normal team-membership filters when the check passes. The admin role does not grant write access beyond what the admin would have as a normal user — it extends read access only. Admins also hold implicit coach permission for every Centaur Team per [05-REQ-067], so the same `isAdmin(email)` check is consulted by live-game read-authorization paths in [05] and [06] to grant cross-team visibility into in-progress games.

---

### 3.20 Read-Access Principle

Satisfies 03-REQ-065, 03-REQ-066, 03-REQ-067.

**Identity-only read access** (03-REQ-065, 03-REQ-066). A user's read access to Convex data is determined entirely by their Google identity (the email address in their Convex Auth session). No Convex query checks or conditions on the domain of the Snek Centaur Server from which the request originates. Because every Snek Centaur Server serves the same open-source web application backed by the same single Convex deployment ([02-REQ-002]), a user who authenticates on server A sees identical platform data as when authenticating on server B.

**Enforcement**. Convex query functions that return user-scoped data (team membership, game history, replays, centaur subsystem state) check only the authenticated user's email (and, for admin users, the `isAdmin()` check from Section 3.19). They do not accept or inspect any parameter that identifies the requesting Snek Centaur Server. The Convex Auth session carries no server-origin claim; the session token is issued by Convex and validated by Convex, with no intermediary.

**Trust implication** (03-REQ-067). A malicious Snek Centaur Server could inject client-side JavaScript that, once a user logs in, reads any Convex data the user is authorized to see and exfiltrates it to a third party. This is an accepted trust trade-off: users should only log into servers they trust, similar to logging into any web application that accesses a backend API on behalf of the user. The platform cannot prevent this exfiltration because the Snek Centaur Server serves the client-side code that mediates the user's Convex session. The mitigation is social: the reference Snek Centaur Server (e.g., snek-centaur.cyphid.org) is operated by a trusted party, and users choosing alternative servers accept the trust relationship with that server's operator.

The platform's architecture decouples server operation from platform security — all security invariants that protect game integrity (move authorization, SpacetimeDB access tokens, credential scoping) are enforced at the Convex and SpacetimeDB level, not by the Snek Centaur Server. Server trust matters only for read access — a malicious server cannot stage moves, modify game state, or impersonate another team because those operations require credentials the server does not hold outside of an active game invitation.

---

### 3.21 API Key System

Satisfies 03-REQ-033, 03-REQ-034, 03-REQ-035, 03-REQ-036.

**Key generation** (03-REQ-034). When an authenticated human creates an API key via the Snek Centaur Server web application:
1. Convex generates a 32-byte cryptographically random value using `crypto.getRandomValues()`.
2. The raw bytes are encoded as a base64url string prefixed with `snk_` to produce the plaintext API key (e.g., `snk_dGhpcyBpcyBhIHRlc3Qga2V5...`). The prefix aids identification when keys appear in logs or configuration files.
3. The plaintext key is returned to the user exactly once, at creation time.

**One-way hash storage** (03-REQ-034). Convex computes `SHA-256(plaintext_key)` and stores only the hash in the `api_keys` table. The plaintext is never persisted. The `api_keys` table record includes:

```typescript
interface ApiKeyRecord {
  readonly _id: Id<'api_keys'>
  readonly keyHash: string
  readonly ownerEmail: string
  readonly ownerId: Id<'users'>
  readonly label: string
  readonly createdAt: number
  readonly revokedAt: number | null
}
```

**Bearer token validation** (03-REQ-033). HTTP API requests include the API key in the `Authorization: Bearer snk_...` header. The Convex HTTP action handler:
1. Extracts the bearer token from the header.
2. Computes `SHA-256(token)`.
3. Looks up the hash in the `api_keys` table.
4. Rejects if not found, or if `revokedAt` is non-null.
5. If valid, resolves the `ownerEmail` to load the owner's identity for authorization checks.

**Scope binding** (03-REQ-035). Because API keys are restricted to admin users (03-REQ-033), every valid API key has global (admin-level) authorization scope. The HTTP API handler verifies that the key's creator is still an admin on each request; if the creator has been removed from the admin list, the key is effectively non-functional. (See resolved 05-REVIEW-004.)

**API keys do not authorize identity creation or OAuth actions** (03-REQ-036). API keys cannot create new user accounts (which requires Google OAuth) or perform any action that inherently requires an interactive OAuth flow.

**Revocation**. An API key is revoked by setting `revokedAt` to the current timestamp. Revocation is immediate — subsequent requests with the revoked key are rejected. The key record is retained (not deleted) for audit purposes.

---

### 3.22 Identity Mapping Across Runtimes and Credential Management

Satisfies 03-REQ-037, 03-REQ-038, 03-REQ-039, 03-REQ-046, 03-REQ-047, 03-REQ-040, 03-REQ-041, 03-REQ-043, 03-REQ-048.

**Convex as sole credential issuer** (03-REQ-037). All credentials that grant access to any runtime originate from Convex:
- Google OAuth sessions: mediated by Convex Auth.
- Per-Centaur-Team game credentials: Ed25519-signed JWTs issued by Convex (Section 3.15).
- SpacetimeDB access tokens: RS256-signed JWTs issued by Convex, validated via OIDC (Section 3.17).
- API keys: generated and validated by Convex (Section 3.21).
- Game-outcome callback tokens: RS256-signed JWTs issued by Convex at game provisioning time, scoped to a specific game and callback URL, stored in the STDB instance's `game_config` table for authenticating the game-end notification POST back to Convex (Section 3.17 key material; validated by Convex on receipt).

Neither SpacetimeDB nor any Snek Centaur Server issues credentials that any other runtime accepts.

**Team identity consistency across runtimes** (03-REQ-038). Each Centaur Team has a Convex document `_id` which serves as both the team's canonical identifier and the `centaurTeamId` used in `Agent` values within SpacetimeDB. When a SpacetimeDB game instance is seeded, the team roster includes this `_id` as the team identifier. The same string appears in the SpacetimeDB access token `sub` claim (e.g., `"centaur:{centaurTeamId}"`) and in `Agent` values (`{kind: 'centaur_team', centaurTeamId}`). Per [02-REQ-004], SpacetimeDB instances are isolated, so there is no risk of ID collision across games.

**Game-time roster freeze** (03-REQ-039, 03-REQ-046, 03-REQ-047). At game initialization, Convex snapshots the participating teams' rosters (member emails and `operatorUserId` values, which are Convex `users._id` strings) and provides this snapshot to the SpacetimeDB instance via `initialize_game`. This snapshot is binding for the full duration of the game:

- **Freeze enforcement** (03-REQ-046): While a game involving a Centaur Team has `status === 'playing'`, Convex rejects mutations to that team's roster — member additions, member removals, and changes to `nominatedServerDomain`. The enforcement is implemented as a precondition check in the relevant Convex mutations: before modifying a team's roster, check whether the team participates in any game with `status === 'playing'`; if so, reject the mutation with an error explaining the freeze.
- **Historical preservation** (03-REQ-047): The roster snapshot is stored as part of the game record (in the `game_teams` table per [05]). Post-game roster edits do not retroactively alter historical records. A human removed from a team after a game retains their attribution in that game's persisted record.

**Separate signing material** (03-REQ-040, 03-REQ-041). The platform maintains two independent categories of signing material:

1. **Game credential signing**: A single Ed25519 key pair (Section 3.15). The private key is stored as a Convex environment variable (`GAME_CREDENTIAL_SIGNING_KEY`). Used to sign per-Centaur-Team game credential JWTs, verified by Convex Auth's `customJwt` provider.
2. **SpacetimeDB access token signing**: A single RSA key pair (Section 3.17). The private key is stored as a Convex environment variable (`SPACETIMEDB_SIGNING_KEY`). The public key is exposed via the OIDC JWKS endpoint. Used to sign SpacetimeDB access tokens, verified by SpacetimeDB's built-in OIDC support.

Compromise of the Ed25519 private key would allow an attacker to forge game credentials (and thus authenticate to Convex as any team), but would not allow forging SpacetimeDB access tokens (because the RSA key is independent). Conversely, compromise of the RSA private key would allow forging SpacetimeDB access tokens for any game instance, but would not allow authenticating to Convex as a team (because the Ed25519 private key is separate). This satisfies the independence-of-compromise invariant of 03-REQ-041.

**Secure credential transmission** (03-REQ-043).
- The RS256 private key for signing SpacetimeDB access tokens never leaves the Convex runtime. Only the public key is exposed, via the OIDC JWKS endpoint.
- Game credential JWTs are transmitted only from Convex to the nominated server domain, via the game invitation POST over HTTPS.
- SpacetimeDB access tokens are transmitted only from Convex to the requesting client (operator browser or Snek Centaur Server), via authenticated Convex endpoints.
- Game-outcome callback tokens are transmitted from Convex to the STDB instance via the `initialize_game` reducer call over the authenticated management API connection. The token is stored in `game_config` (a private, non-subscribed table) and presented back to Convex as a Bearer token in the game-end notification POST over HTTPS.
- No credential material is transmitted over unauthenticated channels.

**Convex-to-SpacetimeDB authentication** (03-REQ-048). The platform uses a **self-hosted SpacetimeDB instance**, whose HTTP management API supports externally-issued JWTs for authentication.

Convex authenticates to the self-hosted SpacetimeDB management API using a **Convex self-issued JWT** — specifically, an RS256-signed JWT generated by Convex using the same `SPACETIMEDB_SIGNING_KEY` private key already held for game participant tokens (Section 3.17), or a dedicated operator key pair if the self-hosted SpacetimeDB instance's management API is configured with a separate trusted issuer. The management JWT carries:
- `iss`: The `CONVEX_SITE_URL` (Convex as issuer, consistent with its role as the platform's OIDC issuer).
- `sub`: A platform-internal identifier designating the Convex runtime as the authorized operator (e.g., `"platform:convex-runtime"`).
- `aud`: The management API endpoint URL of the self-hosted SpacetimeDB instance.
- `exp`: Short-lived (e.g., 5 minutes), sufficient only for the duration of the management operation.

This JWT is presented to the self-hosted SpacetimeDB management API for all privileged operations: module provisioning, instance teardown, `initialize_game` reducer invocation, and historical record retrieval. The self-hosted SpacetimeDB instance is configured to accept and validate JWTs from the Convex OIDC issuer for management operations.

The management JWT and signing key:
1. Are stored as Convex environment variables (never persisted elsewhere).
2. Are not shared with any Snek Centaur Server or web client.
3. Grant access only to the privileged management operations listed above.
4. A dedicated management signing key pair (separate from `SPACETIMEDB_SIGNING_KEY`) is preferred operationally, to minimize the blast radius of key compromise. If a shared key is used as a bootstrap simplification, it should be separated before production deployment.

---

## Exported Interfaces

This section is the minimal contract module 03 exposes to downstream modules. Any type not listed here is a module-internal detail and may change without a version bump.

### 4.1 Identity Types

Motivated by 03-REQ-001, 03-REQ-002, 03-REQ-003, 03-REQ-004, 03-REQ-005, 03-REQ-049.

```typescript
type PlatformIdentity =
  | { readonly kind: 'human'; readonly email: string; readonly userId: UserId }
  | { readonly kind: 'centaur_team_credential'; readonly centaurTeamId: string; readonly gameId: string }

function resolveIdentity(identity: UserIdentity): PlatformIdentity
```

`UserId` and `CentaurTeamId` are re-exported from Module 01 (Section 3.1); both are string-based branded types. `UserIdentity` is Convex Auth's identity type returned by `auth.getUserIdentity()`. Note that `centaurTeamId` and `gameId` are exported as `string` (not `Id<'centaur_teams'>` / `Id<'games'>`) because the exported interface is runtime-agnostic — Convex-internal code casts to `Id<T>` at the call site. For `kind: 'centaur_team_credential'`, the `centaurTeamId` claim value is directly usable as `CentaurTeamId` for `Agent` construction.

Downstream modules use `resolveIdentity()` in every Convex function that needs to distinguish human callers from game-credential-authenticated callers. The discriminant is `kind`.

**DOWNSTREAM IMPACT**: [05] must call `resolveIdentity()` in every mutation/query that accepts both human and game-credential authentication. [06] must call it in Centaur subsystem mutations to verify the caller is the correct team's game credential.

### 4.2 Game Credential Types

Motivated by 03-REQ-057, 03-REQ-058, 03-REQ-059, 03-REQ-016, 03-REQ-017.

```typescript
interface GameCredentialClaims {
  readonly iss: 'snek-centaur-platform'
  readonly aud: 'snek-centaur-platform'
  readonly sub: string
  readonly centaurTeamId: string
  readonly gameId: string
  readonly iat: number
  readonly exp: number
}

function issueGameCredential(centaurTeamId: string, gameId: string): string
```

`issueGameCredential` is a Convex-internal function (not an HTTP endpoint). It constructs and signs the JWT. Called by [05]'s game-start orchestration logic. The `exp` claim is set to `iat + 7200` (2 hours) as a defensive upper bound; the effective credential lifetime is bounded to the game's `playing` status per 03-REQ-058 — Convex rejects all requests against non-playing games regardless of JWT validity. (See resolved 05-REVIEW-012.)

**DOWNSTREAM IMPACT**: [05] calls `issueGameCredential()` during game-start orchestration to generate the credential included in each team's game invitation payload.

### 4.3 SpacetimeDB Access Token Types

Motivated by 03-REQ-019, 03-REQ-020, 03-REQ-021, 03-REQ-022, 03-REQ-023, 03-REQ-024, 03-REQ-025, 03-REQ-026, 03-REQ-027.

```typescript
interface SpacetimeDbAccessTokenClaims {
  readonly iss: string
  readonly sub: string
  readonly aud: string
  readonly iat: number
  readonly exp: number
}

function issueSpacetimeDbAccessToken(
  gameId: string,
  sub: string
): string

function parseSubClaim(sub: string): 
  | { readonly kind: 'centaur_team'; readonly centaurTeamId: string }
  | { readonly kind: 'operator'; readonly operatorUserId: UserId }
  | { readonly kind: 'spectator'; readonly spectatorUserId: UserId }
  | { readonly kind: 'coach'; readonly coachUserId: UserId; readonly centaurTeamId: string }
```

`issueSpacetimeDbAccessToken` is a Convex-internal function (action, not query — requires crypto signing). It constructs and RS256-signs the JWT with `iss: CONVEX_SITE_URL`, `aud: gameId`, `sub`, `iat`, and `exp: iat + 7200`. Called by [05]'s access-token-issuance endpoints. No per-game secret parameter is needed — the function reads the RSA private key from the `SPACETIMEDB_SIGNING_KEY` environment variable.

`parseSubClaim` is a pure function that belongs in the shared codebase. It parses the structured `sub` string (e.g., `"centaur:jh72k4xq5c6m9"`, `"operator:k57xqm2n8a3p1"`, `"spectator:k57xqm2n8a3p1"`) into a discriminated union. The `sub` prefix `"centaur:"` maps to `kind: 'centaur_team'` (the prefix is kept short for the wire format while the discriminant uses the full conceptual name). The role-qualified id field on each variant (`operatorUserId`, `spectatorUserId`, `coachUserId`) holds the `users._id` cast to `UserId`; for `centaur_team`, `centaurTeamId` holds the `centaur_teams._id`. Used by the `client_connected` callback in [04] to determine the connection's identity kind and team binding.

**DOWNSTREAM IMPACT**: [04] must call `parseSubClaim()` in the `client_connected` callback to interpret the JWT `sub` claim and derive the connection's team and role. [05] must call `issueSpacetimeDbAccessToken()` in the access-token-issuance endpoints.

### 4.4 Agent Derivation Contract

Motivated by 03-REQ-044, 03-REQ-045, 03-REQ-032, 04-REQ-020.

```typescript
function deriveAgentFromSubClaim(
  parsed: ReturnType<typeof parseSubClaim>,
  rosterValidation: (centaurTeamId: string) => boolean
): Agent | null
```

For `kind === 'centaur_team'`: calls `rosterValidation(parsed.centaurTeamId)` to confirm the team is a registered participant (returns `false` if not found, triggering connection rejection per 04-REQ-022), then returns `{kind: 'centaur_team', centaurTeamId: parsed.centaurTeamId as CentaurTeamId}`. For `kind === 'operator'`: returns `{kind: 'operator', operatorUserId: parsed.operatorUserId}`. For `kind === 'spectator'`: returns `null` (no move staging). For `kind === 'coach'`: calls `rosterValidation(parsed.centaurTeamId)` to confirm the bound team is a registered participant (rejection on miss per 04-REQ-022), then returns `null` (no move staging). The `Agent` type is re-exported from Module 01 (Section 3.1).

This function is called by the `client_connected` callback in SpacetimeDB ([04]) to produce the `Agent` value stored in the participant attribution record. The `rosterValidation` callback reads the participating-team roster (seeded by `initialize_game`) to confirm that `centaurTeamId` is a registered participant.

**DOWNSTREAM IMPACT**: [04] must call `deriveAgentFromSubClaim()` in `client_connected` and store the result in the participant attribution record. The `Agent` value is then used as `stagedBy` for all moves staged by that connection, with no further resolution needed at serialization time.

### 4.5 Admin Role Interface

Motivated by 03-REQ-060, 03-REQ-061, 03-REQ-062, 03-REQ-063, 03-REQ-064.

```typescript
function isAdmin(email: string): boolean
```

Reads the `ADMIN_EMAILS` environment variable (JSON array of email strings) and returns `true` if the given email is in the list. Called by Convex queries/mutations that enforce admin-gated access.

**DOWNSTREAM IMPACT**: [05] must call `isAdmin()` in queries that serve team browsing, game history, replay access, and live-game cross-team reads (where admin holds implicit coach permission per [05-REQ-067]) to bypass normal team-membership filters for admin users.

### 4.6 API Key Validation Interface

Motivated by 03-REQ-033, 03-REQ-034, 03-REQ-035.

```typescript
interface ValidatedApiKey {
  readonly ownerEmail: string
  readonly ownerId: string
}

function validateApiKey(bearerToken: string): ValidatedApiKey | null
```

Computes `SHA-256(bearerToken)`, looks up the hash in the `api_keys` table, and returns the owner's identity if found and not revoked; returns `null` otherwise.

**DOWNSTREAM IMPACT**: [05] must call `validateApiKey()` in every HTTP API action handler to authenticate the caller. The returned `ownerEmail` is used for authorization scope checks.

### 4.7 Game-Start Invitation Types

Motivated by 03-REQ-050, 03-REQ-051, 03-REQ-053, 03-REQ-054, 03-REQ-055, 03-REQ-056.

```typescript
interface GameInvitationPayload {
  readonly gameId: string
  readonly centaurTeamId: string
  readonly gameCredentialJwt: string
  readonly spacetimeDbUrl: string
  readonly spacetimeDbModuleName: string
  readonly gameConfig: GameConfig
  readonly centaurTeamRoster: ReadonlyArray<{
    readonly email: string
    readonly operatorUserId: string
  }>
}

interface GameInvitationResponse {
  readonly accepted: boolean
  readonly reason?: string
}
```

`GameConfig` is re-exported from Module 01 (Section 3.3). `centaurTeamId` is used directly as the `CentaurTeamId` in `Agent` values (`{kind: 'centaur_team', centaurTeamId}`) — it is the Convex `centaur_teams._id` string. `operatorUserId` in the roster is the Convex `users._id` string of an operator (team member).

**DOWNSTREAM IMPACT**: [05] must construct `GameInvitationPayload` during game-start orchestration and send it via HTTP POST to each team's `/.well-known/snek-game-invite` endpoint. [08] must implement the `/.well-known/snek-game-invite` endpoint handler that receives this payload and returns a `GameInvitationResponse`.

### 4.8 Roster Freeze Contract

Motivated by 03-REQ-039, 03-REQ-046, 03-REQ-047.

Exported as an architectural constraint, not a runtime type:

- While any game involving a Centaur Team has `status === 'playing'`, mutations to that team's roster (member additions, removals, server domain changes) are rejected by Convex.
- The roster snapshot taken at game initialization is stored in the game record and is immutable for the lifetime of the game record.
- Post-game roster edits do not alter historical game records.

**DOWNSTREAM IMPACT**: [05] must implement the roster-freeze precondition check in team mutation functions. [05] must store the roster snapshot in the game record (e.g., in the `game_teams` table).

### 4.9 Credential Independence Invariant

Motivated by 03-REQ-040, 03-REQ-041.

Exported as an architectural constraint:

- Game credential signing material (Ed25519 key pair) and SpacetimeDB access token signing material (RSA key pair) are independent. Compromise of one does not compromise the other.
- Game credential signing uses a single platform-wide Ed25519 key pair stored as a Convex environment variable (`GAME_CREDENTIAL_SIGNING_KEY`).
- SpacetimeDB access token signing uses a single platform-wide RSA key pair stored as a Convex environment variable (`SPACETIMEDB_SIGNING_KEY`), with the public key exposed via the OIDC JWKS endpoint.

**DOWNSTREAM IMPACT**: [04] must configure SpacetimeDB to validate JWTs via the Convex OIDC issuer URL and implement the `client_connected` callback to read validated JWT claims. [05] must serve the OIDC discovery endpoints and sign access tokens with the RSA private key.

### 4.10 DOWNSTREAM IMPACT Notes

1. **[04] must implement `client_connected` with JWT claim validation.** The `client_connected` lifecycle callback must read `ctx.sender_auth().jwt()`, verify `aud` matches the instance's game ID from `game_config`, parse `sub` via `parseSubClaim()`, validate the team binding against the participating roster, call `deriveAgentFromSubClaim()` to produce the `Agent` value, and write the participant attribution record (`centaur_team_permissions` row). On any validation failure, the callback must disconnect the client immediately.

2. **[04] must enforce role-based capabilities.** Spectator connections (identified by `sub` prefix `"spectator:"`) and coach connections (identified by `sub` prefix `"coach:"`) must not be allowed to call `stage_move`, `declare_turn_over`, or any other state-mutating reducer. Only `operator` and `centaur` role connections may stage moves, and only for their admitted team's snakes. Coach connections receive the same per-team filtered read view as a member of their bound team per [04-REQ-019].

3. **[05] must orchestrate game-start credential issuance.** During the `not-started → playing` transition, [05] must: (a) provision the SpacetimeDB instance, (b) call `initialize_game` with the game state, parameters, and team roster, (c) issue a game credential JWT per team via `issueGameCredential()`, (d) send game invitations with the credentials to each team's nominated server, (e) wait for all acceptances before declaring the game started.

4. **[05] must implement SpacetimeDB access token issuance endpoints.** Convex must expose action endpoints for operators and game-credential holders to obtain SpacetimeDB access tokens. These endpoints call `issueSpacetimeDbAccessToken()` after performing authorization checks (roster membership for operators, credential validity for bots, game status for all).

5. **[05] must serve the OIDC discovery endpoints.** Convex must serve `GET /.well-known/openid-configuration` and `GET /.well-known/jwks.json` as HTTP actions at `CONVEX_SITE_URL`, exposing the RSA public key used for SpacetimeDB JWT validation.

6. **[05] must enforce the roster freeze.** Team roster mutations must be rejected while any game involving the team has `status === 'playing'`. The freeze covers member additions, member removals, and `nominatedServerDomain` changes.

7. **[05] must store the roster snapshot in the game record.** The snapshot includes each team's members (email, `operatorUserId`) and the team's `centaurTeamId` (its Convex `_id`). This snapshot is the binding authorization state for the game's duration and the historical attribution record after the game ends.

8. **[06] must verify game credential scope.** Centaur subsystem mutations that accept game credentials must verify the credential's `centaurTeamId` matches the team whose state is being modified. This prevents a credential issued for team A from modifying team B's state.

9. **[08] must implement the `/.well-known/snek-game-invite` endpoint.** The Snek Centaur Server must handle incoming invitation POSTs, store the received game credential, and return an accept/reject response. The reference implementation auto-accepts by default.

### 4.11 Cross-Module Naming Invariants

The following naming conventions apply across all modules. (See resolved 03-REVIEW-011.)

- **`CentaurTeamId`** (not `CentaurId` or `CentaurTeamDocId`): The single branded type for Centaur Team identifiers across all modules. Always refers to a Centaur Team's Convex `centaur_teams._id`. It is a string, never a number.
- **`UserId`**: The branded type for human operator identifiers. Always refers to a human user's Convex `users._id`.
- **`Agent` discriminant values**: `kind: 'centaur_team'` (not `kind: 'centaur'`) with field `centaurTeamId`, and `kind: 'operator'` with field `operatorUserId`.
- **`sub` claim wire format**: The `sub` prefix for bot participants remains `"centaur:"` (short form for the wire protocol); `parseSubClaim` maps this to `kind: 'centaur_team'` internally.

Modules [05]–[09] must use these names consistently.

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

**Decision**: B with concrete numbers. SpacetimeDB access tokens of every role expire **2 hours** after issuance. Per-Centaur-Team game credentials have lifetimes bounded to the game (they expire when the game ends). Access token validation is also clarified as connection-time-only (no periodic re-validation of established connections).
**Rationale**: The primary security boundary against post-game token use is the ephemeral SpacetimeDB instance's teardown ([02-REQ-021]) — once the instance is torn down, the token has nothing to authenticate against, so token expiry is not the mechanism that ends access after a game. Token expiry serves as defense-in-depth: if a token is leaked during a long-running game, the 2-hour window bounds the exposure. A 2-hour lifetime is generous enough that reconnection during even unusually long games does not require a token refresh, while still providing a meaningful bound against leaked tokens. The earlier 15-minute rationale (3× nominal game duration) is superseded — it was grounded in the assumption that token expiry was the primary access-termination mechanism, which it is not; instance teardown is.
**Affected requirements/design elements**: 03-REQ-021 (clarified as connection-time-only validation with connection-persists semantics), 03-REQ-027 (access token lifetime set to 2 hours with defense-in-depth rationale), 03-REQ-058 (game credential lifetime bounded to game).

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

**Decision**: A, with a refinement that resolves the tension with 02-REQ-030. Within SpacetimeDB's working state, `stagedBy` holds only an opaque SpacetimeDB connection Identity; SpacetimeDB does not read or branch on it. The mapping from Identity back to email (for humans) or Centaur Team reference (for bot participants) lives in the `centaur_team_permissions` table, which is populated from admission-ticket contents on each `register` call and retained for the lifetime of the game. Resolution from Identity to email/Centaur Team reference happens at a single boundary: serialization of the game record to Convex at game end.
**Rationale**: This preserves the letter and spirit of 02-REQ-030 — SpacetimeDB's runtime logic has no concept of "which human" during gameplay; it just records opaque Identities. The act of interpretation is isolated to the moment the game record crosses the boundary into Convex, where email-based attribution is meaningful. Retaining the `centaur_team_permissions` mapping across reconnections is necessary because an old `stagedBy` Identity from turn 10 may refer to a connection that was closed and replaced by minute 4, and the game-end serialization still needs to resolve it. Raw Identities must not appear in the persisted game record, so that downstream consumers (replay viewer, action log cross-referencing) have uniform shapes to work against.
**Affected requirements/design elements**: 03-REQ-032 rewritten to state the opaque-Identity semantics within SpacetimeDB and the no-interpretation constraint. Added 03-REQ-044 (SpacetimeDB maintains the mapping in `centaur_team_permissions` for the game's duration, including across reconnections). Added 03-REQ-045 (Convex-side serialization resolves `stagedBy` to email or Centaur Team reference; persisted records contain no raw Identities).

**Superseding amendment (per 04-REVIEW-011 resolution)**: The original decision above — that `stagedBy` holds an opaque Identity within STDB and resolution happens at game-end serialization — has been superseded. The resolution boundary has shifted: the SpacetimeDB connection Identity is now resolved to an `Agent` value (per [01-REVIEW-011]) **at connection time** (in the `client_connected` callback), using JWT `sub` claim contents available at that moment. As a result, `stagedBy` fields stored in STDB already carry `Agent | null`, not opaque Identities, and no serialization-time mapping pass is needed. 03-REQ-032, 03-REQ-044, and 03-REQ-045 have been updated to reflect this shift. The spirit of the original decision is preserved — SpacetimeDB's turn-resolution logic still does not interpret or branch on the attribution value — but the Identity→Agent translation now occurs at the connection boundary rather than the serialization boundary.

---

### 03-REVIEW-006: Membership changes mid-game — **RESOLVED**

**Type**: Ambiguity
**Phase**: Requirements
**Context**: 03-REQ-039 states that game authorization state is snapshot at initialization time and not retroactively changed by later membership edits. The informal spec does not address the case where a human is removed from a team mid-game or added to one during a game. This is a policy question with implications for admission-ticket issuance: if a human is removed from team T at turn 30, does their previously obtained admission ticket still work until expiry, or is the `centaur_team_permissions` snapshot in SpacetimeDB the binding source?
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
**Context**: 03-REQ-041 elevates the implementation pattern described in the informal spec — separate signing material for game credentials (Ed25519, so Convex Auth can validate them) and for SpacetimeDB access tokens (RS256, validated via OIDC) — to a requirements-level invariant about independence of compromise. This is a proposed addition, not explicit in the informal spec. The justification is defense-in-depth: if either scheme is broken, the other continues to function.
**Question**: Is the independence-of-compromise invariant an intended architectural commitment, or is it an inference from an implementation choice that should not be locked in at the requirements level?
**Options**:
- A: Keep as a requirement — architectural invariant worth preserving. (Current draft.)
- B: Drop from Requirements; describe the scheme choice in Design only.
**Informal spec reference**: §3, "Centaur Server Authentication" and "SpacetimeDB Admission Tickets".

**Decision**: A. Independence of compromise between the game credential signing scheme (Ed25519) and the SpacetimeDB access token signing scheme (RS256) is an intended architectural invariant.
**Rationale**: Elevating this to a requirement means a future design change that (for example) unified the two signing paths under a single key would be visible as a requirements violation rather than slipping in as an implementation simplification. The inconvenience of carrying this as a requirement is small; the cost of losing defense-in-depth silently is large.
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
**Context**: 03-REQ-026 permits any authenticated operator to obtain a spectator SpacetimeDB access token, deferring eligibility rules to [08]. The informal spec §8.5 says "Any authenticated user can spectate a game in progress" but does not address private games, room-level visibility settings, or abuse (a single operator requesting thousands of spectator tokens). This may be adequately covered by [08]; flagging to ensure it is not silently dropped between modules.
**Question**: Does any spectator access restriction belong in [03] (e.g., per-operator rate limit on access token issuance), or is all of it [08]'s concern?
**Options**:
- A: All spectator-access policy lives in [08]; [03] only defines the token mechanism. (Current draft.)
- B: [03] owns at least a rate-limit or abuse-prevention requirement on access token issuance.
**Informal spec reference**: §8.5; §3.

**Decision**: A. Module [03] defines only the spectator token mechanism; all spectator eligibility policy (private games, room visibility, rate-limiting, abuse prevention) belongs to [08] or to whichever later module owns the feature.
**Rationale**: Keeping [03] narrowly scoped to identity and credential mechanics makes its boundary clean and avoids duplicating policy. If [08]'s Phase 1 author encounters this and needs [03] to carry a rate-limit requirement, that can be negotiated as a cross-module requirement change at that point — this decision is not load-bearing against such a change. The risk being accepted here is that [08]'s author might assume spectator rate-limiting is handled upstream in [03] and silently drop it; to mitigate, a cross-reference note should be carried forward.
**Affected requirements/design elements**: None — current 03-REQ-026 conforms. Cross-module reminder: when [08] Phase 1 begins, verify that spectator eligibility rules (visibility, rate-limiting, abuse prevention) are explicitly captured there. If [08]'s author needs [03] to participate in any of that, a new REVIEW item should be raised against this module.

---

### 03-REVIEW-010: Convex-to-SpacetimeDB authentication mechanism — **RESOLVED** (Option B)

**Type**: Gap
**Phase**: Design
**Context**: 03-REQ-048 requires Convex to authenticate to SpacetimeDB for provisioning, teardown, initialization, notification subscription, and record retrieval. Section 3.22 previously deferred the exact protocol to implementation time, depending on the SpacetimeDB hosting platform's affordances.

**Partial resolution history**: The introduction of Convex-as-OIDC-issuer (Section 3.17) resolved the **client-facing** authentication mechanism — all game participants (operators, bots, spectators) authenticate to SpacetimeDB via RS256-signed JWTs validated through OIDC discovery. However, **Convex's own authentication to SpacetimeDB** for privileged management operations remained open.

**Decision**: B — commit to the self-hosted SpacetimeDB platform with Convex self-issued JWT authentication for management operations. Section 3.22 has been updated to specify this mechanism fully.

**Rationale**:
- The platform uses **self-hosted SpacetimeDB** rather than SpacetimeDB maincloud. This decision is warranted independently by: (a) Australian hosting locality requirement (data sovereignty), (b) cost minimization (eliminating per-instance hosting fees), and (c) automation-friendly authentication — maincloud requires GitHub OAuth for management API access, which is incompatible with unattended automated provisioning from a Convex runtime.
- Self-hosted SpacetimeDB exposes an HTTP management API that accepts externally-issued JWTs for authentication. Convex issues RS256-signed JWTs using its existing `SPACETIMEDB_SIGNING_KEY` (or a dedicated management key pair) and presents them to the management API for all privileged operations.
- This eliminates the "defer to implementation time" hedge in Section 3.22: the authentication mechanism is now fully specified at design time, consistent with the platform's commitment to principled, automatable provisioning.

**Affected design elements**: 03-REQ-048 and Section 3.22 updated.
**Informal spec reference**: §3, §10.

---

### 03-REVIEW-011: `UserId` and `CentaurTeamId` as Convex record `_id`s — **RESOLVED**

**Type**: Gap
**Phase**: Design
**Context**: Section 3.13 previously specified that each human user is assigned a monotonically increasing `userId: UserId` (a numeric branded type) allocated via a counter document at user creation time, and that each Centaur Team is assigned a separate `centaurId: CentaurId` (also monotonically increasing integer) allocated at team creation time. Module 01 defined both as `number & { readonly __brand: ... }`. This introduced counter-document serialization points and a redundant identifier field on the `CentaurTeamIdentityFields` interface (since the `centaur_teams._id` already uniquely identified the team). Additionally, the branded type was named `CentaurId` rather than `CentaurTeamId`, creating a discrepancy between the type name and the entity it identifies (a Centaur Team, not a Centaur in isolation).

**Decision**: Use Convex record `_id`s directly as `UserId` and `CentaurTeamId`, and rename the branded type from `CentaurId` to `CentaurTeamId` to match the entity it identifies. The `CentaurTeamId` type is the single team identifier across all modules — it is always the Convex `centaur_teams._id` string.

- `UserId` is the Convex `users._id` (type `Id<'users'>`), cast to `string & { readonly __brand: 'UserId' }`.
- `CentaurTeamId` is the Convex `centaur_teams._id` (type `Id<'centaur_teams'>`), cast to `string & { readonly __brand: 'CentaurTeamId' }`.
- Both branded types are string-based (not numeric) in Module 01.
- The counter-document allocation scheme is eliminated entirely.
- The separate `centaurId` field on `CentaurTeamIdentityFields` is eliminated — `_id` IS the `centaurTeamId`.
- The `Agent` discriminated union variant is renamed from `kind: 'centaur'` to `kind: 'centaur_team'` with field `centaurTeamId: CentaurTeamId`, reflecting that this agent represents the Centaur Team acting collectively (its bot submitting a move from the Centaur Server, incorporating the team's human and AI heuristics). The `kind: 'operator'` variant carries field `operatorUserId: UserId`, representing an individual human member acting as a sub-agent of their Centaur Team.

**Rationale**: Counter-document allocation introduces unnecessary write serialization for both user creation and team creation. Convex `_id` values are already globally unique, opaque, and assigned atomically — they satisfy every property that motivated the counter scheme (unique, stable, compact enough for `sub` claim strings). Using `_id` directly eliminates indirection, removes the need for a separate denormalized field, and simplifies downstream code. Renaming `CentaurId` → `CentaurTeamId` eliminates ambiguity: the identifier always refers to a Centaur Team, and the `Agent` variant `kind: 'centaur_team'` makes explicit that the attribution is at the team level (contrasted with `kind: 'operator'`, which attributes at the individual level).

**Affected requirements and design elements**:
- Module 01 (`specs/01-game-rules.md`): `CentaurId` renamed to `CentaurTeamId`; both branded types changed from `number & {...}` to `string & {...}`; `Agent` variant changed from `{kind: 'centaur', centaurId}` to `{kind: 'centaur_team', centaurTeamId}`. Resolved 01-REVIEW-011 decision text updated.
- Module 03 (`specs/03-auth-and-identity.md`): Section 3.13 (`HumanIdentityFields`, `CentaurTeamIdentityFields`, `PlatformIdentity`), Section 3.15 (`GameCredentialClaims`, claim descriptions), Section 3.16 (`GameInvitationPayload`, roster description), Section 3.17 (`sub` claim examples, token flavor table), Section 3.18 (Agent derivation prose), Section 3.22 (team identity consistency), Sections 4.1–4.4 and 4.7 (exported type interfaces, `parseSubClaim` and `deriveAgentFromSubClaim` signatures and descriptions) — all updated.
- Module 02 (`specs/02-platform-architecture.md`): `CentaurId` re-export renamed; `CentaurTeamId` remains. Sub-claim examples updated.
- Module 04 (`specs/04-stdb-engine.md`): `Agent` value descriptions in 04-REQ-020 and 04-REVIEW-011 updated to use `{kind: 'centaur_team', centaurTeamId}`.

**Informal spec reference**: §3, "Identity Model".
