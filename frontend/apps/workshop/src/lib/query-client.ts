/**
 * This app's query client and its query keys.
 *
 * The client starts from the shared factory in `@energetica/core/query-client`,
 * so mutations are not retried unless they opt in.
 *
 * The Workshop's backend tells the app which queries to re-read through
 * Socket.IO `invalidate` messages that name query keys (see `useWorkshopSocket`
 * in `hooks/use-workshop.ts`), so the keys below are a contract with that
 * backend: `src/energetica/workshop/realtime.py` names the session's key,
 * `["workshop", "session"]`, and the market prices' and control room's keys
 * under it. Most keys sit under the session's, so a session change re-reads
 * them all. Never hardcode a query key elsewhere: import it from here.
 *
 * `facilitator` and `join` belong to `@energetica/instance`, which owns their
 * queries: see `instanceQueryKeys` there.
 */

import { createQueryClient } from "@energetica/core/query-client";

export const queryClient = createQueryClient({
    onMutationError: (error) => {
        console.error("API Error:", error);
    },
});

/** Query keys for consistent cache management. */
export const queryKeys = {
    workshop: {
        entry: ["workshop", "entry"] as const,
        session: ["workshop", "session"] as const,
        // These two sit under the session's key, so every session change the server announces
        // re-reads them. Advancing to a new Round can unlock a facility, and it shortens each owned
        // facility's lifetime left.
        facilities: ["workshop", "session", "facilities"] as const,
        fleet: ["workshop", "session", "fleet"] as const,
        // Also under the session's key: the purchase when the Investment phase closes empties it.
        selection: ["workshop", "session", "selection"] as const,
        // Also under the session's key: a new Trading period opens their window, and a facility that
        // starts operating needs a price.
        prices: ["workshop", "session", "prices"] as const,
        // Also under the session's key: a new Trading period sets the season's fuel prices and
        // default orders, and settling one changes the stock (#1009).
        fuel: ["workshop", "session", "fuel"] as const,
        // Not under the session's key: only the setup script changes it (#1385).
        credentials: ["workshop", "credentials"] as const,
        // Also under the session's key: each purchase adds to a technology's progress, and a Recap
        // can unlock one (#1011).
        unlocks: ["workshop", "session", "unlocks"] as const,
        // Also under the session's key: a period or Round opening fires the events
        // planned for it, and settling one adds to the emissions (#1012).
        events: ["workshop", "session", "events"] as const,
        // Also under the session's key: a Recap locks the next Round's plan, and a
        // period or Round opening fires its planned events (#1190).
        plans: ["workshop", "session", "plans"] as const,
        // Also under the session's key, so a change from another tab shows here (#1018).
        timers: ["workshop", "session", "timers"] as const,
        // Also under the session's key: the Investment phase closing counts the vote (#1014).
        vote: ["workshop", "session", "vote"] as const,
        // Also under the session's key: a Round starting takes a payment, and the Investment phase
        // closing makes the loan final (#1225).
        loan: ["workshop", "session", "loan"] as const,
        // A Trading period's review (#1007). The summary sits under the session's key, so a
        // period that was not settled when first asked for is read again once it is. What a
        // settled period did never changes, so its days and merit orders are read once.
        period: (round: number, season: string) =>
            ["workshop", "session", "periods", round, season] as const,
        // Every player's prices for a Trading period (#1299). The server invalidates them all
        // when a player changes a price, and they sit under the session's key, so they are read
        // again when the window closes or the period is settled.
        marketPrices: ["workshop", "session", "market-prices"] as const,
        marketPricesFor: (round: number, season: string) =>
            [...queryKeys.workshop.marketPrices, round, season] as const,
        // A player's balance sheet for a Round (#1008). Under the session's key, so it fills in
        // as each of the Round's Trading periods is settled.
        balanceSheet: (round: number) =>
            ["workshop", "session", "balance-sheet", round] as const,
        // Every Round's balance sheet, to read them all again when the loan changes (#1225).
        balanceSheets: ["workshop", "session", "balance-sheet"] as const,
        // The Recap that closes a Round (#1013). Under the session's key, so it is read
        // again once the Recap opens.
        recap: (round: number) =>
            ["workshop", "session", "recap", round] as const,
        // Every player's score (#1017, #1250). Under the session's key, so it is read again
        // as each Recap opens.
        scoreboard: ["workshop", "session", "scoreboard"] as const,
        // The visitor's feedback on the game. Not under the session's key: no session change
        // alters it.
        feedback: ["workshop", "feedback"] as const,
        // The control room (#1289). Under the session's key, so every session change re-reads
        // it, and the server also names it when a player changes a price.
        controlRoom: ["workshop", "session", "control-room"] as const,
        periodDays: (
            round: number,
            season: string,
            firstDay: number,
            count: number,
        ) =>
            [
                "workshop",
                "periods",
                round,
                season,
                "days",
                firstDay,
                count,
            ] as const,
        seasonOverview: (round: number, season: string) =>
            ["workshop", "periods", round, season, "overview"] as const,
        meritOrder: (round: number, season: string, point: number) =>
            ["workshop", "periods", round, season, "points", point] as const,
    },
} as const;
