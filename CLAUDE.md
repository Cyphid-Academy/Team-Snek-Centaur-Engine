# Project Instructions

## File Delivery

Each Cowork session has an opaque identifier (e.g. `laughing-focused-goldberg`, `practical-eager-keller`). Below, `<SESSION_ID>` stands in for whatever the current session's identifier is — substitute the live value from the session's own paths.

To make files accessible to Chris on his local filesystem, always write final outputs directly to:

```
/sessions/<SESSION_ID>/mnt/Team Snek Centaur Engine/
```

This maps to Chris's selected folder and files appear there immediately.

**Do not** write deliverables to the scratchpad (`/sessions/<SESSION_ID>/` outside of `mnt/`). The platform will copy scratchpad files to an obscure AppData path that Chris would have to hunt for manually.

Intermediate/temporary files (e.g. pipeline artifacts not intended for the user) can stay in the scratchpad.

## Spec Authoring Status

Progress on the modular spec (see `SPEC-INSTRUCTIONS.md` for the phase/module framework):

- **Module 01 — game-rules**: Phase 1 (Requirements) approved, then substantially revised post-approval via 01-REVIEW-014 (frozen → start-of-turn wording), 01-REVIEW-015 (stacking removed, symmetric buff/debuff state model with ≤1-per-family invariant, derived `invulnerabilityLevel`/`isVisible` functions, team-wide family-scoped cancellation), and 01-REVIEW-016 (invisibility collector remains visible — correcting a formal-spec-only mistake that didn't match user intent). Phase 2 (Design + Exported Interfaces) drafted and updated to reflect all three rewrites. REVIEW state: 2 open items (012 game-config ranges, 013 `GameState` aggregate shape) awaiting human resolution; 5 resolved (010 source-attribution dissolved by 015, 011 module-local `Agent`, 014 frozen wording, 015 stacking/state-model redesign, 016 invisibility-collector visibility fix).
- **Module 02 — platform-architecture**: Phase 1 (Requirements) drafted.
- **Module 03 — auth-and-identity**: Phase 1 (Requirements) drafted.
- **Module 04 — stdb-engine**: Phase 1 (Requirements) drafted.
- **Module 05 — convex-platform**: Phase 1 (Requirements) drafted.
- **Module 06 — centaur-state**: Phase 1 (Requirements) drafted.
- **Module 07 — bot-framework**: Phase 1 (Requirements) drafted.
- **Module 08 — centaur-server-app**: Phase 1 (Requirements) drafted.
- **Module 09 — platform-ui**: Phase 1 (Requirements) drafted.
- Module 01 is the only module in Phase 2 so far.

Update this list as modules advance.
