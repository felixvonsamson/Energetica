/**
 * Every copy of one facility a Workshop player owns, as a stack of cards
 * (#998). The stack shows a "×N" badge and the range of lifetime left. Clicking
 * it slides each other copy's bottom row out from behind the card, so every
 * copy's lifetime left shows without repeating its stats. Stacks open in place,
 * so several can be open at once.
 *
 * Meant to fill two rows of a grid whose cells are subgrids (`row-span-2
 * grid-rows-subgrid`): the card is centred in the first row, among cards of
 * other heights, and the second row reserves the room the opened rows take, so
 * the grid below moves down.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import {
    CARD_ROW_HEIGHT,
    CardFace,
    CardFooterRow,
    cardFrame,
    FacilityCard,
    LifetimePips,
} from "@/components/workshop/facility-card";
import { cn } from "@/lib/utils";
import { workshopFacilityColor } from "@/lib/workshop-facilities";
import {
    lifetimeRangeLabel,
    roundsLabel,
    type FleetStack as Stack,
} from "@/lib/workshop-fleet";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopFacility = ApiSchema<"WorkshopFacility">;
type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;

/**
 * How far each opened row tucks up behind the card or row above it. More than
 * the card's corner radius, so its top edge stays hidden behind the corners.
 */
const ROW_OVERLAP = 22;
/** What shows of each opened row: frame, the row with its margin, frame. */
const ROW_VISIBLE = 4 + 4 + CARD_ROW_HEIGHT + 8;
/** Cards drawn peeking out behind the top one. */
const MAX_GHOSTS = 3;

export function FleetStack({
    facility,
    stack,
}: {
    facility: WorkshopFacility;
    stack: Stack;
}) {
    const [open, setOpen] = useState(false);
    const color = workshopFacilityColor(facility.id);
    const { copies } = stack;
    const top = copies[0]!;
    const many = copies.length > 1;
    const ghosts = Math.min(copies.length - 1, MAX_GHOSTS);

    return (
        <div className="row-span-2 grid grid-rows-subgrid justify-items-center gap-0">
            <div className="flex items-center">
                <button
                    type="button"
                    aria-expanded={many ? open : undefined}
                    disabled={!many}
                    className={cn(
                        "relative isolate text-left disabled:cursor-default",
                        many && "cursor-pointer",
                    )}
                    onClick={() => setOpen((isOpen) => !isOpen)}
                >
                    {Array.from({ length: ghosts }, (_, i) => (
                        <motion.div
                            key={i}
                            className="absolute inset-0 rounded-2xl shadow"
                            style={{ background: color }}
                            animate={{
                                rotate: open ? 0 : (i + 1) * 2.5,
                                opacity: open ? 0 : 0.85 - i * 0.2,
                            }}
                        />
                    ))}
                    <div className="relative z-10">
                        <FacilityCard
                            facility={facility}
                            badge={
                                many && (
                                    <span
                                        className="absolute -top-2.5 -right-2.5 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-background px-1.5 text-sm font-extrabold text-white shadow"
                                        style={{ backgroundColor: color }}
                                    >
                                        ×{copies.length}
                                    </span>
                                )
                            }
                            footer={
                                open || !many ? (
                                    <CopyRow
                                        copy={top}
                                        facility={facility}
                                        color={color}
                                    />
                                ) : (
                                    <CardFooterRow
                                        left="Remaining"
                                        right={lifetimeRangeLabel(copies)}
                                    />
                                )
                            }
                        />
                    </div>
                    <div className="absolute inset-x-0 top-full z-0">
                        <AnimatePresence>
                            {open &&
                                copies.slice(1).map((copy, i) => (
                                    <motion.div
                                        // eslint-disable-next-line react/no-array-index-key -- copies have no identity of their own
                                        key={i}
                                        className="relative rounded-b-2xl px-2 pb-2"
                                        style={{
                                            zIndex: copies.length - i,
                                            background: cardFrame(facility),
                                            marginTop: -ROW_OVERLAP,
                                            paddingTop: ROW_OVERLAP + 4,
                                        }}
                                        initial={{
                                            y: -(i + 1) * ROW_VISIBLE,
                                            opacity: 0,
                                        }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{
                                            y: -(i + 1) * ROW_VISIBLE,
                                            opacity: 0,
                                        }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 320,
                                            damping: 28,
                                            delay: i * 0.05,
                                        }}
                                    >
                                        <CardFace className="py-0">
                                            <CopyRow
                                                copy={copy}
                                                facility={facility}
                                                color={color}
                                            />
                                        </CardFace>
                                    </motion.div>
                                ))}
                        </AnimatePresence>
                    </div>
                </button>
            </div>
            <motion.div
                className="w-60"
                initial={false}
                animate={{
                    height: open ? (copies.length - 1) * ROW_VISIBLE : 0,
                }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
            />
        </div>
    );
}

/** One copy's bottom row: when it was built, and how long it has left. */
function CopyRow({
    copy,
    facility,
    color,
}: {
    copy: OwnedFacility;
    facility: WorkshopFacility;
    color: string;
}) {
    return (
        <CardFooterRow
            left={
                copy.under_construction
                    ? "🚧 Building"
                    : `Built Round ${copy.built_round}`
            }
            right={
                <>
                    <LifetimePips
                        left={copy.rounds_left}
                        total={facility.lifetime_rounds}
                        color={color}
                    />
                    {roundsLabel(copy.rounds_left)}
                </>
            }
        />
    );
}
