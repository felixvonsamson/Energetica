/**
 * Where to send a player when a decision phase starts or ends (#1251), so
 * nobody is left on a stale page:
 *
 * - The Investment phase starts: the facility catalog;
 * - A price-setting window starts: the season's page, on its Prices tab, with the
 *   price panel open (#1299);
 * - A price-setting window ends: the charts for that season;
 * - A Recap is published: the Recap.
 *
 * Only a change of phase redirects. The first look at the session, on page load
 * or after a reload, is not one.
 */

import {
    type Checkpoint,
    facilitiesPage,
    recapPage,
    tradingPeriodPage,
    type WorkshopPage,
} from "@/lib/workshop-timeline";

/** What a redirect needs to know about the session. */
export interface SessionPhase {
    checkpoint: Checkpoint;
    /** Whether a Trading period's price-setting window is open. */
    priceSettingOpen: boolean;
}

export type PhaseRedirect =
    | {
          kind: "navigate";
          page: WorkshopPage | ReturnType<typeof facilitiesPage>;
      }
    | { kind: "open_price_panel"; page: WorkshopPage };

/**
 * Where moving from `previous` to `current` sends a player, or `null` to leave
 * them where they are. `previous` is `null` on the first look at the session.
 */
export function phaseRedirect(
    previous: SessionPhase | null,
    current: SessionPhase,
): PhaseRedirect | null {
    if (previous === null) return null;
    const checkpoint = current.checkpoint;
    if (sameCheckpoint(previous.checkpoint, checkpoint)) {
        if (
            checkpoint.kind === "trading_period" &&
            previous.priceSettingOpen &&
            !current.priceSettingOpen
        ) {
            return seasonCharts(checkpoint);
        }
        return null;
    }
    switch (checkpoint.kind) {
        case "investment":
            return { kind: "navigate", page: facilitiesPage() };
        case "trading_period":
            // A window that already closed before it was seen has ended too.
            return current.priceSettingOpen
                ? {
                      kind: "open_price_panel",
                      page: tradingPeriodPage(
                          checkpoint.round,
                          checkpoint.season,
                      ),
                  }
                : seasonCharts(checkpoint);
        case "recap":
            return { kind: "navigate", page: recapPage(checkpoint.round) };
        case "not_started":
        case "finished":
            return null;
        default:
            throw checkpoint satisfies never;
    }
}

function seasonCharts(
    checkpoint: Extract<Checkpoint, { kind: "trading_period" }>,
): PhaseRedirect {
    return {
        kind: "navigate",
        page: tradingPeriodPage(checkpoint.round, checkpoint.season),
    };
}

function sameCheckpoint(a: Checkpoint, b: Checkpoint): boolean {
    return (
        a.kind === b.kind &&
        ("round" in a ? a.round : null) === ("round" in b ? b.round : null) &&
        ("season" in a ? a.season : null) === ("season" in b ? b.season : null)
    );
}
