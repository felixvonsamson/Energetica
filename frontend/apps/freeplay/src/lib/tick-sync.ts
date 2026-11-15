/**
 * Tracks the client's copy of the current game tick and whether it can be
 * trusted to match the server.
 *
 * The tick normally arrives through socket `tick` events. When the socket drops
 * or the browser freezes the tab, those events stop and the copy falls behind
 * the server. Anything that builds requests from the tick (such as chart
 * ranges) should wait until the tick is fresh again, which happens on the next
 * socket tick or when the tick is re-read from the server.
 */

export interface TickSyncState {
    /** Last known tick, or undefined before the first one arrives. */
    tick: number | undefined;
    /** Whether `tick` is known to match the server. */
    isFresh: boolean;
}

export type TickSyncEvent =
    /** A socket `tick` event arrived. */
    | { type: "tick"; tick: number }
    /** The tick was re-read from the server over HTTP. */
    | { type: "resynced"; tick: number }
    /** The tick may have fallen behind the server. */
    | { type: "stale" };

export const INITIAL_TICK_SYNC: TickSyncState = {
    tick: undefined,
    isFresh: false,
};

export function tickSyncReducer(
    state: TickSyncState,
    event: TickSyncEvent,
): TickSyncState {
    switch (event.type) {
        case "tick":
        case "resynced":
            // Ticks only move forward. A re-read that was in flight while a
            // socket tick arrived can return an older value.
            return {
                tick: Math.max(state.tick ?? event.tick, event.tick),
                isFresh: true,
            };
        case "stale":
            return { ...state, isFresh: false };
    }
}
