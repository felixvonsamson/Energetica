# Offline Resilience

How the persistent world's frontend (the `freeplay` app) behaves when the player's connection drops or the server goes down, and what it does to recover.

Two different outages reach the app, and they behave differently:

- **The browser is offline.** The device has no network, and the browser fires its `offline` event.
- **The server is unreachable.** The browser still believes it is online, but requests fail. This happens when the server restarts, or when a mobile connection is technically up but drops packets.

## When the browser is offline

TanStack Query listens to the browser's `online` and `offline` events itself, through its `onlineManager`. With `networkMode: "online"`, which is the default for both queries and mutations:

- **Queries pause.** A query that would fetch does not send a request. It keeps its cached data and does not use up its retries. When the browser comes back online, active queries whose data is stale refetch (`refetchOnReconnect: true`).
- **Mutations pause, then send.** A mutation started while offline waits, and TanStack Query sends it when the browser comes back online. The action is not dropped, but it can reach the server long after the player clicked.

The Socket.IO connection drops at once too: its client closes the connection when the browser fires `offline`. It skips this on `localhost`, so in local development the socket only notices when its heartbeat times out. The next section describes what a disconnected socket does.

## When the server is unreachable

- **Socket.IO disconnects and reconnects on its own.** It retries with a growing delay, using the library defaults (1 s, growing to at most 5 s). Tick and `invalidate` events stop arriving while it is down.
- **Queries retry, then fail.** A failed fetch is retried up to 3 times, after 1 s, 2 s and 4 s. Client errors (4xx) are not retried. After the last retry the query is in its error state, but **its cached data stays available**, so components keep showing the last known values.
- **Mutations fail at once.** Mutations are not retried by default, because a write that reached the server but lost its response would otherwise apply twice. The comment in `frontend/packages/core/src/query-client.ts` explains this. Each mutation shows its own error, usually through `toastActionError`.

## Recovering when the socket reconnects

`GameTickProvider` (`frontend/apps/freeplay/src/contexts/game-tick-context.tsx`) handles the return of the socket:

- It marks the current tick as stale while the socket is down, and reads the tick again over HTTP as soon as the socket reconnects. It does the same when a hidden tab becomes visible, because the browser may have frozen the tab and missed tick events.
- Queries registered with `useTickQuery` refetch on the next tick event.

## What the player sees

The only connection indicator today is on the money display in the top bar (`frontend/apps/freeplay/src/components/layout/top-bar.tsx`). When the money query is in its error state, the amount is dimmed. If the socket is also disconnected, an alert icon appears next to it. The worker counts next to it also dim when their query fails, but show no icon.

## Known gaps

- **Missed invalidations are not replayed.** The server tells the client which queries to refetch through `invalidate` socket events. Events sent while the socket is down are lost, and nothing refetches those queries on reconnect. They keep showing out-of-date data until their `staleTime` runs out; only after that does a window focus, a remount or a browser reconnect refetch them. Queries registered with `useTickQuery` are not affected, because they refetch on the next tick anyway.
- **No global connection banner.** Apart from the money indicator, nothing tells the player that the connection is down.
- **Actions stay enabled while disconnected.** Buttons do not check `useSocket().isConnected`, so a player can start a mutation while the server is unreachable and get an error toast.

## Configuration

The retry, refetch and network-mode settings described above are the shared defaults in `createQueryClient` (`frontend/packages/core/src/query-client.ts`), which each app builds its query client from. Read that file for the exact values. Individual hooks override `staleTime` as needed.

## Testing by hand

The two outages need different setups:

- **Browser offline:** in Chrome DevTools, open the Network tab and set throttling to "Offline". Queries and mutations pause instead of failing. Set it back to "No throttling" and check that stale queries refetch and that any paused mutation is sent.
- **Server unreachable:** stop the backend while the app is open. Check that cached data stays visible, that the money display dims and shows the alert icon once its query fails, and that a mutation shows an error toast. Restart the backend and check that the socket reconnects and the tick resumes.
