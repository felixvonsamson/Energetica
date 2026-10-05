/**
 * PROTOTYPE — Variant D, the mix Felix asked for after reviewing A–C.
 *
 * - Card style from B (gradient frame, headline stat in the corner, icon rows),
 *   without the image border, the caption under the image, or any mark on
 *   upgrade cards. Fuel moves into a stat row now that the caption is gone.
 * - Catalog layout from A: one flat grid, not grouped by category.
 * - Cards differ in height (storage and fuel-burning facilities have more rows),
 *   so each card is centred vertically in its grid row. A subgrid keeps the
 *   price tags, or the opened stack rows, lined up underneath.
 * - Price tag from C. Clicking it reveals a Buy button. Buying adds a copy to the
 *   in-memory fleet, so the "Your fleet" tab updates.
 * - Fleet stacks open in place (from A), so several can be open at once. The
 *   opened rows hang directly off the card, as in B. The count badge reads "×4"
 *   (from A).
 */

import { AnimatePresence, motion } from "framer-motion";
import { Check, Cloud, Hammer, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { Money } from "@/components/ui/money";
import { formatEmissions } from "@/lib/format-utils";

import {
    CATALOG,
    CATEGORY_COLOR,
    type Facility,
    FLEET,
    fleetStacks,
    lifetimeRange,
    type OwnedFacility,
} from "./mock";
import { cardStats, LifetimePips, roundsLabel } from "./stats";

const ROW_H = 30;
// How far each opened lifetime row tucks up behind the card or row above it.
// More than the card's corner radius, so no cut-off edge shows at the corners.
const STRIP_OVERLAP = 22;
// What shows of each opened row: frame, footer (with its top margin), frame.
const STRIP_VISIBLE = 4 + ROW_H + 4 + 8;
const CURRENT_ROUND = 3;

// Kept at module level so a purchase survives switching tabs.
let mockFleet: OwnedFacility[] = [...FLEET];

const GRID =
    "grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] justify-items-center gap-x-6";

export function VariantD({
    tab,
    catalog,
}: {
    tab: "catalog" | "fleet";
    catalog: Facility[];
}) {
    const [fleet, setFleet] = useState(mockFleet);
    const buy = (f: Facility) => {
        mockFleet = [
            ...mockFleet,
            {
                facilityId: f.id,
                builtRound: CURRENT_ROUND,
                remainingRounds: f.lifetime_rounds,
                underConstruction: f.construction_lag_rounds > 0,
            },
        ];
        setFleet(mockFleet);
    };

    if (tab === "catalog") {
        return (
            <div className={`${GRID} gap-y-10`}>
                {catalog.map((f) => (
                    <div
                        key={f.id}
                        className="row-span-2 grid grid-rows-subgrid justify-items-center gap-0"
                    >
                        <div className="flex items-center">
                            <Card facility={f} />
                        </div>
                        <PriceTag
                            facility={f}
                            owned={
                                fleet.filter((o) => o.facilityId === f.id)
                                    .length
                            }
                            onBuy={() => buy(f)}
                        />
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className={`${GRID} gap-y-10`}>
            {fleetStacks(fleet).map(({ facility, copies }) => (
                <Stack key={facility.id} facility={facility} copies={copies} />
            ))}
        </div>
    );
}

function Card({
    facility: f,
    footer,
    badge,
}: {
    facility: Facility;
    footer?: React.ReactNode;
    badge?: React.ReactNode;
}) {
    const color = CATEGORY_COLOR[f.category];
    const [headline, ...rest] = cardStats(f, CATALOG);
    return (
        <div
            className="relative w-60 rounded-2xl p-2 shadow-lg"
            style={{
                background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, white))`,
            }}
        >
            <div className="relative rounded-xl bg-amber-50 p-2 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
                <div className="flex items-start justify-between gap-1">
                    <span className="flex items-center gap-1 text-sm leading-tight font-extrabold">
                        {f.name}
                    </span>
                    <span className="shrink-0 text-xs font-bold whitespace-nowrap">
                        {headline!.label !== "Capacity" && (
                            <span className="text-[10px] opacity-60">⚡</span>
                        )}
                        {headline!.value}
                    </span>
                </div>
                <img
                    src={f.image}
                    alt=""
                    className="mt-1 mb-1.5 aspect-[16/10] w-full rounded-md object-cover"
                />
                <ul className="divide-y divide-stone-300 text-xs dark:divide-stone-700">
                    {rest.map((s) => (
                        <li
                            key={s.key}
                            className="flex items-center gap-2 py-1"
                        >
                            <s.icon
                                className="size-3.5 shrink-0"
                                style={{ color: s.color ?? color }}
                            />
                            <span className="flex-1">{s.label}</span>
                            <span className="font-bold">{s.value}</span>
                        </li>
                    ))}
                </ul>
                {footer ?? (
                    <Footer
                        left="Lifetime"
                        right={
                            <>
                                <LifetimePips
                                    remaining={f.lifetime_rounds}
                                    total={f.lifetime_rounds}
                                    color={color}
                                />
                                {roundsLabel(f.lifetime_rounds)}
                            </>
                        }
                    />
                )}
            </div>
            {badge}
        </div>
    );
}

function Footer({
    left,
    right,
}: {
    left: React.ReactNode;
    right: React.ReactNode;
}) {
    return (
        <div
            className="mt-1 flex items-center justify-between border-t-2 border-stone-300 text-[11px] dark:border-stone-700"
            style={{ height: ROW_H }}
        >
            <span className="opacity-70">{left}</span>
            <span className="flex items-center gap-1.5 font-bold">{right}</span>
        </div>
    );
}

function PriceTag({
    facility: f,
    owned,
    onBuy,
}: {
    facility: Facility;
    owned: number;
    onBuy: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [justBought, setJustBought] = useState(false);
    return (
        <div className="flex flex-col items-center">
            {/* The string. */}
            <div className="h-4 w-px bg-muted-foreground" />
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`relative rounded-md border border-border bg-amber-100 px-3 py-1.5 text-stone-900 shadow-sm transition-transform hover:rotate-0 ${open ? "rotate-0" : "-rotate-2"}`}
            >
                <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full border border-stone-400 bg-background" />
                <Money
                    amount={f.base_price}
                    className="block text-center text-sm font-extrabold"
                />
                <div className="mt-0.5 flex gap-3 text-[10px]">
                    <span className="flex items-center gap-0.5">
                        <Hammer className="size-3" />
                        {f.construction_lag_rounds === 0
                            ? "Instant"
                            : roundsLabel(f.construction_lag_rounds)}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <Cloud className="size-3" />
                        {formatEmissions(f.base_construction_pollution)}
                    </span>
                </div>
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
                            <button
                                type="button"
                                onClick={() => {
                                    onBuy();
                                    setJustBought(true);
                                    setTimeout(() => setJustBought(false), 900);
                                }}
                                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground shadow hover:brightness-110 active:scale-95"
                            >
                                {justBought ? (
                                    <Check className="size-4" />
                                ) : (
                                    <ShoppingCart className="size-4" />
                                )}
                                Buy
                            </button>
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

function Stack({
    facility: f,
    copies,
}: {
    facility: Facility;
    copies: OwnedFacility[];
}) {
    const [open, setOpen] = useState(false);
    const color = CATEGORY_COLOR[f.category];
    const many = copies.length > 1;
    const ghosts = Math.min(copies.length - 1, 3);
    const top = copies[0]!;
    const frame = `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, white))`;

    return (
        <div className="row-span-2 grid grid-rows-subgrid justify-items-center gap-0">
            <div className="flex items-center">
                <button
                    type="button"
                    className={`relative isolate text-left ${many ? "cursor-pointer" : "cursor-default"}`}
                    onClick={() => many && setOpen((o) => !o)}
                >
                    {/* Ghost cards behind the top one; they tuck away when open. */}
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
                        <Card
                            facility={f}
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
                                <Footer
                                    left={
                                        top.underConstruction
                                            ? "🚧 Building"
                                            : open
                                              ? `Built Round ${top.builtRound}`
                                              : "Remaining"
                                    }
                                    right={
                                        open || !many ? (
                                            <>
                                                <LifetimePips
                                                    remaining={
                                                        top.remainingRounds
                                                    }
                                                    total={f.lifetime_rounds}
                                                    color={color}
                                                />
                                                {roundsLabel(
                                                    top.remainingRounds,
                                                )}
                                            </>
                                        ) : (
                                            lifetimeRange(copies)
                                        )
                                    }
                                />
                            }
                        />
                    </div>
                    {/*
                     * The opened copies: only each one's bottom row. They hang
                     * off the card's own bottom edge, not the grid row, so a
                     * short card has no gap above them. Each one starts well
                     * up behind the card (or the row above it), so its top is
                     * hidden behind the rounded corners.
                     */}
                    <div className="absolute inset-x-0 top-full z-0">
                        <AnimatePresence>
                            {open &&
                                copies.slice(1).map((c, i) => (
                                    <motion.div
                                        // eslint-disable-next-line react/no-array-index-key
                                        key={i}
                                        className="relative rounded-b-2xl px-2 pb-2"
                                        style={{
                                            zIndex: 19 - i,
                                            background: frame,
                                            marginTop: -STRIP_OVERLAP,
                                            paddingTop: STRIP_OVERLAP + 4,
                                        }}
                                        initial={{
                                            y: -(i + 1) * STRIP_VISIBLE,
                                            opacity: 0,
                                        }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{
                                            y: -(i + 1) * STRIP_VISIBLE,
                                            opacity: 0,
                                        }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 320,
                                            damping: 28,
                                            delay: i * 0.05,
                                        }}
                                    >
                                        <div className="rounded-lg bg-amber-50 px-2 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
                                            <Footer
                                                left={
                                                    c.underConstruction
                                                        ? "🚧 Building"
                                                        : `Built Round ${c.builtRound}`
                                                }
                                                right={
                                                    <>
                                                        <LifetimePips
                                                            remaining={
                                                                c.remainingRounds
                                                            }
                                                            total={
                                                                f.lifetime_rounds
                                                            }
                                                            color={color}
                                                        />
                                                        {roundsLabel(
                                                            c.remainingRounds,
                                                        )}
                                                    </>
                                                }
                                            />
                                        </div>
                                    </motion.div>
                                ))}
                        </AnimatePresence>
                    </div>
                </button>
            </div>
            {/* Reserves the room the opened rows take, so the next grid row moves down. */}
            <motion.div
                className="w-60"
                initial={false}
                animate={{
                    height: open ? (copies.length - 1) * STRIP_VISIBLE : 0,
                }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
            />
        </div>
    );
}
