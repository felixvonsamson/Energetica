# Fix startup OOM on the read path; keep the action log complete from init

## Context

`create_app()` deserialised the entire `instance/actions_history.log` into Pydantic
objects on every startup (~270 MB / 365K lines → ~1.3 GB RSS on a 1.8 GB box → OOM
crash loop; see issue #766). The full list is barely used: only actions *after* the
loaded tick are replayed; the rest is read just to locate one boundary line.

## Decision

Fix the spike on the **read path only**: stream the log, skip the pre-boundary prefix
via top-level `json.loads` (never building objects), and Pydantic-validate only line 0
(`init_engine`) plus the tail at/after the loaded tick. The **action log remains an
append-only, complete-from-`init_engine` event source** — we do **not** truncate or
rotate it.

## Considered Options

- **Truncate the log at each checkpoint** (issue's "simplest"). Rejected: it collapses
  the recovery surface from "any checkpoint" to "only the newest checkpoint." Full
  checkpoints run every 6 h but the loaded tick usually comes from the 10-min save; if
  the newest checkpoint is the corrupt one, recovery falls back to an older checkpoint —
  but truncation has already deleted the actions needed to replay forward from it. It
  also introduces a live-writer truncation race on a write path that is currently dead
  simple.
- **Rotating log segments.** Rejected for this fix: more moving parts, same recovery
  concerns, no production urgency.
- **Move the action log into a database (#766 option 5).** Out of scope: aspirational,
  unscoped, and orthogonal to a live crash. A localised read-path fix is fully
  compatible with a later DB migration.

## Consequences

- Disk growth (the log still grows unboundedly) is **not** addressed here; it is a
  separate, non-urgent track. If addressed later it must be archival (move-aside),
  never delete-what-you-cannot-replay, to preserve recovery-from-any-checkpoint.
- The boundary scan uses a top-level JSON parse, **not** a substring search: `request`
  actions log arbitrary user-controlled payloads that can contain the literal bytes
  `"action_type":"tick"`, so substring matching is a correctness/security hole.
