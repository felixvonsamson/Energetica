# Roles and admin authority

Who is allowed to manage an Energetica instance, and how. This page is the reference
for facilitators and sysadmins: the role taxonomy, how elevated access is granted, and
a table of every administrative capability and who owns it.

The rationale — why the roles are shaped this way and which alternatives were rejected —
lives in [ADR-0004](../adr/0004-role-taxonomy-and-admin-authority.md). This page is the
*what*; the ADR is the *why*.

> **Status.** Much of what follows is a specification, not a description of running
> code. Each capability in the matrix carries a **Status** column: `built` (exists and
> enforced today), `aspirational` (agreed but not built), or `retired` (being removed).
> The role model itself is mid-migration — see [Role model](#the-role-model).

## The roles

There are exactly three principals plus ordinary users.

- **Player** — a participant in the simulation of one instance. Has an in-game identity
  (money, networks, facilities) and plays by the rules.
- **Account** — an identity on the platform, owned by the lobby (ADR-0002/0003). An
  account is not necessarily a player: a facilitator holds an account and acts on an
  instance without ever settling into it as a player. `account ≠ player`. There is no
  separate per-instance "user" object — see [Role model](#the-role-model).
- **Facilitator** — the single elevated, in-product role. Its power comes from its
  *capabilities*, not from its title. In a Workshop-Mode instance the facilitator is the
  person the participants call the "moderator" — same role, context-specific word.
- **Sysadmin** — someone with a shell on the server (SSH + root, or the `deploy` user).
  This is an **out-of-band operator, not a product role**. It is not a value of
  `UserRole` and cannot be conferred through the platform. Today the sysadmins are the
  developers (Felix, Max); "developer" is not a synonym for the role, just who holds it
  now.

"Admin" and "moderator" are retired as principal names. Admin is renamed to facilitator;
moderator is the facilitator's Workshop word, not a separate role.

### The role model

In code the role is a lobby fact — a column on `instance_membership`, read directly by
every authority/player check, never a property materialised onto a per-instance object:

```python
Role = Literal["player", "facilitator"]  # was UserRole = Literal["player", "admin"] on the
                                          # now-retired per-instance User (see ADR-0004)
```

`"admin"` is retired with **no alias** — the migration replaces it outright. `sysadmin`
does **not** appear in `UserRole`; it has no in-product representation by design. This
migration is tracked in the build backlog (see [#899](https://github.com/felixvonsamson/Energetica/issues/899)).

## How elevated access is granted

A facilitator grant is a **lobby fact**: a row in `instance_membership`, the same table
that already records an account's settled runs — a `role` column on that table, not a
separate table. It cannot live on a per-instance object, because a server-wide facilitator
must have reach across instances that a per-instance pickle cannot express, and there no
longer is a per-instance `User` to put it on regardless (see below).

```
instance_membership(account_id, slug, role, created_at)
```

- `slug IS NULL` — a **server-wide** grant: facilitator over every instance.
- `slug = "<instance>"` — an **instance-scoped** grant, or an ordinary settled player.
- `role` — `"player"` or `"facilitator"`.

Scope is **reach only** — it decides *which* instances a facilitator can act on, never
*what* they can do there. A server-wide grant confers the same powers as an instance grant,
over more instances.

**Player and facilitator are mutually exclusive per `(account_id, slug)`.** One row, one
role. An account already settled as a player in an instance cannot be granted facilitator
there (and the grant script rejects it); an account already a facilitator cannot settle as
a player. An account wanting both uses a second account.

**No projection — every check reads the table directly.** There is no per-instance `User`
object to materialise a role onto. Authority checks (`is_facilitator(account_id, slug)`)
and player checks both query `instance_membership` straight from the request. This also
retires the persistent `User`/`Account` duplication tracked in
[#905](https://github.com/felixvonsamson/Energetica/issues/905): the per-instance engine
object (`Player`) now carries `username`/`pwhash`/`account_id` directly and exists only for
an account that has actually settled — nothing is auto-provisioned on first visit, and a
facilitator, who never settles, has no per-instance object at all.

**Revocation is eventual.** Removing a grant takes effect on the facilitator's next
request, not instantly (there is no live-session cache to invalidate to make it instant
anyway). This is acceptable given short-lived instances with roughly one facilitator each;
an instant kick is deferred to the ban surface
([#677](https://github.com/felixvonsamson/Energetica/issues/677)).

**Bootstrap is a CLI seed, grant-only.** The first grant is seeded out-of-band by a
sysadmin from the shell (`scripts/grant-facilitator.py`), defaulting to server-wide. There
is deliberately no revoke command yet — YAGNI, given a single long-lived facilitator per
short-lived instance; add one the day it's actually needed. The old per-instance
auto-provisioned `admin` account is **removed** — it existed only because this framework
did not. A grant-admin web view (a facilitator issuing further grants through the
platform) is a downstream surface, not part of this spec.

## Access versus authority

An instance has two independent gates:

- **Access policy** decides who may load the instance at all: `public`, or `private`
  with an allowlist of usernames.
- **Role** decides what a principal may do once inside.

A facilitator grant covering an instance (server-wide, or scoped to that slug)
**bypasses the access allowlist**. The allowlist governs *players*; a facilitator is not
entering as a player, and being locked out by the very allowlist they administer would
be incoherent. The entry check is:

```
policy == public  OR  username in allowed_usernames  OR  holds a facilitator grant covering the slug
```

With the auto-provisioned `admin` gone, the grant is the only source of elevated reach,
so this fully closes the old "private-instance admin is locked out" gap.

## Diegetic versus non-diegetic

This matrix catalogues **non-diegetic authority only** — a principal acting *on* the
system from outside the fiction (freezing an instance, banning an account for abuse,
spectating).

**Diegetic mechanisms** — features *inside* the game's fiction — are game design, not
authority, and are out of scope here:

- **Ban for unacceptable conduct** (abuse, harassment, offensive usernames) is
  *non-diegetic*: a facilitator reaches in and removes an account. It is in this matrix
  ([#677](https://github.com/felixvonsamson/Energetica/issues/677)).
- **Sanctioning in-game unfairness** (market manipulation, bot trading) is *diegetic*.
  Such play breaks no rule and arguably shows mastery; the only harm is unfairness to
  others in a market. The intended response is a game mechanic — players of a market
  vote to embargo or exclude a manipulator ([#773](https://github.com/felixvonsamson/Energetica/issues/773)).
  It is **not** facilitator authority and is not in this matrix.

## The surface: in-app or out-of-band

Only one distinction about *how* a capability is exercised carries authorization weight:

- **In-app** — through the platform, authenticated, enforced against the grant.
  Available to facilitators and players. To a user the platform is one thing; whether a
  request is served by the lobby or an instance is an implementation detail, not a
  surface.
- **Out-of-band** — SSH, root, and one-off scripts. Unauthorizable by construction, and
  therefore the definition of the sysadmin plane. Recovery by editing the database or a
  JSON file directly is the out-of-band catch-all and is deliberately not specified.

Out-of-band and sysadmin are effectively the same set. A handful of capabilities live
out-of-band today but were candidates to graduate to an in-app facilitator surface;
[#898](https://github.com/felixvonsamson/Energetica/issues/898) resolved which. The seam:

> A lever is a **facilitator (in-app)** power when it governs **who is in the session and
> when it runs** — the clock (`freeze_at` / `starts_at` / `ended_at`) and the roster
> (whitelist). It stays **sysadmin (out-of-band)** when it governs the instance's
> **exposure to the outside world** (public/private, advertised, server-wide signups) or
> is **infra/recovery** (provision, deploy, teardown, regenerate recap).

The facilitator runs the room; the operator controls the doors and the marquee. This also
settles the whitelist-versus-access-policy split below: the facilitator manages the
*invite list*, while whether the door is roster-gated at all is an exposure decision set
when the instance is stood up. The four graduating levers are `aspirational` (specced, not
yet built as an in-app surface); the exposure and infra levers stay `built` on the shell.
A logged-in "superadmin" console for the exposure levers is a desirable future but out of
scope — see [Out of scope](#out-of-scope-for-this-spec).

## Capability matrix

Scope `n/a` means the capability is not gated by reach (either it is sysadmin/out-of-band,
or it applies uniformly). Format is a non-empty subset of {persistent, workshop}.

### Instance lifecycle and provisioning

| Capability | Owner | Scope | Format | Plane | Status |
|---|---|---|---|---|---|
| Base server setup | sysadmin | n/a | both | out-of-band | built |
| Provision instance | sysadmin | n/a | persistent | out-of-band | built |
| Provision lobby | sysadmin | n/a | both | out-of-band | built |
| Deploy instance code | sysadmin | n/a | both | out-of-band | built |
| Deploy lobby code | sysadmin | n/a | both | out-of-band | built |
| Set lifecycle timestamps at creation (`starts_at`/`freeze_at`/`ended_at`) | sysadmin | n/a | persistent | out-of-band | built |
| Force-freeze / adjust `freeze_at` | facilitator | instance | persistent | in-app | aspirational (graduates from out-of-band, [#898](https://github.com/felixvonsamson/Energetica/issues/898)) |
| Re-anchor start / adjust `starts_at` | facilitator | instance | persistent | in-app | aspirational (graduates from out-of-band, [#898](https://github.com/felixvonsamson/Energetica/issues/898)) |
| Set `ended_at` (end instance) | facilitator | instance | persistent | in-app | aspirational (graduates from out-of-band, [#898](https://github.com/felixvonsamson/Energetica/issues/898)) |
| Reap / teardown ended instance (OS-level) | sysadmin | n/a | persistent | out-of-band | built |
| Advertise / hide instance | sysadmin | n/a | persistent | out-of-band | built (stays out-of-band, [#898](https://github.com/felixvonsamson/Energetica/issues/898)) |
| Set display name | sysadmin | n/a | persistent | out-of-band | built |
| List instances | sysadmin | n/a | both | out-of-band | built |
| Download / back up instance state | sysadmin | n/a | both | out-of-band | built |
| Export instance to CSV | sysadmin | n/a | persistent | out-of-band | built |
| Backfill instance membership (one-time migration) | sysadmin | n/a | persistent | out-of-band | built |
| Migrate to server accounts (one-time migration) | sysadmin | n/a | persistent | out-of-band | built |
| Regenerate recap | sysadmin | n/a | persistent | out-of-band | built (stays out-of-band — dev recovery, not a facilitator act, [#898](https://github.com/felixvonsamson/Energetica/issues/898)) |

### Access control and whitelisting

| Capability | Owner | Scope | Format | Plane | Status |
|---|---|---|---|---|---|
| Set access policy (public / private) | sysadmin | n/a | both | out-of-band | built (stays out-of-band — exposure lever, [#898](https://github.com/felixvonsamson/Energetica/issues/898)) |
| Manage instance whitelist | facilitator | instance | persistent | in-app | built (graduated from out-of-band; the roster lives in `accounts.db`, ADR-0007 — `scripts/whitelist-run.py` remains for a sysadmin who'd rather not go through the facilitator UI) |
| Server-wide signup toggle | sysadmin | n/a | both | out-of-band | built (stays out-of-band — exposure lever, [#898](https://github.com/felixvonsamson/Energetica/issues/898)) |
| Facilitator bypasses access allowlist | facilitator | server-wide or instance | both | in-app | built (ADR-0004) |
| Discover own scoped facilitator run(s) from the lobby picker | facilitator | instance | both | in-app | built ([#1032](https://github.com/felixvonsamson/Energetica/issues/1032)) |
| Per-instance `disable_signups` | — | — | persistent | — | retired (superseded by server-wide toggle) |
| `players.txt` bootstrap enrollment | — | — | persistent | — | retired (superseded by CLI grant seed, [#842](https://github.com/felixvonsamson/Energetica/issues/842)) |

### Identity and grants

| Capability | Owner | Scope | Format | Plane | Status |
|---|---|---|---|---|---|
| Role model (`UserRole`) | n/a (mechanism) | n/a | both | — | to migrate (`admin` → `facilitator`, [#899](https://github.com/felixvonsamson/Energetica/issues/899)) |
| Seed the first facilitator grant | sysadmin | server-wide (default) | both | out-of-band (CLI) | aspirational |
| Auto-provisioned `admin` account | — | — | persistent | — | retired (removed; replaced by CLI grant seed) |
| Issue / revoke facilitator grants | facilitator (server-wide) | server-wide | both | in-app (lobby) | aspirational (grant-admin view, downstream) |
| Change own password | any user | n/a | both | in-app (lobby) | aspirational ([#323](https://github.com/felixvonsamson/Energetica/issues/323)) |
| Delete account (primitive) | facilitator (once exposed) | server-wide or instance | both | in-app | built (primitive only; no surface) |

### In-instance moderation and elevated powers

| Capability | Owner | Scope | Format | Plane | Status |
|---|---|---|---|---|---|
| Spectator views (spy on any account) | facilitator | instance | persistent | in-app | aspirational ([#279](https://github.com/felixvonsamson/Energetica/issues/279)) |
| API reshaping to support spectator views | facilitator (enabler) | instance | persistent | in-app | aspirational ([#617](https://github.com/felixvonsamson/Energetica/issues/617)) |
| Ban / force-delete a player (non-diegetic) | facilitator | server-wide or instance | both | in-app | aspirational ([#677](https://github.com/felixvonsamson/Energetica/issues/677)) |
| `sudo` / give actions (money, resources, levels) | facilitator | instance | persistent | in-app | aspirational ([#310](https://github.com/felixvonsamson/Energetica/issues/310)) |
| Pause / resume a player's simulation (manual) | facilitator | instance | persistent | in-app | aspirational ([#403](https://github.com/felixvonsamson/Energetica/issues/403)) |
| Workshop: session / round / phase control | facilitator | instance | workshop | in-app | aspirational; **design owned by [#880](https://github.com/felixvonsamson/Energetica/issues/880)** |
| Workshop: live scenario override | facilitator | instance | workshop | in-app | aspirational; **design owned by [#880](https://github.com/felixvonsamson/Energetica/issues/880)** |
| Workshop: propose vote events | facilitator (proposes) | instance | workshop | in-app | aspirational; **design owned by [#880](https://github.com/felixvonsamson/Energetica/issues/880)** |

### Observability and ops

| Capability | Owner | Scope | Format | Plane | Status |
|---|---|---|---|---|---|
| Server health check and alert | sysadmin | n/a | both | out-of-band | aspirational ([#802](https://github.com/felixvonsamson/Energetica/issues/802)) |
| Anonymise action-history logs | sysadmin | n/a | persistent | out-of-band | aspirational ([#322](https://github.com/felixvonsamson/Energetica/issues/322)) |
| Instance discovery (ops read) | sysadmin | n/a | both | out-of-band | built |

## Out of scope for this spec

- **Automatic pausing of inactive players.** A sim mechanism with no principal, not an
  authority capability. Only the *manual* facilitator pause/resume is a capability here.
- **Diegetic sanctions** — market-collective embargoes/votes ([#773](https://github.com/felixvonsamson/Energetica/issues/773)),
  and the in-fiction Workshop policy votes — are game design, owned elsewhere.
- **The Workshop moderator's powers** (round count, phase timers, scenario overrides,
  vote events) are *placed* here as facilitator, workshop-format, but their design is
  owned by [Workshop Mode (#880)](https://github.com/felixvonsamson/Energetica/issues/880).
- **Building the surfaces** — the lobby dashboard, the in-instance spectator view, the
  grant-admin view, the bootstrap UI. This spec says who owns what; each surface is a
  downstream effort.
- **sysadmin fleet provisioning as a product.** Setup, deploy, and teardown stay a shell
  and root concern by deliberate boundary. Whether individual levers graduate was decided
  in [#898](https://github.com/felixvonsamson/Energetica/issues/898).
- **A "superadmin" web console for the exposure levers.** A logged-in surface where an
  operator flips access policy, advertised, and signups without a shell is a desirable
  future, but out of scope here: it needs the lobby backend to write every instance's
  `instance.json` — a cross-instance config-write channel that does not exist, and the
  same infrastructure as productised fleet provisioning above. It is a separate effort, not
  a third product role — the operator stays the sysadmin plane until such a surface is
  built ([#898](https://github.com/felixvonsamson/Energetica/issues/898)).
