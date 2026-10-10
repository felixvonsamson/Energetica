/**
 * The fuel part of the bids panel (#1009): under manual procurement, how much
 * of each fuel the player buys when the price-setting window closes. It shows
 * only the fuels the player's operating facilities burn.
 *
 * Each row shows the season's price and its change since last season (in red,
 * with a note, when a price shock landed), the player's stock, and their
 * maximum consumption: what their facilities burn running at full output all
 * season. The quantity starts at a default the server sets, and a quantity that
 * would take the stock over the stockpile limit is cut down to fit.
 */

import { Flame } from "lucide-react";
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
        <li className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-raised p-3 shadow-[0_1px_2px_rgba(54,48,20,0.12)]">
            <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[17px] leading-tight font-bold text-fg-base">
                    <Flame className="size-4 text-fg-muted" />
                    {line.name}
                </span>
                <span className="flex items-center gap-1 text-sm whitespace-nowrap text-fg-base">
                    <CoinIcon className="size-3" />
                    <span className="font-mono font-medium">
                        {formatMoney(line.price * KG_PER_TONNE)}
                    </span>
                    <span className="text-xs text-fg-muted">/t</span>
                    {change !== null && (
                        <span
                            className={cn(
                                "ml-1 text-xs font-semibold",
                                line.shocked
                                    ? "text-destructive"
                                    : "text-fg-muted",
                            )}
                        >
                            {change}
                        </span>
                    )}
                </span>
            </div>
            {line.shocked && (
                <p className="text-right text-xs text-destructive">
                    Geopolitical shock
                </p>
            )}
            <dl className="flex flex-wrap justify-between gap-x-3 text-[13px] leading-snug">
                <div className="flex gap-1">
                    <dt className="text-fg-subtle">Stock:</dt>
                    <dd className="font-bold text-fg-base">
                        {formatMass(line.stock)}
                    </dd>
                </div>
                <div className="flex gap-1">
                    <dt className="text-fg-subtle">Max consumption:</dt>
                    <dd className="font-bold text-fg-base">
                        {formatMass(line.season_need)}/season
                    </dd>
                </div>
            </dl>
            {line.order !== null && (
                <OrderField line={line} order={line.order} disabled={!open} />
            )}
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
