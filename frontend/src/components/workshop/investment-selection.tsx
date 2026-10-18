/**
 * The facilities a Workshop player has picked in the Investment phase (#999),
 * shown above the catalog as small copies of their cards, with what they cost
 * together and the money left after. Everything picked is bought when the
 * phase's countdown runs out.
 *
 * Copies of one facility form a stack, with each copy behind the top card
 * sticking out a little to its right (#1272). The stacks sit in one row. When
 * they no longer fit side by side, they overlap like a hand of playing cards.
 * Hovering a stack lifts it and shows its top card's Remove button, which takes
 * off one copy. A touch screen cannot hover, so there the button always shows.
 */

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useRef } from "react";

import { cardFrame, FacilityCard } from "@/components/workshop/facility-card";
import { useContainerDimensions } from "@/hooks/use-container-dimensions";
import { workshopFacilityColor } from "@/lib/workshop-facilities";
import { overlapMargin, selectionStacks } from "@/lib/workshop-selection";
import type { ApiSchema } from "@/types/api-helpers";
import { Money } from "@energetica/ui/components/money";

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
/** The catalog card's `rounded-2xl` (16px), zoomed. */
const CARD_RADIUS = 16 * CARD_ZOOM;
/** The space between stacks while they all fit side by side. */
const CARD_GAP = 12;
/** How far each copy behind the top card of a stack sticks out to its right. */
const STACK_OFFSET = 8;
/** Copies drawn behind the top card. The "×N" badge counts any more. */
const MAX_BEHIND = 4;
/** How much darker each copy behind the top card is than the one in front. */
const DEPTH_SHADE = 0.06;

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
    const stacks = selectionStacks(selection.facilities);
    const rowRef = useRef<HTMLDivElement>(null);
    const { width: rowWidth } = useContainerDimensions(rowRef);
    const margin = overlapMargin(
        stacks.map((stack) => stackWidth(stack.count)),
        rowWidth,
        CARD_GAP,
    );

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
                    {stacks.map((stack, index) => {
                        const facility = byId.get(stack.facility);
                        return (
                            facility && (
                                <motion.div
                                    key={stack.facility}
                                    layout
                                    initial={{ opacity: 0, y: -12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="group relative shrink-0 transition-[translate] hover:z-10 hover:-translate-y-2 focus-within:z-10 focus-within:-translate-y-2"
                                    style={{
                                        width: stackWidth(stack.count),
                                        marginLeft: index === 0 ? 0 : margin,
                                    }}
                                >
                                    <SelectionStackCards
                                        facility={facility}
                                        count={stack.count}
                                        removable={investmentOpen}
                                        onRemove={() =>
                                            onRemove(stack.facility)
                                        }
                                    />
                                </motion.div>
                            )
                        );
                    })}
                </AnimatePresence>
            </div>
        </section>
    );
}

/** A stack's width: the top card, and the edge of each copy showing behind it. */
function stackWidth(count: number): number {
    return CARD_WIDTH + Math.min(count - 1, MAX_BEHIND) * STACK_OFFSET;
}

/**
 * Every copy of one facility in the selection: the top card, with the other
 * copies' edges showing to its right, and a "×N" badge once there are several.
 * Only the top card has the Remove button, which takes off one copy.
 */
function SelectionStackCards({
    facility,
    count,
    removable,
    onRemove,
}: {
    facility: WorkshopFacility;
    count: number;
    removable: boolean;
    onRemove: () => void;
}) {
    const behind = Math.min(count - 1, MAX_BEHIND);
    return (
        <>
            <AnimatePresence initial={false}>
                {Array.from({ length: behind }, (_, i) => behind - i).map(
                    (depth) => (
                        <motion.div
                            key={depth}
                            aria-hidden
                            className="absolute top-0 h-full shadow-lg"
                            style={{
                                left: depth * STACK_OFFSET,
                                width: CARD_WIDTH,
                                borderRadius: CARD_RADIUS,
                                background: cardFrame(facility),
                                filter: `brightness(${1 - depth * DEPTH_SHADE})`,
                            }}
                            initial={{ x: -STACK_OFFSET, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -STACK_OFFSET, opacity: 0 }}
                        />
                    ),
                )}
            </AnimatePresence>
            <div className="relative" style={{ width: CARD_WIDTH }}>
                <div style={{ zoom: CARD_ZOOM }}>
                    <FacilityCard facility={facility} />
                </div>
                {count > 1 && (
                    <span
                        className="absolute -top-2 -left-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background px-1 text-xs font-extrabold text-white shadow-md"
                        style={{
                            backgroundColor: workshopFacilityColor(facility.id),
                        }}
                    >
                        ×{count}
                    </span>
                )}
                {removable && (
                    <button
                        type="button"
                        aria-label={`Remove one ${facility.name}`}
                        onClick={onRemove}
                        className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-100"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>
        </>
    );
}
