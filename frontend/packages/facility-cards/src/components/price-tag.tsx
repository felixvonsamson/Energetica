/**
 * The parts of a facility's price tag (#998), which hangs under its card from a
 * string, so it reads as the price of the card rather than one of its stats.
 * These only draw it: in the Workshop, `FacilityPriceTag` turns the tag over
 * and buys the facility, with `PriceTagFace` as its front.
 *
 * Prices are always in millions ("8M", #1247), unlike money elsewhere.
 *
 * A facility that does not work in the Round it is bought in, such as a nuclear
 * reactor, says how many Rounds it needs to build (#1414). Every other facility
 * works straight away, which is the default, so its tag says nothing about
 * building.
 */

import { Money } from "@energetica/ui/components/money";
import { cn } from "@energetica/ui/lib/utils";
import type { ReactNode } from "react";

import type { FacilityCardData } from "#facility-cards/lib/facility-card-data";
import {
    constructionLagLabel,
    formatCatalogPrice,
} from "#facility-cards/lib/workshop-facilities";

/** The string the tag hangs from, between the card and the tag. */
export function PriceTagString() {
    return <div className="h-4 w-px bg-muted-foreground" />;
}

/** One side of the tag: the paper and the hole the string goes through. */
export function PriceTagSide({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "relative flex flex-col items-center justify-center rounded-md border border-border bg-amber-100 px-3 py-1.5 text-stone-900 shadow-sm",
                className,
            )}
        >
            <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full border border-stone-400 bg-background" />
            {children}
        </div>
    );
}

/**
 * The front of the tag: the price, the price before a price shock if one moved
 * it (#1012), and how long the facility takes to build, then `children`.
 */
export function PriceTagFace({
    facility,
    children,
    className,
}: {
    facility: Pick<
        FacilityCardData,
        "price" | "base_price" | "construction_lag_rounds"
    >;
    /** More lines below the price, such as how many the player owns. */
    children?: ReactNode;
    className?: string;
}) {
    const lagLabel = constructionLagLabel(facility.construction_lag_rounds);
    return (
        <PriceTagSide className={className}>
            {/* The coin sits a little low next to these bold digits. */}
            <Money
                amount={facility.price}
                format={formatCatalogPrice}
                className="block text-center text-sm font-extrabold [&>svg]:translate-y-[0.08em]"
            />
            {facility.price !== facility.base_price && (
                <Money
                    amount={facility.base_price}
                    format={formatCatalogPrice}
                    className="block text-center text-[10px] line-through opacity-60"
                />
            )}
            {lagLabel && (
                <span className="mt-0.5 text-[10px] font-bold whitespace-nowrap">
                    {lagLabel}
                </span>
            )}
            {children}
        </PriceTagSide>
    );
}
