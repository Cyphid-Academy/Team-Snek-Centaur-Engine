# Claude — Pointer File

All project context and agent instructions live in **`AGENTS.md`**. Read and modify that file for all context, status updates, and instructions.

Any updates to agent context (e.g., spec status changes, new instructions) must be written to `AGENTS.md`. The exception is context that is genuinely specific to Claude's product environment (Cowork sessions, Claude Code, the Claude API, etc.) — that belongs here in `CLAUDE.md`.

## Cowork

### File Delivery

Each Cowork session has an opaque identifier (e.g. `laughing-focused-goldberg`, `practical-eager-keller`). Below, `<SESSION_ID>` stands in for whatever the current session's identifier is — substitute the live value from the session's own paths.

To make files accessible to Chris on his local filesystem, always write final outputs directly to:

```
/sessions/<SESSION_ID>/mnt/Team Snek Centaur Engine/
```

This maps to Chris's selected folder and files appear there immediately.

**Do not** write deliverables to the scratchpad (`/sessions/<SESSION_ID>/` outside of `mnt/`). The platform will copy scratchpad files to an obscure AppData path that Chris would have to hunt for manually.

Intermediate/temporary files (e.g. pipeline artifacts not intended for the user) can stay in the scratchpad.
