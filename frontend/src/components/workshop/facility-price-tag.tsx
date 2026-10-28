/**
 * What a facility costs to buy (#998), hanging under its card like a price tag,
 * so it reads as the price of the card rather than one of its stats: the price,
 * the construction time and the construction pollution.
 *
 * While the Investment phase is open, the tag flips over when the tag or its
 * card is hovered (or tapped, on a touch screen). Clicking the tag's back, or
 * the card, adds the facility to the player's selection (#999), and the tag
 * gives a little bounce (#1295). While the phase is closed, the tag does not
 * flip: clicking it or the card shakes it and says to wait for the next one.
 * `usePriceTag` holds this behaviour, so the card can share it with the tag.
 *
 * A facility a player can own only a few of, such as a dam (#1223), shows how
 * many they have out of the limit, and its back is disabled at the limit.
 *
 * Prices are always in millions ("8M", #1247), unlike money elsewhere.
 *
 * The price per MW per Round of lifetime (#1400), which compares facilities of
 * different sizes and lifetimes, shows on the tag's back and in a tooltip on
 * its price, since the tag only flips while the phase is open.
 */

import { useAnimate } from "framer-motion";
import { Cloud, Hammer } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
    MetricTooltip,
    TooltipFigure,
} from "@/components/workshop/metric-tooltip";
import { GAME_ERROR_MESSAGES } from "@/lib/game-messages";
import { formatCatalogPrice } from "@/lib/workshop-facilities";
import { roundsLabel } from "@/lib/workshop-fleet";
import { pricePerMWPerRound } from "@/lib/workshop-metrics";
import type { ApiSchema } from "@/types/api-helpers";
import { formatEmissions } from "@energetica/core/format-utils";
import { Money } from "@energetica/ui/components/money";
import { cn } from "@energetica/ui/lib/utils";

type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;

/** A quick left-right shake, as a disabled control gives, in pixels. */
const SHAKE = [0, -6, 6, -5, 5, -3, 3, 0];

/** A quick squeeze and spring back, when a click adds the facility. */
const BOUNCE = [1, 0.88, 1.06, 0.98, 1];

/**
 * How long the tag stays flipped after the pointer leaves the card or the tag,
 * in milliseconds, so it does not flip back as the pointer passes from one to
 * the other.
 */
const UNFLIP_DELAY = 150;

/** The look shared by both faces of the tag. */
const FACE =
    "relative col-start-1 row-start-1 flex flex-col items-center justify-center rounded-md border border-border bg-amber-100 px-3 py-1.5 text-stone-900 shadow-sm backface-hidden";

export interface PriceTagOptions {
    facility: WorkshopFacility;
    /** How many the visitor owns already. */
    owned: number;
    /** How many are in the visitor's selection. */
    selected: number;
    /** Whether the Investment phase is open, so facilities can be added. */
    investmentOpen: boolean;
    /** Whether the visitor's money covers one more on top of their selection. */
    affordable: boolean;
    onAdd: () => void;
    /** True while an add is on its way to the server. */
    adding: boolean;
}

/**
 * The state of a facility's price tag, and the handlers its card and the tag
 * both use: `hoverHandlers` flip it while the pointer is over them, and
 * `handleClick` does what a click on the card or the tag's front does. The
 * caller calls `turnBack` when focus leaves both, which is what turns over a
 * tag a tap flipped.
 */
export function usePriceTag({
    facility,
    owned,
    selected,
    investmentOpen,
    affordable,
    onAdd,
    adding,
}: PriceTagOptions) {
    const [turned, setTurned] = useState(false);
    const [scope, animate] = useAnimate<HTMLDivElement>();
    const unflipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(unflipTimer.current), []);
    // A tag turned over just as the phase closed turns back.
    const flipped = turned && investmentOpen;
    // Owned ones count whether built or under construction, and selected ones too.
    const limit = facility.max_owned;
    const atLimit = limit !== null && owned + selected >= limit;
    const canAdd = affordable && !atLimit && !adding;

    // Only a mouse hovers. A touch screen or a pen turns the tag over on a
    // tap instead, so that same tap does not also add the facility.
    const hoverHandlers = {
        onPointerEnter(event: PointerEvent) {
            if (event.pointerType !== "mouse") return;
            clearTimeout(unflipTimer.current);
            setTurned(true);
        },
        onPointerLeave(event: PointerEvent) {
            if (event.pointerType !== "mouse") return;
            clearTimeout(unflipTimer.current);
            unflipTimer.current = setTimeout(turnBack, UNFLIP_DELAY);
        },
    };

    function turnBack() {
        clearTimeout(unflipTimer.current);
        setTurned(false);
    }

    function handleClick() {
        if (!investmentOpen) {
            void animate(scope.current, { x: SHAKE }, { duration: 0.4 });
            toast.error(GAME_ERROR_MESSAGES.WORKSHOP_INVESTMENT_CLOSED, {
                id: "workshop-investment-closed",
            });
            return;
        }
        if (!flipped) {
            setTurned(true);
            return;
        }
        if (canAdd) handleAdd();
    }

    function handleAdd() {
        void animate(scope.current, { scale: BOUNCE }, { duration: 0.35 });
        onAdd();
    }

    return {
        facility,
        owned,
        selected,
        affordable,
        flipped,
        scope,
        limit,
        atLimit,
        canAdd,
        hoverHandlers,
        turnBack,
        handleClick,
        handleAdd,
    };
}

/** A facility's price tag, as `usePriceTag` returns it. */
export type PriceTag = ReturnType<typeof usePriceTag>;

export function FacilityPriceTag({ tag }: { tag: PriceTag }) {
    const { facility, owned, selected, affordable, flipped, scope } = tag;
    const { limit, atLimit } = tag;
    const perMW = (
        <>
            <Money
                amount={pricePerMWPerRound(
                    facility.price,
                    facility.base_power_generation,
                    facility.lifetime_rounds,
                )}
            />{" "}
            per MW per Round
        </>
    );

    return (
        // The string counts as part of the tag for hovering, so the pointer
        // goes straight from the card's hover area to the tag's.
        <div className="flex flex-col items-center" {...tag.hoverHandlers}>
            {/* The string the tag hangs from. */}
            <div className="h-4 w-px bg-muted-foreground" />
            <div
                ref={scope}
                className={cn(
                    "perspective-[600px] transition-[rotate] hover:rotate-0",
                    flipped ? "rotate-0" : "-rotate-2",
                )}
            >
                <div
                    className={cn(
                        "grid transition-transform duration-500 transform-3d",
                        flipped && "rotate-y-180",
                    )}
                >
                    <button
                        type="button"
                        onClick={tag.handleClick}
                        inert={flipped}
                        className={FACE}
                    >
                        <PinHole />
                        <MetricTooltip
                            content={
                                <TooltipFigure
                                    label={perMW}
                                    note={`The price spread over its ${facility.base_power_generation / 1_000_000} MW and its ${roundsLabel(facility.lifetime_rounds)} of lifetime.`}
                                />
                            }
                        >
                            <span>
                                {/* The coin sits a little low next to these bold digits. */}
                                <Money
                                    amount={facility.price}
                                    format={formatCatalogPrice}
                                    className="block text-center text-sm font-extrabold [&>svg]:translate-y-[0.08em]"
                                />
                            </span>
                        </MetricTooltip>
                        {/* A price shock this Round moved the price (#1012). */}
                        {facility.price !== facility.base_price && (
                            <Money
                                amount={facility.base_price}
                                format={formatCatalogPrice}
                                className="block text-center text-[10px] line-through opacity-60"
                            />
                        )}
                        <span className="mt-0.5 flex gap-3 text-[10px]">
                            <MetricTooltip
                                content={
                                    <TooltipFigure label="Construction time" />
                                }
                            >
                                <span className="flex items-center gap-0.5">
                                    <Hammer className="size-3" />
                                    {facility.construction_lag_rounds === 0
                                        ? "Instant"
                                        : roundsLabel(
                                              facility.construction_lag_rounds,
                                          )}
                                </span>
                            </MetricTooltip>
                            <MetricTooltip
                                content={
                                    <TooltipFigure label="Construction pollution" />
                                }
                            >
                                <span className="flex items-center gap-0.5">
                                    <Cloud className="size-3" />
                                    {formatEmissions(
                                        facility.base_construction_pollution,
                                    )}
                                </span>
                            </MetricTooltip>
                        </span>
                        {limit !== null && (
                            <MetricTooltip
                                content={
                                    <TooltipFigure label="The most you can own at once, counting those in your selection" />
                                }
                            >
                                <span className="mt-0.5 text-[10px] font-bold">
                                    {owned + selected} of {limit}
                                </span>
                            </MetricTooltip>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={tag.handleAdd}
                        disabled={!tag.canAdd}
                        inert={!flipped}
                        className={cn(
                            FACE,
                            "rotate-y-180 disabled:cursor-not-allowed",
                        )}
                    >
                        <PinHole />
                        <span
                            className={cn(
                                "text-sm font-extrabold",
                                (!affordable || atLimit) && "opacity-50",
                            )}
                        >
                            {atLimit
                                ? "Limit reached"
                                : affordable
                                  ? "Click to add"
                                  : "Not enough money"}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] whitespace-nowrap">
                            {perMW}
                        </span>
                        <span className="mt-0.5 text-[10px] whitespace-nowrap">
                            {countsLabel(owned, selected)}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}

/** The hole the string goes through. */
function PinHole() {
    return (
        <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full border border-stone-400 bg-background" />
    );
}

/** "2 owned · 1 selected", leaving out a count that is zero. */
function countsLabel(owned: number, selected: number): string {
    const parts = [];
    if (owned > 0) parts.push(`${owned} owned`);
    if (selected > 0) parts.push(`${selected} selected`);
    return parts.length > 0 ? parts.join(" · ") : "None owned";
}
