# Server-wide SSO via shared-secret parent-domain cookie (A1); token-handoff (A2) deferred

**Status:** accepted

## Context

The instance-picker work (#810, part of #603) calls for true single-sign-on: a player
authenticates once and roams between game instances (subdomains) without re-entering
credentials, with a personalised "your runs" view. This requires an identity backend
that outlives any single instance (instances are created and *deleted* per #603), so a
new server-wide **home/accounts service** owns login, signup, and the session — fronted
on the apex/a dedicated subdomain. This overturns the RFC's "apex is pure-static" goal.

Two code facts shaped the session choice (`energetica/utils/auth.py`):

- The signing secret is **per-instance** (`instance/secret_key.txt`), so a token signed
  by one instance cannot be validated by another — cross-instance sessions were
  impossible by construction, not just by cookie scope.
- The session payload is just the (server-wide-unique) `username`; each instance resolves
  it against its own local `User`. So with a *shared* secret, one token already resolves
  correctly everywhere.

`docs/architecture/static-serving-and-deployment.md` argues at length for **per-subdomain
cookie isolation** (a session on instance A physically cannot reach instance B). True SSO
is in direct tension with that property; this ADR records that we are knowingly trading it.

## Decision

Implement SSO as **A1**: a **server-wide shared signing secret** (moved next to
`accounts.db` under `/var/lib/energetica/`) plus a **parent-domain session cookie**
(`domain=.<apex>`). The home/accounts service sets the cookie; each instance validates it
with the shared secret and auto-provisions a local `User` on first authenticated visit
(gated by the existing per-instance access policy). Per-subdomain cookie isolation is
**given up**.

## Considered Options

- **B — static apex, no SSO.** Apex stays pure-static; the "picker" only routes you to a
  chosen subdomain's existing login form; you re-authenticate (one shared password,
  re-entered) per instance. Preserves every RFC invariant and needs no new service.
  Rejected: it structurally **cannot** show "the runs *you* have started" (the static apex
  is stateless and cannot query per-instance membership), which is the feature being asked
  for, and keeps the per-instance re-auth papercut #603 wants gone.
- **A2 — token-handoff SSO (CAS/OAuth-style).** Home service holds the master session on
  its own origin; entering an instance triggers a signed-ticket redirect handoff, and each
  instance sets its **own host-only** cookie. Gives log-in-once **and** preserves
  cookie isolation. Deferred, not rejected (see Consequences): it is a real redirect
  protocol to build and test, and the risk it mitigates is not live today.

## Consequences

- **Cookie isolation is lost.** All instances share a registrable domain, so `SameSite=Lax`
  does not restrict cross-instance requests — a session leaked/ridden on one instance is
  usable on all. The leak is only *exploitable* when (1) ≥2 concurrently-live public
  instances exist — **already true** — and (2) a stored-XSS vector exists. Today all UGC
  (chat, names) renders as React-escaped text, so **(2) is the sole remaining defense.**
- **A CI guard is therefore part of shipping A1, not optional:** a test/lint forbidding
  `dangerouslySetInnerHTML` / `rehype-raw` / raw-HTML rendering in `components/chat/` (and
  any UGC surface). The day chat renders rich content, the cross-instance leak goes live.
- **A2 is the committed hardening path** (#813), to land before any UGC surface gains a
  rich-content renderer (backstop re-evaluation: 2026-12). Reversing A1 later means a
  cookie/secret migration across every instance — hence recording it here.
- **New server-wide state:** a shared signing secret and (for the "your runs" view) an
  instance-membership table in `accounts.db`, read/written by every instance — more
  cross-instance coupling than the prior "each instance touches only its own files".
- The apex is no longer pure-static: a new home/accounts service is the most-public origin
  and a new operational + attack surface.
