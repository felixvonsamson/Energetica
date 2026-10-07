/**
 * The facilities a Workshop player has picked in the Investment phase (#999),
 * shown above the catalog as small copies of their cards, with what they cost
 * together and the money left after. Everything picked is bought when the
 * phase's countdown runs out.
 *
 * The cards sit in one row. When they no longer fit side by side, they overlap
 * like a hand of playing cards. Hovering one lifts it and shows its Remove
 * button. A touch screen cannot hover, so there the button always shows.
 */

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Money } from "@/components/ui/money";
import { FacilityCard } from "@/components/workshop/facility-card";
import type { ApiSchema } from "@/types/api-helpers";

type FacilityId = ApiSchema<"FacilityId">;
type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;
type WorkshopSelection = ApiSchema<"WorkshopSelectionOut">;

/**
 * How much smaller the cards are than in the catalog. CSS `zoom` shrinks
 * everything on the card together (text, image, icons and spacing), and unlike
 * a transform it also shrinks the room the card takes.
 */
const CARD_ZOOM = 0.7;
/** A card's width in the row: the catalog card's `w-60` (240px), zoomed. */
const CARD_WIDTH = 240 * CARD_ZOOM;
/** The space between cards while they all fit side by side. */
const CARD_GAP = 12;
/** The least of each card that stays visible when they overlap. */
const MIN_VISIBLE = 16;

export function InvestmentSelection({
    facilities,
    selection,
    investmentOpen,
    onRemove,
}: {
    /** The catalog, to draw each selected facility's card from. */
    facilities: WorkshopFacility[];
    selection: WorkshopSelection;
    /** Whether the Investment phase is open, so facilities can be removed. */
    investmentOpen: boolean;
    onRemove: (facility: FacilityId) => void;
}) {
    const byId = new Map(facilities.map((facility) => [facility.id, facility]));
    const count = selection.facilities.length;
    const rowRef = useRef<HTMLDivElement>(null);
    const rowWidth = useWidth(rowRef);

    return (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <div>
                    <h3 className="font-semibold">Your selection</h3>
                    <p className="text-sm text-muted-foreground">
                        {!investmentOpen
                            ? "Buying your selection…"
                            : count === 0
                              ? "Hover a price tag and press Add to pick a facility. Everything you pick is bought when the timer runs out."
                              : "Bought when the timer runs out."}
                    </p>
                </div>
                <dl className="flex gap-6 text-sm">
                    <div>
                        <dt className="text-muted-foreground">Total</dt>
                        <dd className="font-bold">
                            <Money amount={selection.total_cost} />
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Left after</dt>
                        <dd className="font-bold">
                            <Money
                                amount={selection.money - selection.total_cost}
                            />
                        </dd>
                    </div>
                </dl>
            </div>
            {/*
             * A fixed height that fits the tallest card, so the catalog below
             * does not move as cards come and go.
             */}
            <div ref={rowRef} className="flex h-60 items-start pt-2">
                <AnimatePresence initial={false}>
                    {selection.facilities.map((id, index) => {
                        const facility = byId.get(id);
                        return (
                            facility && (
                                <motion.div
                                    // Removing takes out the last copy of a facility, so
                                    // numbering the copies keeps every other card's key.
                                    key={`${id}-${copyNumber(selection.facilities, index)}`}
                                    layout
                                    initial={{ opacity: 0, y: -12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="group relative shrink-0 transition-[translate] hover:z-10 hover:-translate-y-2 focus-within:z-10 focus-within:-translate-y-2"
                                    style={{
                                        marginLeft:
                                            index === 0
                                                ? 0
                                                : overlapMargin(
                                                      count,
                                                      rowWidth,
                                                  ),
                                    }}
                                >
                                    <div style={{ zoom: CARD_ZOOM }}>
                                        <FacilityCard facility={facility} />
                                    </div>
                                    {investmentOpen && (
                                        <button
                                            type="button"
                                            aria-label={`Remove ${facility.name}`}
                                            onClick={() => onRemove(id)}
                                            className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-100"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </motion.div>
                            )
                        );
                    })}
                </AnimatePresence>
            </div>
        </section>
    );
}

/**
 * The left margin of every card after the first: a gap while they all fit in
 * `rowWidth`, and a negative margin that overlaps them once they do not.
 */
function overlapMargin(count: number, rowWidth: number): number {
    const sideBySide = count * CARD_WIDTH + (count - 1) * CARD_GAP;
    if (count < 2 || sideBySide <= rowWidth) return CARD_GAP;
    const step = Math.max((rowWidth - CARD_WIDTH) / (count - 1), MIN_VISIBLE);
    return step - CARD_WIDTH;
}

/** Which copy of its facility the entry at `index` is: 0 for the first. */
function copyNumber(selection: FacilityId[], index: number): number {
    return selection.slice(0, index).filter((id) => id === selection[index])
        .length;
}

/** The element's width, kept up to date as it resizes. */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(() =>
            setWidth(element.clientWidth),
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return width;
}
