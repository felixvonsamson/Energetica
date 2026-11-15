# Census: how each freeplay endpoint identifies its player (Nov 15, 2026)

This is the evidence for "Census · how each freeplay endpoint identifies its player" (#1494),
part of the freeplay facilitator surface map (#1493). It lists every HTTP route the freeplay app
mounts, every socket.io event it pushes, and every frontend query key, and records how each one
works out which player it is about today. It classifies; it does not propose a design.

Everything here was read from `main` at `3d3b7f02`. The backend was still under `src/energetica/`
at that commit. The route list was produced by importing `energetica.freeplay.routers.api_routers`
and walking the mounted FastAPI routes with their resolved dependencies, so the counts are exact.

## Groups

- **Owned**: the data or action belongs to one player (facilities, money, projects). It would take
  an explicit player id.
- **Run-wide**: the same for everyone (map, leaderboards, market charts). No player id.
- **Viewer**: inherently the caller's own view (chats, notifications, push subscriptions, account
  and membership). An explicit id may not make sense.

"Session" below means the route resolves the caller with `get_settled_player`
(`src/energetica/freeplay/utils/auth.py`): it reads the SSO cookie, requires role `player`, and
looks up the `Player` by `account_id`. No route takes a player id today. Seven routes say
`/players/me`; every other player-owned route names no player at all.

## Counts

98 routes: 97 under `/api/v1` plus `/healthz`.

| Group     | Routes | Reads | Writes | Use `get_settled_player` |
| --------- | -----: | ----: | -----: | -----------------------: |
| Owned     |     52 |    30 |     22 |                       52 |
| Run-wide  |     24 |    21 |      3 |                        4 |
| Viewer    |     22 |     7 |     15 |                       18 |
| **Total** | **98** |    58 |     40 |                   **74** |

"Read" counts `POST /resource-market/asks/{ask_id}:calculate-delivery` as a read, because it
changes nothing. All 22 owned writes are game-state writes guarded by `reject_when_frozen`. The 3
run-wide writes are the facilitator's. The viewer writes keep working after freeze (chat,
notifications, settings, push), except `POST /map/settle`, which is frozen-guarded.

## HTTP routes

Paths are relative to `/api/v1` unless they start with `/healthz`. "Implicit id" means a path id
whose authorisation assumes the caller is the owner (see findings).

### Owned (52)

| Method | Path                                                     | Identifies player by                  | R/W | Notes                                                                                              |
| ------ | -------------------------------------------------------- | ------------------------------------- | --- | -------------------------------------------------------------------------------------------------- |
| GET    | `/achievements`                                          | session                               | R   |                                                                                                    |
| GET    | `/charts/power-sources/{resolution}`                     | session                               | R   | reads `instance/data/players/player_{id}.pck`                                                      |
| GET    | `/charts/power-sinks/{resolution}`                       | session                               | R   | same                                                                                               |
| GET    | `/charts/storage-level/{resolution}`                     | session                               | R   | same                                                                                               |
| GET    | `/charts/storage-soc/{resolution}`                       | session                               | R   | same                                                                                               |
| GET    | `/charts/revenues/{resolution}`                          | session                               | R   | financial                                                                                          |
| GET    | `/charts/op-costs/{resolution}`                          | session                               | R   | financial                                                                                          |
| GET    | `/charts/emissions/{resolution}`                         | session                               | R   |                                                                                                    |
| GET    | `/charts/money/{resolution}`                             | session                               | R   | financial                                                                                          |
| GET    | `/charts/resources/{resolution}`                         | session                               | R   |                                                                                                    |
| GET    | `/charts/resources-soc/{resolution}`                     | session                               | R   |                                                                                                    |
| GET    | `/daily-quiz`                                            | session                               | R   | mixes the run-wide question with this player's answer; returns the correct answer once answered    |
| POST   | `/daily-quiz`                                            | session                               | W   |                                                                                                    |
| POST   | `/electricity-markets/{network_id}:join`                 | session; `network_id` explicit        | W   | acts on the player's membership                                                                    |
| POST   | `/electricity-markets/{network_id}:leave`                | session; `network_id` explicit        | W   | checks the caller is a member                                                                      |
| POST   | `/electricity-markets`                                   | session                               | W   | creates a market and makes the caller a member                                                     |
| PATCH  | `/electricity-markets/prices`                            | session                               | W   | edits the player's own `network_prices`; no market id, no player id                                |
| GET    | `/facilities`                                            | session                               | R   |                                                                                                    |
| GET    | `/facilities/statuses`                                   | session                               | R   |                                                                                                    |
| POST   | `/facilities/{facility_id}:upgrade`                      | session; implicit id                  | W   | 403 unless `facility.player == caller`                                                             |
| POST   | `/facilities/{facility_id}:dismantle`                    | session; implicit id                  | W   | same                                                                                               |
| POST   | `/facilities:upgrade-all`                                | session                               | W   |                                                                                                    |
| POST   | `/facilities:dismantle-all`                              | session                               | W   |                                                                                                    |
| GET    | `/players/me`                                            | session, literal `me`                 | R   | `PlayerOut` (id, username, activity) is already public via `GET /players`; frontend never calls it |
| GET    | `/players/me/money`                                      | session, literal `me`                 | R   |                                                                                                    |
| GET    | `/players/me/workers`                                    | session, literal `me`                 | R   |                                                                                                    |
| GET    | `/players/me/resources`                                  | session, literal `me`                 | R   |                                                                                                    |
| GET    | `/players/me/profile`                                    | session, literal `me`                 | R   | levels and progression; much of it is already public through `/leaderboards`                       |
| GET    | `/power-priorities`                                      | session                               | R   | gated on the caller's `network` achievement                                                        |
| PUT    | `/power-priorities`                                      | session                               | W   | same gate                                                                                          |
| POST   | `/power-priorities/{side}/{item_type}:increase-priority` | session                               | W   | same gate                                                                                          |
| POST   | `/power-priorities/{side}/{item_type}:decrease-priority` | session                               | W   | same gate                                                                                          |
| GET    | `/projects`                                              | session                               | R   |                                                                                                    |
| POST   | `/projects`                                              | session                               | W   |                                                                                                    |
| POST   | `/projects/{project_id}:cancel`                          | session; implicit id                  | W   | 403 unless `project.player == caller`                                                              |
| POST   | `/projects/{project_id}:pause`                           | session; implicit id                  | W   | same                                                                                               |
| POST   | `/projects/{project_id}:resume`                          | session; implicit id                  | W   | same                                                                                               |
| POST   | `/projects/{project_id}:increase-priority`               | session; implicit id                  | W   | same                                                                                               |
| POST   | `/projects/{project_id}:decrease-priority`               | session; implicit id                  | W   | same                                                                                               |
| GET    | `/projects/catalog/power-facilities`                     | session                               | R   | prices and availability depend on the player's levels and location                                 |
| GET    | `/projects/catalog/storage-facilities`                   | session                               | R   | same                                                                                               |
| GET    | `/projects/catalog/extraction-facilities`                | session                               | R   | same                                                                                               |
| GET    | `/projects/catalog/functional-facilities`                | session                               | R   | same                                                                                               |
| GET    | `/projects/catalog/technologies`                         | session                               | R   | same                                                                                               |
| POST   | `/resource-market/asks`                                  | session                               | W   | the new ask's seller is the caller                                                                 |
| POST   | `/resource-market/asks/{ask_id}:purchase`                | session; `ask_id` is another player's | W   | the buyer is the caller; no check against buying your own ask                                      |
| PATCH  | `/resource-market/asks/{ask_id}`                         | session; implicit id                  | W   | 403 unless `sale.player == caller`                                                                 |
| DELETE | `/resource-market/asks/{ask_id}`                         | session; implicit id                  | W   | same                                                                                               |
| POST   | `/resource-market/asks/{ask_id}:calculate-delivery`      | session; `ask_id` is any ask          | R   | a read sent as POST; depends on caller's and seller's locations                                    |
| GET    | `/shipments`                                             | session                               | R   |                                                                                                    |
| GET    | `/weather`                                               | session                               | R   | a function of the player's tile, not of the player                                                 |
| GET    | `/weather/climate-event-recoveries`                      | session                               | R   |                                                                                                    |

### Run-wide (24)

| Method | Path                                                   | Auth today                      | R/W | Notes                                                                                  |
| ------ | ------------------------------------------------------ | ------------------------------- | --- | -------------------------------------------------------------------------------------- |
| GET    | `/push-subscriptions/vapid-public-key`                 | none                            | R   | server key                                                                             |
| GET    | `/charts/climate/{resolution}`                         | session (unused, `_player`)     | R   | docstring says server-wide; facilitators get 403                                       |
| GET    | `/charts/temperature/{resolution}`                     | session (unused, `_player`)     | R   | same                                                                                   |
| GET    | `/charts/markets/{market_id}/clearing/{resolution}`    | none                            | R   | `market_id` explicit, no membership check                                              |
| GET    | `/charts/markets/{market_id}/exports/{resolution}`     | none                            | R   | per-player export series                                                               |
| GET    | `/charts/markets/{market_id}/imports/{resolution}`     | none                            | R   | per-player import series                                                               |
| GET    | `/charts/markets/{market_id}/generation/{resolution}`  | none                            | R   |                                                                                        |
| GET    | `/charts/markets/{market_id}/consumption/{resolution}` | none                            | R   |                                                                                        |
| GET    | `/charts/markets/{market_id}/market/{tick}`            | none                            | R   | full order book per tick: `player_id`, `price`, `capacity`, `facility` for every order |
| GET    | `/electricity-markets`                                 | session                         | R   | the list is run-wide, but 403 unless the caller has the `network` achievement          |
| GET    | `/facilitator/access`                                  | `get_facilitator`               | R   | creates the join token on first call                                                   |
| PATCH  | `/facilitator/access`                                  | `get_facilitator`               | W   |                                                                                        |
| GET    | `/facilitator/roster`                                  | `get_facilitator`               | R   |                                                                                        |
| GET    | `/facilitator/roster/candidates`                       | `get_facilitator`               | R   | prefix search over every account on the server                                         |
| POST   | `/facilitator/roster`                                  | `get_facilitator`               | W   | names an account by username in the body                                               |
| DELETE | `/facilitator/roster/{username}`                       | `get_facilitator`               | W   | names an account by username in the path                                               |
| GET    | `/game/engine`                                         | none                            | R   |                                                                                        |
| GET    | `/join/{token}`                                        | optional `get_standing`         | R   | run-wide answer plus a `viewer` block about the caller's account                       |
| GET    | `/map`                                                 | none                            | R   | each tile carries its owner's `player_id`                                              |
| GET    | `/players/game-state`                                  | none                            | R   | current tick; lives under `/players` but is not about a player                         |
| GET    | `/players`                                             | none                            | R   | id, username, activity status for every player                                         |
| GET    | `/resource-market/asks`                                | none                            | R   | each ask carries `seller_id`                                                           |
| GET    | `/leaderboards`                                        | session (the result ignores it) | R   | per-player progression, tech and facility levels, network name, emissions              |
| GET    | `/healthz`                                             | none                            | R   | infrastructure, not under `/api/v1`, hidden from OpenAPI                               |

### Viewer (22)

| Method | Path                                | Identifies caller by                            | R/W | Notes                                                                         |
| ------ | ----------------------------------- | ----------------------------------------------- | --- | ----------------------------------------------------------------------------- |
| GET    | `/auth/me`                          | `resolve_entry` (account)                       | R   | account id, username, role, `player_id`, and the player's `capabilities`      |
| GET    | `/lobby/my-runs`                    | `get_standing` (account)                        | R   | every run this account belongs to, across the server                          |
| POST   | `/join/{token}`                     | `get_standing` (account)                        | W   | adds the caller's account to the run                                          |
| POST   | `/map/settle`                       | `get_playing_account` (account)                 | W   | creates the caller's `Player`; there is no player id to name before this call |
| POST   | `/push-subscriptions:subscribe`     | session                                         | W   | stores a browser push endpoint and keys on the player                         |
| POST   | `/push-subscriptions:unsubscribe`   | session                                         | W   |                                                                               |
| POST   | `/push-subscriptions:test`          | session                                         | W   | sends a push to the player's devices                                          |
| GET    | `/chats`                            | session                                         | R   | display names, unread counts and mute state are computed for the caller       |
| POST   | `/chats`                            | session                                         | W   | the caller is always added to the participants                                |
| GET    | `/chats/{chat_id}/messages`         | session; `chat_id` checked against participants | R   | 403 for non-participants                                                      |
| POST   | `/chats/{chat_id}/messages`         | session; same                                   | W   | sender is the caller; also moves the caller's read marker                     |
| POST   | `/chats/{chat_id}:open`             | session; same                                   | W   | read marker                                                                   |
| POST   | `/chats/{chat_id}:mute`             | session; same                                   | W   | stored on the player (`muted_chat_ids`)                                       |
| POST   | `/chats/{chat_id}:unmute`           | session; same                                   | W   | same                                                                          |
| GET    | `/notifications`                    | session                                         | R   | the player's inbox                                                            |
| GET    | `/notifications/feed-subscriptions` | session                                         | R   | preferences                                                                   |
| PATCH  | `/notifications/feed-subscriptions` | session                                         | W   |                                                                               |
| PATCH  | `/notifications/{notification_id}`  | session; implicit id                            | W   | read, flagged, archived; 404 unless the notification is the caller's          |
| DELETE | `/notifications/{notification_id}`  | session; implicit id                            | W   | same                                                                          |
| POST   | `/notifications:markAllRead`        | session                                         | W   |                                                                               |
| GET    | `/players/me/settings`              | session, literal `me`                           | R   | one UI preference (`show_disclaimer` for chat)                                |
| PATCH  | `/players/me/settings`              | session, literal `me`                           | W   |                                                                               |

## Socket.io

Source: `src/energetica/freeplay/socketio.py`, `Player.emit` and `Player.invalidate_queries` in
`src/energetica/freeplay/database/player.py`, `GameEngine.emit` in
`src/energetica/freeplay/game_engine.py`, and the frontend listeners found with `useSocketEvent`.

**Connection.** The `connect` handler refuses any role other than `player`, and the frontend's
`SocketProvider` does not even try for a facilitator (`frontend/apps/freeplay/src/contexts/socket-context.tsx`).
A settled player's socket ids go into `player.socketio_clients`. An unsettled player connects but
is only reachable by broadcasts. A facilitator today gets no socket at all, so no `tick` and no
invalidations.

**Targeting.** A per-player push goes to that player's own socket ids and nowhere else. There are
no rooms. A broadcast goes to every connected socket.

| Event                    | Sent by                                                        | Target                   | Group                 | Consumed by frontend                                                      |
| ------------------------ | -------------------------------------------------------------- | ------------------------ | --------------------- | ------------------------------------------------------------------------- |
| `tick`                   | `engine.emit` in `utils/tick_execution.py`                     | broadcast                | Run-wide              | yes (`game-tick-context.tsx`)                                             |
| `invalidate` (broadcast) | `engine.invalidate_queries`, `engine.emit` in `map_helpers.py` | broadcast                | Run-wide              | yes; keys `map`, `players`, `resource-market/asks`, `electricity-markets` |
| `invalidate` (player)    | `player.invalidate_queries`, `player.emit`, `Player.notify`    | the player's sockets     | mixed                 | yes; see the key list below                                               |
| `worker_info`            | `Player.send_worker_info` (from `utils/projects.py`)           | the player's sockets     | Owned                 | yes (`use-player-workers.ts` writes the cache)                            |
| `display_new_message`    | `utils/misc.py` `send_new_message_sio`                         | each chat participant    | Viewer                | yes (`use-messages-page.ts`)                                              |
| `new_values`             | `Player.send_new_data`, every tick from `production_update.py` | the player's sockets     | Owned                 | **no** (money, chart values, climate)                                     |
| `new_network_values`     | `production_update.py`                                         | each member of a network | Run-wide (per market) | **no**                                                                    |
| `update_page_data`       | `Player.invalidate_recompute_and_dispatch_data_for_pages`      | the player's sockets     | Owned                 | **no**                                                                    |
| `finish_shipment`        | `utils/tick_execution.py`                                      | the player's sockets     | Owned                 | **no**                                                                    |
| `retrieve_player_data`   | `utils/projects.py`                                            | the player's sockets     | Owned                 | **no**                                                                    |
| `finish_construction`    | `utils/projects.py`                                            | the player's sockets     | Owned                 | **no**                                                                    |

Six of the eleven events have no listener in `frontend/` (checked by searching every event name).
They are left over from the old frontend and still cost work every tick (`new_values` is built
for every player each tick). Finishing a technology also sends `update_page_data` to **every other
player** (`utils/projects.py`, knowledge spillover), which is the one case of a player-owned push
reaching other players.

Query keys the backend invalidates on one player's sockets: `["auth","me"]`, `["players","me","money"]`,
`["players","me","settings"]`, `["facilities"]`, `["projects"]`, `["power-priorities"]`,
`["daily-quiz","today"]`, `["notifications"]`, `["chats"]`, `["chats", chat_id, "messages"]`, and on
settling `["map"]` and `["players"]`. The backend hard-codes the literal `"me"` segment in two
places (`routers/players.py`, `utils/facilities.py`), so it is coupled to the frontend's "me" keys.

## Frontend query keys

Source: `frontend/apps/freeplay/src/lib/query-client.ts` (the `queryKeys` table),
`frontend/apps/freeplay/src/lib/charts/query-keys.ts` (chart keys), and the hooks in
`frontend/apps/freeplay/src/hooks/`. API wrappers are in `src/lib/api/`.

| Key                                                                                                                                                              | Hook                          | Endpoint                                        | Group    | Says which player?                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- | -------- | --------------------------------------- |
| `["players","me","money"]`                                                                                                                                       | `use-player-money`, mutations | `/players/me/money`                             | Owned    | literal `me`                            |
| `["players","me","workers"]`                                                                                                                                     | `use-player-workers`          | `/players/me/workers`                           | Owned    | literal `me`                            |
| `["players","me","resources"]`                                                                                                                                   | `use-player-resources`        | `/players/me/resources`                         | Owned    | literal `me`                            |
| `["players","me","profile"]`                                                                                                                                     | `use-player-profile`          | `/players/me/profile`                           | Owned    | literal `me`                            |
| `["facilities"]`, `["facilities","statuses"]`                                                                                                                    | `use-facilities`              | `/facilities`, `/facilities/statuses`           | Owned    | no                                      |
| `["projects"]` and five `["projects","catalog",…]`                                                                                                               | `use-projects`                | `/projects`, `/projects/catalog/*`              | Owned    | no                                      |
| `["power-priorities"]`                                                                                                                                           | `use-power-priorities`        | `/power-priorities`                             | Owned    | no                                      |
| `["shipments"]`                                                                                                                                                  | `use-shipments`               | `/shipments`                                    | Owned    | no                                      |
| `["achievements","upcoming"]`                                                                                                                                    | `use-achievements`            | `/achievements`                                 | Owned    | no                                      |
| `["daily-quiz","today"]`                                                                                                                                         | `use-daily-quiz`              | `/daily-quiz`                                   | Owned    | no                                      |
| `["weather","current"]`, `["weather","climate-event-recoveries"]`                                                                                                | `use-weather`                 | `/weather`, `/weather/climate-event-recoveries` | Owned    | no                                      |
| `["charts", chartType, resolution, start, count]` (10 player chart types)                                                                                        | `use-charts`                  | `/charts/{type}/{resolution}`                   | Owned    | no                                      |
| `["resource-market","delivery-time", askId]`                                                                                                                     | `use-resource-market`         | `:calculate-delivery`                           | Owned    | no (depends on caller's tile)           |
| `["auth","me"]`                                                                                                                                                  | `auth-context`                | `/auth/me`                                      | Viewer   | literal `me`; also carries capabilities |
| `["lobby","my-runs"]`                                                                                                                                            | `use-my-runs`                 | `/lobby/my-runs`                                | Viewer   | no                                      |
| `["players","me","settings"]`                                                                                                                                    | `use-settings`                | `/players/me/settings`                          | Viewer   | literal `me`                            |
| `["chats"]`, `["chats", chatId, "messages"]`                                                                                                                     | `use-chats`                   | `/chats`, `/chats/{id}/messages`                | Viewer   | no                                      |
| `["notifications"]`, `["notifications","feed-subscriptions"]`                                                                                                    | `use-notifications`           | `/notifications/*`                              | Viewer   | no                                      |
| `["charts","climate"/"temperature", …]`                                                                                                                          | `use-charts`                  | `/charts/climate`, `/charts/temperature`        | Run-wide | n/a                                     |
| `["charts","markets", marketId, …]`, `["charts","markets", marketId,"orders", tick]`                                                                             | `use-charts`                  | `/charts/markets/*`                             | Run-wide | n/a                                     |
| `["players"]`, `["map"]`, `["leaderboards"]`, `["electricity-markets"]`, `["resource-market","asks"]`, `["game","engine"]`, `["push-subscriptions","vapid-key"]` | various                       | run-wide reads                                  | Run-wide | n/a                                     |

Other frontend facts that bear on the refactor:

- **Two kinds of "me" key.** Four owned keys and two viewer keys contain the literal string
  `"me"`. Every other owned key (facilities, projects, catalogs, power priorities, shipments,
  achievements, daily quiz, weather, player charts, delivery time) contains no player segment.
  Both kinds mean "the logged-in player". `["players","me"]` and `["players", id]` would also sit
  side by side under the same `["players"]` prefix, which the settle broadcast invalidates.
- **Dead keys.** `players.me`, `players.byId(id)`, `facilities.power/storage/extraction/functional`,
  `config.const`, and every `queryKeys.charts.*` entry except `marketOrderData` are never used.
  Chart keys are built by `buildChartQueryKey` instead. `players.byId` is the only id-shaped player
  key, and nothing uses it.
- **Where the frontend learns its own id.** `useCurrentPlayer()` and `useAuth().user.player_id`
  both read `player_id` from `/auth/me`. They are used to mark "me" inside run-wide data
  (own asks in the resource market, own row in leaderboards and market members) and in chat
  (own messages). That viewer comparison would stay even if every owned endpoint took an id.
- **Capabilities ride on the viewer.** Route guards (`RequireCapability`) and the sidebar read
  `user.capabilities` from `/auth/me`, so which pages exist depends on the logged-in player's
  progress, not on the player being shown.
- **Facilitator keys** for the join link and roster live in `@energetica/instance`
  (`instanceQueryKeys`), outside the freeplay app's table.

## Findings that matter for the decision

1. **The owned set is large and uniform.** 52 of 98 routes are owned by one player, and all 52
   resolve the player the same way (`get_settled_player`). Only 5 of them say `me` in the path; the
   other 47 name no player. 22 are writes, all frozen-guarded game actions.
2. **Implicit resource ids.** Facility, project, ask and notification ids are global, but the
   routes authorise them by "the caller owns it" (`facility.player != player` → 403, notification
   → 404). With an explicit player in the path, each check becomes "owned by the path's player",
   plus a separate rule for who may act as that player. `ask_id` on `:purchase` and
   `:calculate-delivery` is deliberately another player's, so those two act on two players.
   `chat_id` is checked against participants, and the chat list's display names, unread counts
   and mute state are computed for the caller.
3. **Misfits.**
   - `PATCH /electricity-markets/prices` writes the player's own prices but lives under the
     run-wide market collection, with no market id and no player id. It belongs with
     power priorities.
   - `GET /electricity-markets` returns run-wide data but is gated on the caller's achievement,
     so a facilitator gets 403 (no player) and a new player gets 403 even though the data is public.
   - `GET /charts/climate`, `/charts/temperature` and `/leaderboards` are run-wide but require a
     settled player, so facilitators cannot read them. `/map`, `/players` and market charts need no
     login at all. The auth requirement on run-wide reads is inconsistent.
   - `GET /daily-quiz` mixes a run-wide question with one player's answer and the correct answer.
   - `GET /weather` is a function of the player's tile, not of the player.
   - `POST :calculate-delivery` is a read sent as POST.
   - `GET /players/game-state` sits under `/players` but is a run-wide tick read.
   - `GET /players/me` duplicates what `GET /players` already returns and is never called.
   - `/auth/me` is the viewer's identity but also carries the player's `capabilities`, and the
     backend invalidates `["auth","me"]` on achievement changes. Player-owned state rides on the
     viewer endpoint.
   - `POST /map/settle` creates the player, so it cannot name one.
4. **Real-time is player-only.** Socket connections are refused for facilitators on both ends,
   and per-player pushes go only to that player's own socket ids (no rooms). A facilitator viewing
   any page today would get neither `tick` nor `invalidate`. Six of eleven event types are dead
   (never listened to), including the per-tick `new_values`.
5. **Privacy line, viewer group.** These are things a player would expect to stay private from
   other players and probably from a facilitator:
   - **Chat messages**: private conversations, guarded today only by the participant check.
     Facilitator access to chats is listed as out of scope in #1493.
   - **Push subscriptions**: browser push endpoints and keys. Exposing them lets someone send
     notifications to the player's devices. Never readable, by anyone.
   - **Account and cross-run membership** (`/auth/me`, `/lobby/my-runs`): about the account, not
     the player; `my-runs` lists the other runs the account is in.
   - **Notifications** and their read, flagged and archived state: a personal inbox, although the
     content is about the player's own game.
6. **Privacy line, owned group.** No route lets one player read another's owned data today, so
   money, resources, facilities, projects, shipments, power priorities and the financial charts
   (revenues, op costs, money) are private by construction. Two things to weigh:
   - **Some of it is already public.** `/leaderboards` exposes most of `/players/me/profile`
     (technology and functional facility levels, XP, network, emissions, trade volumes) for every
     player. The unauthenticated market order book (`/charts/markets/{id}/market/{tick}`) exposes
     every member's bid and ask prices and capacities by facility type, tick by tick, which is most
     of what `/power-priorities` and `PATCH /electricity-markets/prices` set. It needs no login
     and no membership in that market.
   - **The daily quiz answer leaks.** Once a player has answered, their `GET /daily-quiz` includes
     `correct_answer`. If another player could read it, they would learn today's answer.
7. **Facilitator surface today.** The six `/facilitator/*` routes are run-wide by design (router
   dependency, no per-facilitator state). They identify accounts by username, not by player id.
   `/facilitator/roster/candidates` searches every account on the server by username prefix.
