/**
 * The price-setting panel (#1002): the prices the player offers their
 * facilities' power at, one per facility type they have operating, and a buy
 * and a sell price for each storage type. It sits beside the page rather than
 * over it, so the player can set prices while still looking at their data.
 *
 * Prices can be changed while a Trading period's price-setting window is open,
 * and are locked when its countdown ends. A field cannot be left empty or set
 * below the price floor: it goes back to the last price when it loses focus.
 */

import { AlertTriangle, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
    usePriceSettingOpen,
    useSetPrice,
    useWorkshopFacilities,
    useWorkshopFleet,
    useWorkshopPrices,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import { workshopFacilityImages } from "@/lib/workshop-facilities";
import { parsePrice, pricedFacilities } from "@/lib/workshop-prices";
import type { ApiSchema } from "@/types/api-helpers";

type FacilityId = ApiSchema<"FacilityId">;
type WorkshopPrices = ApiSchema<"WorkshopPricesOut">;

/** How long after the last keystroke a typed price is sent, in milliseconds. */
const SEND_DELAY_MS = 600;

export function PricePanel({ onClose }: { onClose: () => void }) {
    const prices = useWorkshopPrices();
    const fleet = useWorkshopFleet();
    const facilities = useWorkshopFacilities();
    const open = usePriceSettingOpen();
    const names = new Map(
        facilities.data?.map((facility) => [facility.id, facility.name]),
    );

    return (
        <aside
            aria-label="Your prices"
            className="flex w-80 max-w-[85vw] shrink-0 flex-col border-l border-border bg-card"
        >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-titles text-lg">Your prices</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close the price panel"
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
                <WindowStatus open={open} />
                {prices.isError || fleet.isError ? (
                    <p className="text-sm text-destructive">
                        Could not load your prices. They are retried every few
                        seconds.
                    </p>
                ) : !prices.data || !fleet.data ? (
                    <div className="flex justify-center py-8">
                        <Spinner />
                    </div>
                ) : (
                    <PriceList
                        // Starting the fields afresh when the window opens or closes drops
                        // anything half-typed, so it does not come back in the next window.
                        key={String(open)}
                        facilities={pricedFacilities(fleet.data)}
                        names={names}
                        prices={prices.data}
                        open={open}
                    />
                )}
            </div>
        </aside>
    );
}

function WindowStatus({ open }: { open: boolean }) {
    const { data: session } = useWorkshopSession();
    const inTradingPeriod = session?.checkpoint.kind === "trading_period";

    return (
        <p className="text-sm text-muted-foreground">
            {open
                ? "Change your prices until the countdown ends. They then hold for the whole Trading period."
                : inTradingPeriod
                  ? "Your prices are locked for this Trading period."
                  : "You can change your prices at the start of each Trading period."}{" "}
            Prices are per MWh.
        </p>
    );
}

function PriceList({
    facilities,
    names,
    prices,
    open,
}: {
    facilities: FacilityId[];
    names: Map<FacilityId, string>;
    prices: WorkshopPrices;
    open: boolean;
}) {
    if (facilities.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                You have no facilities operating, so there is nothing to price.
            </p>
        );
    }
    return (
        <ul className="space-y-3">
            {facilities.map((facility) => (
                <PriceRow
                    key={facility}
                    facility={facility}
                    name={names.get(facility) ?? facility}
                    prices={prices}
                    open={open}
                />
            ))}
        </ul>
    );
}

function PriceRow({
    facility,
    name,
    prices,
    open,
}: {
    facility: FacilityId;
    name: string;
    prices: WorkshopPrices;
    open: boolean;
}) {
    const sell = prices.sell[facility];
    const buy = prices.buy[facility];
    if (sell === undefined) return null;

    return (
        <li className="rounded-md border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
                <img
                    src={workshopFacilityImages[facility]}
                    alt=""
                    className="size-8 rounded object-cover"
                />
                <span className="text-sm font-medium">{name}</span>
            </div>
            <div className="space-y-2">
                <PriceField
                    facility={facility}
                    side="sell"
                    label={buy === undefined ? "Price" : "Sell at"}
                    saved={sell}
                    floor={prices.price_floor}
                    disabled={!open}
                />
                {buy !== undefined && (
                    <>
                        <PriceField
                            facility={facility}
                            side="buy"
                            label="Buy at"
                            saved={buy}
                            floor={prices.price_floor}
                            disabled={!open}
                        />
                        {sell < buy && (
                            <p className="flex items-start gap-1.5 text-xs text-warning">
                                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                                Your sell price is below your buy price, so you
                                may lose money on the energy you store.
                            </p>
                        )}
                    </>
                )}
            </div>
        </li>
    );
}

/**
 * One price. A valid price is sent a moment after the player stops typing, and
 * straight away when the field loses focus.
 */
function PriceField({
    facility,
    side,
    label,
    saved,
    floor,
    disabled,
}: {
    facility: FacilityId;
    side: "sell" | "buy";
    label: string;
    /** The price as the server last had it, or as last sent. */
    saved: number;
    floor: number;
    disabled: boolean;
}) {
    const id = useId();
    const setPrice = useSetPrice(facility, side);
    // What the player is typing, or null while the field shows `saved`.
    const [draft, setDraft] = useState<string | null>(null);
    const sendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const text = disabled || draft === null ? String(saved) : draft;
    const parsed = parsePrice(text, floor);

    function send(typed: string) {
        clearTimeout(sendTimer.current);
        const result = parsePrice(typed, floor);
        if (result.ok && result.price !== saved) setPrice.mutate(result.price);
    }

    return (
        <div>
            <div className="flex items-center gap-2">
                <label
                    htmlFor={id}
                    className="w-14 shrink-0 text-xs text-muted-foreground"
                >
                    {label}
                </label>
                <div className="relative flex-1">
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
                            // An empty or invalid field goes back to the last price.
                            setDraft(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter")
                                event.currentTarget.blur();
                        }}
                        className="pr-16 text-right tabular-nums"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-0.5 text-xs text-muted-foreground">
                        <CoinIcon className="size-3" />
                        /MWh
                    </span>
                </div>
            </div>
            {!parsed.ok && (
                <p className="mt-1 text-right text-xs text-destructive">
                    {parsed.reason === "empty"
                        ? "Enter a price."
                        : parsed.reason === "below_floor"
                          ? `The lowest price is ${floor}.`
                          : "Enter a number."}
                </p>
            )}
        </div>
    );
}
