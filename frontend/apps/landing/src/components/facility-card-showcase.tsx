/**
 * The facility-card showcase at the top of the workshop page (#1483): the
 * game's own facility cards and price tags, drawn from demo data generated from
 * the Workshop backend, in place of a screenshot that went stale.
 *
 * It is a picture made of real components, so nothing in it reacts to the
 * pointer or takes focus.
 */

import { FacilityCard } from "@energetica/facility-cards/components/facility-card";
import { PriceTagFace } from "@energetica/facility-cards/components/price-tag";
import type {
    FacilityCardData,
    TooltipInputs,
} from "@energetica/facility-cards/lib/facility-card-data";
import { useLayoutEffect, useRef, useState } from "react";

import {
    showcaseFacilities,
    showcaseFuelPrices,
} from "@/lib/facility-showcase.generated";

// `satisfies` fails the typecheck if the card needs a field the generator does
// not write, while keeping the data's own narrow type.
const facilities = showcaseFacilities satisfies readonly FacilityCardData[];

/** The cards show no tooltips, so only the fuel prices are real. */
const tooltipInputs: TooltipInputs = {
    fuelPrices: showcaseFuelPrices,
    taxRate: null,
    taxInForce: false,
    buyRound: null,
    roundCount: null,
};

const ALT =
    "Five facility cards from the game's catalog, each with its price tag: PV solar, offshore wind turbine, lithium-ion batteries, nuclear reactor and coal burner";

/**
 * A card's width (`w-60`) and the gap between cards (`gap-6`), in rem. They are
 * in rem, not px, so they grow with the browser's default font size.
 */
const CARD_WIDTH = 15;
const GAP = 1.5;
/** The row's width at full size, gaps included, in rem. */
const ROW_WIDTH =
    facilities.length * CARD_WIDTH + (facilities.length - 1) * GAP;
/** Below this zoom the cards are too small to read, so the row scrolls. */
const MIN_ZOOM = 0.6;

/** The element's content width in rem, kept up to date as it resizes. */
function useWidthInRem<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState<number | null>(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const toRem = (px: number) =>
            px /
            parseFloat(getComputedStyle(document.documentElement).fontSize);
        // Measure now, before the first paint, so the row never shows at the
        // wrong size. The observer's first report comes a frame later.
        setWidth(toRem(element.clientWidth));
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setWidth(toRem(entry.contentRect.width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

export function FacilityCardShowcase() {
    const [ref, width] = useWidthInRem<HTMLElement>();
    const zoom = width === null ? 1 : Math.min(1, width / ROW_WIDTH);
    const scrolls = zoom < MIN_ZOOM;
    return (
        <section
            ref={ref}
            className="max-w-6xl mx-auto w-full"
            role="img"
            aria-label={ALT}
        >
            {/* Wide enough: the whole row, gaps included, is zoomed to fit the
            width, so it never overflows. Too narrow (phones): a sideways strip
            of full-size cards that snaps one at a time. The strip's negative
            margin cancels the page's side padding (`px-6 lg:px-8` in
            WorkshopPage), so cards scroll in from the screen's edges rather
            than being cut off short of them. The side padding, half the width
            less half a card, centres the first and last. Each card is inert,
            not the row, so a swipe on a card still scrolls the row. */}
            <div
                className={
                    scrolls
                        ? "-mx-6 lg:-mx-8 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[calc(50%-7.5rem)] pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden *:snap-center"
                        : "flex gap-6"
                }
                style={scrolls ? undefined : { zoom }}
            >
                {facilities.map((facility) => (
                    <div
                        key={facility.id}
                        inert
                        className="flex shrink-0 flex-col items-center"
                    >
                        <FacilityCard
                            facility={facility}
                            tooltipInputs={tooltipInputs}
                            tooltips={false}
                        />
                        <PriceTagFace facility={facility} />
                    </div>
                ))}
            </div>
        </section>
    );
}
