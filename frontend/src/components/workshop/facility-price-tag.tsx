/**
 * What a facility costs to buy (#998), hanging under its card like a price tag,
 * so it reads as the price of the card rather than one of its stats: the price,
 * the construction time and the construction pollution.
 *
 * While the Investment phase is open, the tag flips over when hovered (or
 * tapped, on a touch screen). Clicking its back adds the facility to the
 * player's selection (#999), and the tag gives a little bounce. While the phase
 * is closed, the tag does not flip: clicking it shakes it and says to wait for
 * the next one.
 */

import { useAnimate } from "framer-motion";
import { Cloud, Hammer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ui/money";
import { formatEmissions } from "@/lib/format-utils";
import { GAME_ERROR_MESSAGES } from "@/lib/game-messages";
import { cn } from "@/lib/utils";
import { roundsLabel } from "@/lib/workshop-fleet";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;

/** A quick left-right shake, as a disabled control gives, in pixels. */
const SHAKE = [0, -6, 6, -5, 5, -3, 3, 0];

/** A quick squeeze and spring back, when a click adds the facility. */
const BOUNCE = [1, 0.88, 1.06, 0.98, 1];

/** The look shared by both faces of the tag. */
const FACE =
    "relative col-start-1 row-start-1 flex flex-col items-center justify-center rounded-md border border-border bg-amber-100 px-3 py-1.5 text-stone-900 shadow-sm backface-hidden";

export function FacilityPriceTag({
    facility,
    owned,
    selected,
    investmentOpen,
    affordable,
    onAdd,
    adding,
}: {
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
}) {
    const [turned, setTurned] = useState(false);
    const [scope, animate] = useAnimate<HTMLDivElement>();
    // A tag turned over just as the phase closed turns back.
    const flipped = turned && investmentOpen;

    function handleFrontClick() {
        if (investmentOpen) {
            // A touch screen has no hover, so a tap turns the tag over.
            setTurned(true);
            return;
        }
        void animate(scope.current, { x: SHAKE }, { duration: 0.4 });
        toast.error(GAME_ERROR_MESSAGES.WORKSHOP_INVESTMENT_CLOSED, {
            id: "workshop-investment-closed",
        });
    }

    function handleAdd() {
        void animate(scope.current, { scale: BOUNCE }, { duration: 0.35 });
        onAdd();
    }

    return (
        <div className="flex flex-col items-center">
            {/* The string the tag hangs from. */}
            <div className="h-4 w-px bg-muted-foreground" />
            <div
                ref={scope}
                onMouseEnter={() => setTurned(true)}
                onMouseLeave={() => setTurned(false)}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setTurned(false);
                    }
                }}
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
                        onClick={handleFrontClick}
                        inert={flipped}
                        className={FACE}
                    >
                        <PinHole />
                        <Money
                            amount={facility.base_price}
                            className="block text-center text-sm font-extrabold"
                        />
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
                    </button>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!affordable || adding}
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
                                !affordable && "opacity-50",
                            )}
                        >
                            {affordable ? "Click to add" : "Not enough money"}
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
