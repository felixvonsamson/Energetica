# Accounts & users

Who plays, and where: the server, its accounts, the runs they join and the instances those runs are played on, and the lobby that ties them together. See the [glossary map](../../../../GLOSSARY-MAP.md) for the other contexts.

## Language

### Servers, runs and instances

**Server**:
One machine that hosts a **lobby** and any number of **instances**, known by its SSH alias, such as `energetica-game` or `energetica-edu`. Accounts, runs and sessions all belong to one server.

**Run**:
A game played on the server: its name, its mode, who may join it, its members and its schedule (when it starts, freezes and ends). A run is known by its slug. It **outlives its instance**: once its instance is torn down, a run with a recap stays in the lobby for good.

**Instance**:
The deployment a run is played on: its process, its subdomain (`{slug}.{apex}`), its certificate and its files on the server. Each run has exactly one instance, with the same slug. Setting up an instance and tearing it down are infrastructure acts: **reaping** ends a run, and **teardown** removes an instance.
_Avoid_: instance for the game itself (that is the run)

**Landing**:
The public marketing site on the apex domain. It is pure static files and never serves a run.

**Lobby**:
The server-wide part of Energetica that is not a run: where a player signs up, logs in (once, server-wide), and picks which **run** to enter or rejoin. It is made of a frontend, the **lobby backend**, the **lobby service** and `lobby.db`. It lives on its own subdomain (`lobby.{apex}`), separate from any run, and **outlives** individual runs.
_Avoid_: landing (the landing is the static marketing site; the lobby is the authenticated identity surface, on a different origin)

**Lobby backend**:
The lobby's public web app, behind `lobby.{apex}`. Like every run, it is a client of the **lobby service**.
_Avoid_: lobby web

**Lobby service**:
The one process that owns accounts, server-wide sessions, memberships and each **run**'s config, in `lobby.db` (ADR-0009, ADR-0010). The **lobby backend**, every run and the operator scripts are its clients. It knows whether an account has **joined a run**, but nothing about settling.
_Avoid_: accounts service, and `accounts.db` for its database (the names before the rename)

### Accounts and players

**Account**:
A server-wide identity: a username and a password that work on every run on the server. The **lobby service** owns it. An account belongs to one server, so the same username on another server is an unrelated account.
_Avoid_: user (see the flagged ambiguity below)

**Temporary account** (#1383):
An account with an expiry date, made by operator tooling for one workshop rather than by signing up. The lobby service deletes it, with its memberships, once that date has passed, which frees its username. It cannot join a persistent-world Run. An account with no expiry date is permanent.
_Avoid_: guest account, workshop account (a permanent account can play a workshop too)

**Server-wide session**:
The single authenticated session a player gets from the lobby, carried to every run on the server. Distinct from the per-run **Player** it unlocks.

**Joined a run**:
An account that has explicitly, deliberately joined a run: the lobby's two-click join for a public run (#1030), or, for a private run, a facilitator's add or a join-link confirm. Its membership is recorded the moment that happens, before the account has necessarily settled. The lobby's "your runs" view is keyed on this, not on settling.

**Settled**:
In the persistent world, an account that has picked a tile, so it has a **Player** in that run. A later, separate step from joining, and one only the run's engine records: the **lobby service** does not (ADR-0009). A Workshop Run has no settling.

**Player**:
An account's game state in one run. In the persistent world it exists once the account has **settled**, so an account can have joined a run without having a Player there. In a Workshop Run it is created when the account first enters the run. A **facilitator** never has one.

**Facilitator**:
The one elevated role an account can hold, granted for one run or for every run on the server (ADR-0004). A facilitator acts on a run but never plays in it.
_Avoid_: admin, moderator (both retired as role names)

## Relationships

- A **server** has one **lobby** and any number of **runs**, each played on one **instance**.
- An **account** can join many **runs** on its server, and has at most one **Player** in each.
- **Joined a run** comes before **settled**: every settled account has joined, but not every joined account has settled.

## Flagged ambiguities

- **"User".** It once named a per-instance record that every account got on its first visit to a run. That record was retired (ADR-0004): an account has a **Player** in a run once it settles, and nothing before. Resolved: say **account** for the server-wide identity and **Player** for the per-run game state.
- **"Membership": joined vs settled.** Originally resolved as membership = settled (ADR-0002), to keep an entry made silently on a public run's first visit from cluttering "your runs" with runs never actually played. #1030 revisited this: the lobby's two-click join is a deliberate act, so it now records a membership straight away, before settling. Resolved: **membership = joined**, settled or not. Whether a member has settled is known only to the run's engine (ADR-0009). A visit to a run the account never explicitly joined still does **not** make it a member.
- **"Instance" vs "run".** The two were long used as synonyms, with "instance" the internal term and "run" the player-facing one. Resolved (#1313): they are two related things. The **run** is the game, which the lobby keeps; the **instance** is the deployment it is played on, which the server keeps. Code and data about the game say "run"; configs, scripts, paths and systemd units about the deployment say "instance".
