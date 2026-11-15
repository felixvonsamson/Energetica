/**
 * PROTOTYPE (#1462), throwaway. Three facility-card showcases for the top of
 * the landing's workshop page, switchable with `?variant=A|B|C`. They disagree
 * on what "interaction off" means and on how the cards reflow on phones.
 *
 * A: Static strip. No interaction at all (`inert`): a picture made of real
 * components. Fits the row to the width on desktop; on phones the row scrolls
 * sideways, one card at a time. B: Fanned hand. Cards overlap like a hand of
 * playing cards. Hovering lifts a card and its tooltips work. Read-only: no
 * flip, no buying. On phones the fan tightens and shrinks so all five still
 * fit. C: Pick a card. One large card with its price tag, next to a list of the
 * five facilities. Tooltips on. On phones the list becomes chips above the
 * card.
 */

import { useLayoutEffect, useRef, useState } from "react";

import {
    type FacilityCardData,
    FacilityCard,
    PriceTagFace,
    type TooltipInputs,
    cardFrame,
} from "./facility-card";
import data from "./facility-cards.data.json";

const facilities = data.facilities as FacilityCardData[];
const tooltipInputs: TooltipInputs = {
    fuelPrices: data.fuel_prices,
    taxRate: null,
    taxInForce: false,
};

const ALT =
    "Five facility cards from the game's catalog, each with its price tag: PV solar, offshore wind turbine, lithium-ion batteries, nuclear reactor and coal burner";

export const VARIANTS = {
    A: { name: "Static strip", Component: VariantA },
    B: { name: "Fanned hand", Component: VariantB },
    C: { name: "Pick a card", Component: VariantC },
} as const;
export type VariantKey = keyof typeof VARIANTS;

/** The row's width at full size: five 240px cards and four 24px gaps. */
const ROW_WIDTH = 5 * 240 + 4 * 24;
/** Below this scale the cards get too small to read, so the row scrolls. */
const MIN_FIT = 0.6;

/** The section's width, kept up to date as the window resizes. */
function useWidth() {
    const ref = useRef<HTMLElement>(null);
    const [width, setWidth] = useState<number | null>(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) =>
            setWidth(entry!.contentRect.width),
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

function VariantA() {
    const [ref, width] = useWidth();
    const fit = width === null ? 1 : width / ROW_WIDTH;
    const scrolls = fit < MIN_FIT;
    return (
        <section
            ref={ref}
            className="max-w-6xl mx-auto w-full"
            role="img"
            aria-label={ALT}
        >
            {/* Wide enough: the whole row is zoomed to fit the width exactly,
            gaps included, so it never overflows. Too narrow (phones): the row
            scrolls sideways, snapping one card at a time. Each card is inert,
            not the row, so a swipe on a card still scrolls the row. */}
            <div
                className={
                    scrolls
                        ? "flex snap-x snap-mandatory gap-6 overflow-x-auto px-[calc(50%-120px)] pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:snap-center"
                        : "flex gap-6"
                }
                style={scrolls ? undefined : { zoom: Math.min(1, fit) }}
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

function VariantB() {
    const [lifted, setLifted] = useState<string | null>(null);
    const mid = (facilities.length - 1) / 2;
    return (
        <section className="max-w-6xl mx-auto w-full flex justify-center pt-10 pb-6 overflow-x-clip">
            {/* The zoom shrinks the whole hand on smaller screens, so all five
            cards stay on screen. */}
            <div className="flex [zoom:0.42] sm:[zoom:0.7] lg:[zoom:0.9] xl:[zoom:1]">
                {facilities.map((facility, i) => {
                    const offset = i - mid;
                    const isLifted = lifted === facility.id;
                    return (
                        <div
                            key={facility.id}
                            onPointerEnter={() => setLifted(facility.id)}
                            onPointerLeave={() => setLifted(null)}
                            className="-mx-6 flex flex-col items-center transition-transform duration-200"
                            style={{
                                zIndex: isLifted ? 10 : 5 - Math.abs(offset),
                                transform: isLifted
                                    ? "translateY(-28px) rotate(0deg) scale(1.05)"
                                    : `translateY(${Math.abs(offset) * 14}px) rotate(${offset * 5}deg)`,
                            }}
                        >
                            <FacilityCard
                                facility={facility}
                                tooltipInputs={tooltipInputs}
                            />
                            <PriceTagFace
                                facility={facility}
                                className={
                                    isLifted ? "opacity-100" : "opacity-0"
                                }
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function VariantC() {
    const [selectedId, setSelectedId] = useState(facilities[0]!.id);
    const selected = facilities.find((f) => f.id === selectedId)!;
    return (
        <section className="max-w-4xl mx-auto w-full grid gap-8 md:grid-cols-[1fr_auto] items-center">
            <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-muted-foreground">
                    Facilities from the game's catalog
                </p>
                <ul className="flex flex-wrap gap-2 md:flex-col">
                    {facilities.map((facility) => (
                        <li key={facility.id}>
                            <button
                                type="button"
                                onClick={() => setSelectedId(facility.id)}
                                className="flex w-full items-center gap-3 rounded-full bg-card px-4 py-2 text-left font-semibold shadow-sm transition-all data-[selected=true]:shadow-md data-[selected=true]:ring-2 data-[selected=true]:ring-primary"
                                data-selected={facility.id === selectedId}
                            >
                                <span
                                    className="size-3 shrink-0 rounded-full"
                                    style={{
                                        background: cardFrame(facility.id),
                                    }}
                                />
                                {facility.name}
                            </button>
                        </li>
                    ))}
                </ul>
                <p className="text-sm">
                    Hover a stat with an info mark to see what players see.
                </p>
            </div>
            <div className="flex flex-col items-center justify-self-center [zoom:1.2] md:[zoom:1.4]">
                <FacilityCard
                    key={selected.id}
                    facility={selected}
                    tooltipInputs={tooltipInputs}
                />
                <PriceTagFace facility={selected} />
            </div>
        </section>
    );
}
