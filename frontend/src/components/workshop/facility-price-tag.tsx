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
 */

import { useAnimate } from "framer-motion";
import { Cloud, Hammer } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { GAME_ERROR_MESSAGES } from "@/lib/game-messages";
import { formatCatalogPrice } from "@/lib/workshop-facilities";
import { roundsLabel } from "@/lib/workshop-fleet";
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
 * in milliseconds, so it does not flip back while the pointer crosses the
 * string between them.
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

    // A touch screen has no hover: a tap turns the tag over instead, so touch
    // pointers are left to the click handler.
    const hoverHandlers = {
        onPointerEnter(event: PointerEvent) {
            if (event.pointerType === "touch") return;
            clearTimeout(unflipTimer.current);
            setTurned(true);
        },
        onPointerLeave(event: PointerEvent) {
            if (event.pointerType === "touch") return;
            clearTimeout(unflipTimer.current);
            unflipTimer.current = setTimeout(
                () => setTurned(false),
                UNFLIP_DELAY,
            );
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

export function FacilityPriceTag({
    tag,
}: {
    /** From `usePriceTag`. */
    tag: ReturnType<typeof usePriceTag>;
}) {
    const { facility, owned, selected, affordable, flipped, scope } = tag;
    const { limit, atLimit } = tag;

    return (
        <div className="flex flex-col items-center">
            {/* The string the tag hangs from. */}
            <div className="h-4 w-px bg-muted-foreground" />
            <div
                ref={scope}
                {...tag.hoverHandlers}
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
                        {/* The coin sits a little low next to these bold digits. */}
                        <Money
                            amount={facility.price}
                            format={formatCatalogPrice}
                            className="block text-center text-sm font-extrabold [&>svg]:translate-y-[0.08em]"
                        />
                        {/* A price shock this Round moved the price (#1012). */}
                        {facility.price !== facility.base_price && (
                            <Money
                                amount={facility.base_price}
                                format={formatCatalogPrice}
                                className="block text-center text-[10px] line-through opacity-60"
                            />
                        )}
                        <span className="mt-0.5 flex gap-3 text-[10px]">
                            <span
                                className="flex items-center gap-0.5"
                                title="Construction time"
                            >
                                <Hammer className="size-3" />
                                {facility.construction_lag_rounds === 0
                                    ? "Instant"
                                    : roundsLabel(
                                          facility.construction_lag_rounds,
                                      )}
                            </span>
                            <span
                                className="flex items-center gap-0.5"
                                title="Construction pollution"
                            >
                                <Cloud className="size-3" />
                                {formatEmissions(
                                    facility.base_construction_pollution,
                                )}
                            </span>
                        </span>
                        {limit !== null && (
                            <span
                                className="mt-0.5 text-[10px] font-bold"
                                title="The most you can own at once, counting those in your selection"
                            >
                                {owned + selected} of {limit}
                            </span>
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
