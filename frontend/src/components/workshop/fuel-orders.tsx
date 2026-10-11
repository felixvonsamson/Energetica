/**
 * The fuel part of the bids panel (#1009): under manual procurement, how much
 * of each fuel the player buys when the price-setting window closes. It shows
 * only the fuels the player's operating facilities burn.
 *
 * Each row is laid out like a facility's row above it: the fuel's image, then
 * the player's stock, their maximum consumption (what their facilities burn
 * running at full output all season), the season's price with its change since
 * last season (in red, with a note, when a price shock landed), and the
 * quantity to buy. The quantity starts at a default the server sets, and a
 * quantity that would take the stock over the stockpile limit is cut down to
 * fit.
 */

import { useEffect, useId, useRef, useState } from "react";

import { CoinIcon } from "@/components/ui/coin-icon";
import { Input } from "@/components/ui/input";
import { useSetFuelOrder } from "@/hooks/use-workshop";
import { formatMass, formatMoney } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import {
    KG_PER_TONNE,
    formatPriceChange,
    isOverStockpile,
    parseTonnes,
    stockpileSeasons,
    tonnesFieldText,
    workshopFuelColor,
    workshopFuelImages,
} from "@/lib/workshop-fuel";
import type { ApiSchema } from "@/types/api-helpers";

type FuelLine = ApiSchema<"WorkshopFuelLineOut">;

/** How long after the last keystroke a typed quantity is sent, in milliseconds. */
const SEND_DELAY_MS = 600;

export function FuelOrders({
    fuels,
    open,
}: {
    fuels: FuelLine[];
    open: boolean;
}) {
    if (fuels.length === 0) return null;
    return (
        <section aria-labelledby="fuel-heading" className="mt-6">
            <h3
                id="fuel-heading"
                className="mb-3 font-titles text-xl leading-tight text-fg-base"
            >
                Fuel
            </h3>
            <ul className="flex flex-col gap-3">
                {fuels.map((line) => (
                    <FuelRow key={line.fuel} line={line} open={open} />
                ))}
            </ul>
        </section>
    );
}

function FuelRow({ line, open }: { line: FuelLine; open: boolean }) {
    const change = formatPriceChange(line.change);
    return (
        <li className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3.5 rounded-xl border border-border-subtle bg-surface-raised p-2 shadow-[0_1px_2px_rgba(54,48,20,0.12)]">
            <img
                src={workshopFuelImages[line.fuel]}
                alt=""
                className="aspect-square w-full self-center rounded-lg object-cover"
            />
            <div className="flex min-w-0 flex-col gap-1.5 py-0.5 pr-1">
                <div>
                    <div className="flex items-center gap-[7px]">
                        <span
                            className="relative -top-0.5 size-[11px] shrink-0 rounded-[2px]"
                            style={{
                                backgroundColor: workshopFuelColor(line.fuel),
                            }}
                        />
                        <span className="text-[17px] leading-tight font-bold text-fg-base">
                            {line.name}
                        </span>
                    </div>
                    <dl className="text-[13px] leading-snug">
                        <div className="flex flex-wrap gap-x-1">
                            <dt className="whitespace-nowrap text-fg-subtle">
                                Stock
                            </dt>
                            <dd className="font-bold whitespace-nowrap text-fg-base">
                                {formatMass(line.stock)}
                            </dd>
                        </div>
                        <div className="flex flex-wrap gap-x-1">
                            <dt className="whitespace-nowrap text-fg-subtle">
                                Max consumption
                            </dt>
                            <dd className="font-bold whitespace-nowrap text-fg-base">
                                {formatMass(line.season_need)}/season
                            </dd>
                        </div>
                    </dl>
                </div>
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <span className="w-[52px] shrink-0 text-sm font-medium text-fg-muted">
                            Price
                        </span>
                        <span className="flex items-center gap-1 text-sm whitespace-nowrap text-fg-base">
                            <span className="font-mono font-medium">
                                {formatMoney(line.price * KG_PER_TONNE)}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-xs text-fg-muted">
                                <CoinIcon className="size-3" />
                                /t
                            </span>
                            {change !== null && (
                                <span
                                    className={cn(
                                        "text-xs font-semibold",
                                        line.shocked
                                            ? "text-destructive"
                                            : "text-fg-muted",
                                    )}
                                >
                                    ({change})
                                </span>
                            )}
                        </span>
                    </div>
                    {line.shocked && (
                        <p className="pl-[60px] text-xs text-destructive">
                            Geopolitical shock
                        </p>
                    )}
                </div>
                {line.order !== null && (
                    <OrderField
                        line={line}
                        order={line.order}
                        disabled={!open}
                    />
                )}
            </div>
        </li>
    );
}

/**
 * The quantity to buy, in tonnes. A valid quantity is sent a moment after the
 * player stops typing, and straight away when the field loses focus.
 */
function OrderField({
    line,
    order,
    disabled,
}: {
    line: FuelLine;
    /** The quantity in kg as the server last had it, or as last sent. */
    order: number;
    disabled: boolean;
}) {
    const id = useId();
    const setOrder = useSetFuelOrder(line.fuel);
    // What the player is typing, or null while the field shows `order`.
    const [draft, setDraft] = useState<string | null>(null);
    // Whether the last quantity sent was over the stockpile limit, so the server
    // cut it down.
    const [capped, setCapped] = useState(false);
    const sendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    // The order and stock as they are when a delayed send fires, not as they
    // were at the keystroke that scheduled it.
    const latest = useRef({ line, order });
    useEffect(() => {
        latest.current = { line, order };
    });
    // As in the price fields, a pending send goes with the field when it
    // unmounts at the window's opening or closing.
    useEffect(() => () => clearTimeout(sendTimer.current), []);
    const text = disabled || draft === null ? tonnesFieldText(order) : draft;
    const parsed = parseTonnes(text);
    const over = parsed.ok && isOverStockpile(parsed.kg, line);

    function send(typed: string) {
        clearTimeout(sendTimer.current);
        const result = parseTonnes(typed);
        if (!result.ok) return;
        const current = latest.current;
        setCapped(isOverStockpile(result.kg, current.line));
        if (result.kg !== current.order) setOrder.mutate(result.kg);
    }

    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
                <label
                    htmlFor={id}
                    className="w-[52px] shrink-0 text-sm font-medium text-fg-muted"
                >
                    Buy
                </label>
                <div className="relative w-32 shrink-0">
                    <Input
                        id={id}
                        type="text"
                        inputMode="decimal"
                        value={text}
                        disabled={disabled}
                        aria-invalid={!parsed.ok}
                        onChange={(event) => {
                            const typed = event.target.value;
                            setDraft(typed);
                            clearTimeout(sendTimer.current);
                            sendTimer.current = setTimeout(
                                () => send(typed),
                                SEND_DELAY_MS,
                            );
                        }}
                        onBlur={() => {
                            if (draft !== null) send(draft);
                            // An empty or invalid field goes back to the last quantity.
                            setDraft(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter")
                                event.currentTarget.blur();
                        }}
                        className="h-9 rounded-md border-border-brand bg-white pr-8 pl-2.5 text-right font-mono text-sm font-medium text-fg-base shadow-none focus-visible:border-border-brand focus-visible:ring-[3px] focus-visible:ring-pine-500/35 aria-invalid:ring-[3px] md:text-sm"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-fg-muted">
                        t
                    </span>
                </div>
            </div>
            {!parsed.ok ? (
                <p className="pl-[60px] text-[13px] text-destructive">
                    {parsed.reason === "empty"
                        ? "Enter a quantity."
                        : parsed.reason === "negative"
                          ? "The quantity cannot be negative."
                          : "Enter a number."}
                </p>
            ) : (
                (over || capped) && (
                    <p className="pl-[60px] text-[13px] text-warning">
                        The stockpile is limited to {stockpileSeasons(line)}{" "}
                        times the 100% needs.
                    </p>
                )
            )}
        </div>
    );
}
