/**
 * The room's prices for a Trading period (#1299), on the Trading period page's
 * Prices tab. It shows one row per player and one column per facility type
 * someone had operating, with a sell and a buy column for storage. A player
 * without that type gets a dash.
 *
 * Like a trading board, each price is green with an up arrow when it is higher
 * than the price the type ran at in the player's last Trading period, and red
 * with a down arrow when it is lower. Players sell, so a higher price is green.
 * A type the player did not have before, as in the very first Trading period,
 * is compared with its default price. A price that did not change stays
 * neutral.
 *
 * While the price-setting window is open, the board updates live as players
 * change their prices. Afterwards it shows the prices the period ran at.
 *
 * The board cannot be edited. A player who clicks their own row is told where
 * to set their prices, and the price panel opens if the window is open
 * (#1388).
 */

import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";

import { PlayerName } from "@/components/workshop/player-name";
import { useOpenPricePanel } from "@/contexts/price-panel-context";
import {
    useMarketPrices,
    usePriceSettingOpen,
    useWorkshopEntry,
    useWorkshopTeams,
} from "@/hooks/use-workshop";
import {
    type MarketColumn,
    marketColumns,
    ownRowClick,
    priceTrend,
} from "@/lib/workshop-market-prices";
import type { Season } from "@/lib/workshop-timeline";
import type { ApiSchema } from "@/types/api-helpers";
import { ApiClientError } from "@energetica/core/api-client";
import { formatMoney } from "@energetica/core/format-utils";
import { Spinner } from "@energetica/ui/components/spinner";
import { TypographyMuted } from "@energetica/ui/components/typography";
import { cn } from "@energetica/ui/lib/utils";

type PlayerQuotes = ApiSchema<"PlayerQuotes">;
type QuotedPrice = ApiSchema<"QuotedPrice">;

export function MarketPricesBoard({
    round,
    season,
}: {
    round: number;
    season: Season;
}) {
    const room = useMarketPrices(round, season);
    const { data: entry } = useWorkshopEntry();
    const { teamOf } = useWorkshopTeams();
    const windowOpen = usePriceSettingOpen();
    const openPricePanel = useOpenPricePanel();

    if (room.isPending) return <Spinner />;
    if (room.isError) {
        const notStarted =
            room.error instanceof ApiClientError && room.error.status === 404;
        return (
            <TypographyMuted className="pt-4">
                {notStarted
                    ? "This Trading period has not started yet."
                    : "The prices could not be loaded."}
            </TypographyMuted>
        );
    }

    // The room's own list of types, not the reader's catalog, which leaves out
    // types no longer offered that the reader does not own.
    const names = new Map(
        room.data.facilities.map((facility) => [facility.id, facility.name]),
    );
    const columns = marketColumns(
        room.data.players,
        room.data.facilities.map((facility) => facility.id),
    );
    if (columns.length === 0) {
        return (
            <TypographyMuted className="pt-4">
                Nobody had anything operating in this Trading period.
            </TypographyMuted>
        );
    }
    // Facility types in column order, each with its sell and buy columns.
    const groups = Map.groupBy(columns, (column) => column.facility);
    const hasBuy = columns.some((column) => column.side === "buy");
    const me = entry?.player?.account_id;

    function handleOwnRowClick() {
        const click = ownRowClick(windowOpen);
        if (click.openPanel) openPricePanel();
        toast.info(click.message, { id: "workshop-prices-board-own-row" });
    }

    return (
        <div className="space-y-3 pt-4">
            <BoardStatus live={room.data.live} />
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-secondary">
                        <tr>
                            <th
                                rowSpan={hasBuy ? 2 : 1}
                                className="sticky left-0 bg-secondary py-2 px-4 text-left font-semibold"
                            >
                                Player
                            </th>
                            {[...groups].map(([facility, sides]) => (
                                <th
                                    key={facility}
                                    colSpan={sides.length}
                                    rowSpan={
                                        hasBuy && sides.length === 1 ? 2 : 1
                                    }
                                    className="py-2 px-4 text-right font-semibold whitespace-nowrap"
                                >
                                    {names.get(facility) ?? facility}
                                </th>
                            ))}
                        </tr>
                        {hasBuy && (
                            <tr>
                                {columns
                                    .filter(
                                        (column) =>
                                            groups.get(column.facility)!
                                                .length > 1,
                                    )
                                    .map((column) => (
                                        <th
                                            key={`${column.facility}-${column.side}`}
                                            className="pb-2 px-4 text-right text-xs font-medium text-muted-foreground"
                                        >
                                            {column.side === "sell"
                                                ? "Sell"
                                                : "Buy"}
                                        </th>
                                    ))}
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {room.data.players.map((player) => (
                            <BoardRow
                                key={player.account_id}
                                player={player}
                                team={teamOf(player.account_id)}
                                columns={columns}
                                isMe={player.account_id === me}
                                onOwnRowClick={handleOwnRowClick}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            <TypographyMuted className="text-xs">
                Arrows compare each price with the one it ran at in the
                player&apos;s last Trading period, or with the default price if
                there was none.
            </TypographyMuted>
        </div>
    );
}

function BoardStatus({ live }: { live: boolean }) {
    if (!live) {
        return (
            <TypographyMuted>
                The prices this Trading period ran at.
            </TypographyMuted>
        );
    }
    return (
        <p className="flex items-center gap-2 text-sm font-medium">
            <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            Live: the prices players are setting now.
        </p>
    );
}

function BoardRow({
    player,
    team,
    columns,
    isMe,
    onOwnRowClick,
}: {
    player: PlayerQuotes;
    team: string | null;
    columns: MarketColumn[];
    isMe: boolean;
    onOwnRowClick: () => void;
}) {
    return (
        <tr
            onClick={isMe ? onOwnRowClick : undefined}
            className={cn(
                "border-t border-border/30",
                isMe && "bg-primary/10 font-semibold",
            )}
        >
            <td
                className={cn(
                    "sticky left-0 py-2 px-4 whitespace-nowrap",
                    isMe ? "bg-primary/10" : "bg-background",
                )}
            >
                {/*
                 * The button lets keyboard users reach the row. Its click bubbles
                 * up to the row's handler. Neither looks clickable, since the
                 * board is not meant to be edited.
                 */}
                {isMe ? (
                    <button
                        type="button"
                        aria-label="Change your prices"
                        className="rounded-sm"
                    >
                        <PlayerName username={player.username} team={team} />
                    </button>
                ) : (
                    <PlayerName username={player.username} team={team} />
                )}
                {isMe && (
                    <span className="ml-1 font-normal text-muted-foreground">
                        (you)
                    </span>
                )}
            </td>
            {columns.map(({ facility, side }) => (
                <PriceCell
                    key={`${facility}-${side}`}
                    quote={player[side][facility]}
                />
            ))}
        </tr>
    );
}

function PriceCell({ quote }: { quote: QuotedPrice | undefined }) {
    if (quote === undefined) {
        return (
            <td className="py-2 px-4 text-right font-mono text-muted-foreground">
                -
            </td>
        );
    }
    const trend = priceTrend(quote);
    const Arrow =
        trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : null;
    return (
        <td
            title={
                quote.previous === null
                    ? `Default price: ${formatMoney(quote.default)}/MWh`
                    : `Last period: ${formatMoney(quote.previous)}/MWh`
            }
            className={cn(
                "py-2 px-4 text-right font-mono whitespace-nowrap tabular-nums",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
            )}
        >
            <span className="inline-flex items-center justify-end gap-1">
                {formatMoney(quote.price)}
                {Arrow ? (
                    <Arrow className="size-3.5" aria-label={trend} />
                ) : (
                    <span className="size-3.5" />
                )}
            </span>
        </td>
    );
}
