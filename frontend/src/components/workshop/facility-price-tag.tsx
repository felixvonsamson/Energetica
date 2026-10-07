/**
 * What a facility costs to buy (#998), hanging under its card like a price tag,
 * so it reads as the price of the card rather than one of its stats: the price,
 * the construction time and the construction pollution.
 *
 * Clicking the tag reveals a Buy button. Buying lands in #999, so the button
 * does nothing yet.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Cloud, Hammer, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { formatEmissions } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { roundsLabel } from "@/lib/workshop-fleet";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopFacility = ApiSchema<"WorkshopFacility">;

export function FacilityPriceTag({
    facility,
    owned,
}: {
    facility: WorkshopFacility;
    /** How many the visitor owns already. */
    owned: number;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex flex-col items-center">
            {/* The string the tag hangs from. */}
            <div className="h-4 w-px bg-muted-foreground" />
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((isOpen) => !isOpen)}
                className={cn(
                    "relative rounded-md border border-border bg-amber-100 px-3 py-1.5 text-stone-900 shadow-sm transition-transform hover:rotate-0",
                    open ? "rotate-0" : "-rotate-2",
                )}
            >
                <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full border border-stone-400 bg-background" />
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
                            : roundsLabel(facility.construction_lag_rounds)}
                    </span>
                    <span
                        className="flex items-center gap-0.5"
                        title="Construction pollution"
                    >
                        <Cloud className="size-3" />
                        {formatEmissions(facility.base_construction_pollution)}
                    </span>
                </span>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-col items-center gap-1 pt-2">
                            {/* TODO(#999): buy the facility. */}
                            <Button size="sm" className="rounded-full">
                                <ShoppingCart className="size-4" />
                                Buy
                            </Button>
                            <span className="text-[10px] text-muted-foreground">
                                {owned === 0 ? "None owned" : `${owned} owned`}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
