/**
 * The price-setting panel (#1002), titled "Your Bids": the prices the player
 * offers their facilities' power at, one per facility type they have operating,
 * and a buy and a sell price for each storage type. Each row shows the
 * facility's image and how much of it the player has installed. It sits beside
 * the page rather than over it, so the player can set prices while still
 * looking at their data.
 *
 * Prices can be changed while a Trading period's price-setting window is open,
 * and are locked when its countdown ends. A field cannot be left empty or set
 * below the price floor: it goes back to the last price when it loses focus.
 */

import { AlertTriangle, X, Zap } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { CoinIcon } from "@/components/ui/coin-icon";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
    usePriceSettingOpen,
    useSetPrice,
    useWorkshopFacilities,
    useWorkshopFleet,
    useWorkshopPrices,
} from "@/hooks/use-workshop";
import { formatEnergy, formatPower } from "@/lib/format-utils";
import {
    workshopFacilityColor,
    workshopFacilityImages,
} from "@/lib/workshop-facilities";
import {
    installedCapacity,
    parsePrice,
    pricedFacilities,
} from "@/lib/workshop-prices";
import type { ApiSchema } from "@/types/api-helpers";

type FacilityId = ApiSchema<"FacilityId">;
type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;
type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;
type WorkshopPrices = ApiSchema<"WorkshopPricesOut">;

/** How long after the last keystroke a typed price is sent, in milliseconds. */
const SEND_DELAY_MS = 600;

export function PricePanel({ onClose }: { onClose: () => void }) {
    const prices = useWorkshopPrices();
    const fleet = useWorkshopFleet();
    const facilities = useWorkshopFacilities();
    const open = usePriceSettingOpen();
    const catalog = new Map(
        facilities.data?.map((facility) => [facility.id, facility]),
    );

    return (
        <aside
            aria-label="Your Bids"
            className="flex w-[398px] max-w-[85vw] shrink-0 flex-col border-l border-border bg-surface-sunken"
        >
            <div className="flex items-center justify-between border-b border-border px-5 pt-4 pb-3.5">
                <h2 className="font-titles text-2xl leading-tight text-fg-base">
                    Your Bids
                </h2>
                <button
                    type="button"
                    aria-label="Close the bids panel"
                    onClick={onClose}
                    className="flex size-8 items-center justify-center rounded-md text-fg-base hover:bg-pine-100"
                >
                    <X className="size-[18px]" strokeWidth={2.25} />
                </button>
            </div>
            {/*
             * The scrollbar gets its own gutter, so it never narrows the rows. The
             * panel is the image width plus 268px, as in the design, plus 10px for it.
             */}
            <div className="min-h-0 flex-1 overflow-auto px-5 pt-4 pb-6 [scrollbar-gutter:stable]">
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
                        fleet={fleet.data}
                        catalog={catalog}
                        prices={prices.data}
                        open={open}
                    />
                )}
            </div>
        </aside>
    );
}

function PriceList({
    fleet,
    catalog,
    prices,
    open,
}: {
    fleet: OwnedFacility[];
    catalog: Map<FacilityId, WorkshopFacility>;
    prices: WorkshopPrices;
    open: boolean;
}) {
    const facilities = pricedFacilities(fleet);
    if (facilities.length === 0) {
        return (
            <p className="text-sm text-fg-muted">
                You have no facilities operating, so there is nothing to price.
            </p>
        );
    }
    return (
        <ul className="flex flex-col gap-3">
            {facilities.map((facility) => (
                <PriceRow
                    key={facility}
                    facility={facility}
                    details={catalog.get(facility)}
                    fleet={fleet}
                    prices={prices}
                    open={open}
                />
            ))}
        </ul>
    );
}

function PriceRow({
    facility,
    details,
    fleet,
    prices,
    open,
}: {
    facility: FacilityId;
    /** The facility's catalog entry, or undefined while it loads. */
    details: WorkshopFacility | undefined;
    fleet: OwnedFacility[];
    prices: WorkshopPrices;
    open: boolean;
}) {
    const sell = prices.sell[facility];
    const buy = prices.buy[facility];
    if (sell === undefined) return null;

    return (
        <li className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3.5 rounded-xl border border-border-subtle bg-surface-raised p-2 shadow-[0_1px_2px_rgba(54,48,20,0.12)]">
            <img
                src={workshopFacilityImages[facility]}
                alt=""
                className="aspect-square w-full self-center rounded-lg object-cover"
            />
            <div className="flex min-w-0 flex-col gap-1.5 py-0.5 pr-1">
                <div>
                    <div className="flex items-center gap-[7px]">
                        <span
                            className="relative -top-0.5 size-[11px] shrink-0 rounded-[2px]"
                            style={{
                                backgroundColor:
                                    workshopFacilityColor(facility),
                            }}
                        />
                        <span className="text-[17px] leading-tight font-bold text-fg-base">
                            {details?.name ?? facility}
                        </span>
                    </div>
                    {details && (
                        <InstalledLine
                            capacity={installedCapacity(
                                details,
                                fleet,
                                facility,
                            )}
                        />
                    )}
                </div>
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

/** "Installed 33 MW", or for storage "Installed 86 MW · 3'200 MWh". */
function InstalledLine({
    capacity,
}: {
    capacity: ReturnType<typeof installedCapacity>;
}) {
    return (
        <div className="flex items-center gap-1 text-[13px] leading-snug text-fg-subtle">
            <Zap className="size-[13px] fill-yellow-400 text-yellow-500" />
            <span>Installed</span>
            <span className="font-bold whitespace-nowrap text-fg-base">
                {formatPower(capacity.power)}
                {capacity.energy !== null &&
                    ` · ${formatEnergy(capacity.energy)}`}
            </span>
        </div>
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
    // A field unmounts when the window opens or closes, which discards what was
    // half-typed. Its pending send goes with it, or it would send the discarded
    // price after the window closed.
    useEffect(() => () => clearTimeout(sendTimer.current), []);
    const text = disabled || draft === null ? String(saved) : draft;
    const parsed = parsePrice(text, floor);

    function send(typed: string) {
        clearTimeout(sendTimer.current);
        const result = parsePrice(typed, floor);
        if (result.ok && result.price !== saved) setPrice.mutate(result.price);
    }

    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
                <label
                    htmlFor={id}
                    className="w-[52px] shrink-0 text-sm font-medium text-fg-muted"
                >
                    {label}
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
                            // An empty or invalid field goes back to the last price.
                            setDraft(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter")
                                event.currentTarget.blur();
                        }}
                        className="h-9 rounded-md border-border-brand bg-white pr-[60px] pl-2.5 text-right font-mono text-sm font-medium text-fg-base shadow-none focus-visible:border-border-brand focus-visible:ring-[3px] focus-visible:ring-pine-500/35 aria-invalid:ring-[3px] md:text-sm"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center gap-0.5 text-xs text-fg-muted">
                        <CoinIcon className="size-3" />
                        /MWh
                    </span>
                </div>
            </div>
            {!parsed.ok && (
                <p className="pl-[60px] text-[13px] text-destructive">
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
