# Role taxonomy and admin authority

## Context

Energetica's notion of an "admin" barely existed in code — a `UserRole = Literal["player",
"admin"]` and an `is_admin` boolean on the per-instance engine `User`, plus a startup
routine that minted a random-password `admin` account. Every actual admin power (spectating
accounts, banning, `sudo`-style grants, a dashboard) was *wanted* across scattered issues,
none built. Meanwhile the real administrative work — freezing instances, editing whitelists,
provisioning, deploys — happened out-of-band as root edits to `instance.json` and shell
scripts. "Admin" and "moderator" were used interchangeably but neither was defined.

We needed a coherent authorization model before any of the wanted surfaces (dashboard,
spectator view, ban tool) could be built or planned, and before the neighbouring efforts —
server lifecycle ([#856](https://github.com/felixvonsamson/Energetica/issues/856)) and
Workshop Mode ([#880](https://github.com/felixvonsamson/Energetica/issues/880)) — could rely
on a shared vocabulary. This ADR records the taxonomy and the authority model. The full
capability reference lives in [`docs/architecture/roles.md`](../architecture/roles.md);
this ADR is the rationale.

Prior decisions this builds on: [ADR-0002](0002-server-wide-sso-shared-cookie.md)
(server-wide single sign-on, one account across instances) and
[ADR-0003](0003-account-creation-decoupled-from-instance-access.md) (credentials owned by
the lobby, decoupled from per-instance access).

## Decision

**One elevated role, `facilitator`.** The single in-product elevated principal is the
facilitator. Its authority is its capabilities, not its title. `moderator` is the word
participants use for a facilitator in a Workshop-Mode instance — the same role in a
different context, not a distinct principal. `admin` is retired with no alias.

**`sysadmin` is an out-of-band boundary, not a product role.** A sysadmin has a shell on
the server. This authority is unauthorizable by our code by construction, so it is
deliberately *not* modelled in the product: it is not a value of `UserRole` and cannot be
conferred through the platform.

**Authority is conferred by scoped grants, stored as lobby facts.** A facilitator grant is
a row in the lobby accounts store: `facilitator_grants(account_id, slug, granted_at,
granted_by)`. `slug IS NULL` means server-wide; a slug means that one instance. Scope is
**reach only** — it decides which instances, never what powers. The per-instance
`User.role` becomes a **projection** of the grant, derived on instance entry, so existing
`user.role` checks keep working. The grant must live at the lobby layer because a per-
instance pickle cannot express server-wide reach.

**A grant bypasses the access allowlist.** The access policy governs players; a facilitator
does not enter as a player, so a grant covering an instance overrides its private
allowlist. The auto-provisioned `admin` account is removed — it existed only to paper over
the absence of this framework — which closes the old "private instance locks the admin out"
gap outright.

**Capabilities are gated by instance format, not by role or grant.** Persistent free-play
and Workshop Mode expose different facilitator capabilities. The grant confers the role;
the format decides which capabilities are available.

**The matrix catalogues non-diegetic authority only.** Acting *on* the system from outside
the fiction (freeze, ban-for-abuse, spectate) is authority and is in scope. Mechanisms
*inside* the fiction — players voting to embargo a market manipulator, in-game policy votes
— are game design, not authority, and are out of scope.

## Considered Options

- **Multiple elevated roles (admin, moderator, operator, …).** Rejected. The distinctions
  people reached for — persistent-world admin versus Workshop moderator, server-wide versus
  single-instance — are differences of *format* and *reach*, not of authority kind.
  Modelling them as separate roles would multiply enforcement paths for one underlying
  actor. Format-gating plus grant-scope captures the same distinctions with one role.

- **Scope as extra authority (a server-wide role that can do *more*).** Rejected. Conflating
  reach with power means "where" and "what" leak into each other and every capability check
  has to reason about both. Keeping scope as pure reach lets capability checks ask only
  "may this facilitator act on this instance," never "how powerful is their grant."

- **Grant on the per-instance `User`.** Rejected as impossible for server-wide grants: the
  engine `User` is a per-instance pickle with no cross-instance reach. Even for instance
  grants it would duplicate the conferral per instance and desync from the lobby account.
  Projecting `User.role` from a single lobby-level grant keeps one source of truth.

- **Keep `admin`, alias it to `facilitator`.** Rejected. The role was inert in code and the
  old `/admin-dashboard` surface was already removed, so there was nothing to stay
  compatible with. A clean rename avoids a permanent two-name ambiguity.

- **Model `sysadmin` as a top product role.** Rejected. Shell/root access cannot be checked
  by application code, so a `sysadmin` product role would be a label with no enforcement —
  worse than honest, it would imply the platform gates something it cannot. Cataloguing
  sysadmin capabilities without productising them keeps the boundary truthful.

- **Ban and market-sanction as one moderation feature.** Rejected. Banning for out-of-game
  conduct and sanctioning in-game unfairness are different in kind — non-diegetic authority
  versus a diegetic game mechanic — with different owners. Merging them would put
  game-design decisions inside the authority model.

## Consequences

- A new `facilitator_grants` table at the lobby layer, and an entry check that consults it.
  Revocation is *eventual* (effective on next instance entry); an instant kick is deferred
  to the ban surface.
- `UserRole` migrates `"admin"` → `"facilitator"` with no alias; the auto-provisioned
  `admin` bootstrap is removed and replaced by a sysadmin CLI seed of the first grant.
- The scattered admin issues are rebirthed as a build backlog against this taxonomy.
- The persistent duplication between the per-instance `User` and the lobby `Account` is
  *not* fixed here — `User.role` is projected on top of the existing smell. That cleanup is
  tracked separately ([#905](https://github.com/felixvonsamson/Energetica/issues/905)).
- Which out-of-band lifecycle levers graduate to an in-app facilitator surface is decided
  in [#898](https://github.com/felixvonsamson/Energetica/issues/898).
