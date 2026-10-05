/**
 * PROTOTYPE — Variant C, "Collector's binder with stat bars".
 *
 * Dark, full-bleed cards: the image fills the top with the name over it, and
 * the stats are bars measured against the whole catalog, so cards compare at a
 * glance the way Top Trumps are played. The cost of buying hangs off the card
 * like a price tag on a string.
 *
 * Fleet: clicking a stack fans the copies out over whatever is below, slightly
 * rotated like a hand of cards. Nothing on the page moves. Clicking anywhere
 * closes it.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Cloud, Hammer } from "lucide-react";
import { useEffect, useState } from "react";

import { Money } from "@/components/ui/money";
import { formatEmissions } from "@/lib/format-utils";

import {
    CATALOG,
    CATEGORY_COLOR,
    type Facility,
    fleetStacks,
    lifetimeRange,
    type OwnedFacility,
} from "./mock";
import { cardStats, LifetimePips, roundsLabel } from "./stats";

const ROW_H = 32;

export function VariantC({
    tab,
    catalog,
}: {
    tab: "catalog" | "fleet";
    catalog: Facility[];
}) {
    if (tab === "catalog") {
        return (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-x-5 gap-y-8">
                {catalog.map((f) => (
                    <div key={f.id} className="flex flex-col items-center">
                        <BinderCard facility={f} />
                        <PriceTag facility={f} />
                    </div>
                ))}
            </div>
        );
    }
    return <Fleet />;
}

function BinderCard({
    facility: f,
    footer,
}: {
    facility: Facility;
    footer?: React.ReactNode;
}) {
    const color = CATEGORY_COLOR[f.category];
    const stats = cardStats(f, CATALOG);
    const upgrade = f.availability !== "base";
    return (
        <div
            className="w-52 overflow-hidden rounded-lg bg-zinc-900 text-zinc-100"
            style={{
                boxShadow: `0 0 0 2px ${color}, 0 0 ${upgrade ? 22 : 10}px ${color}${upgrade ? "" : "66"}`,
            }}
        >
            <div className="relative">
                <img
                    src={f.image}
                    alt=""
                    className="aspect-square w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-900 via-zinc-900/80 to-transparent px-2 pt-8 pb-1">
                    <div className="text-[10px] tracking-widest uppercase opacity-70">
                        {f.category}
                        {upgrade && " · Upgrade"}
                    </div>
                    <div className="leading-tight font-bold">{f.name}</div>
                </div>
            </div>
            <div className="space-y-1.5 px-2 py-2">
                {stats.map((s) => (
                    <div key={s.key} className="text-[11px]">
                        <div className="flex justify-between">
                            <span className="flex items-center gap-1 opacity-70">
                                <s.icon className="size-3" />
                                {s.label}
                            </span>
                            <span className="font-mono font-semibold">
                                {s.value}
                            </span>
                        </div>
                        {s.key !== "fuel" && (
                            <div className="mt-0.5 h-1 rounded-full bg-zinc-700">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${Math.max(0, Math.min(1, s.strength)) * 100}%`,
                                        backgroundColor: s.color ?? color,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
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
            className="flex items-center justify-between border-t border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100"
            style={{ height: ROW_H }}
        >
            <span className="opacity-70">{left}</span>
            <span className="flex items-center gap-1.5 font-mono font-semibold">
                {right}
            </span>
        </div>
    );
}

function PriceTag({ facility: f }: { facility: Facility }) {
    return (
        <div className="flex flex-col items-center">
            {/* The string. */}
            <div className="h-4 w-px bg-muted-foreground" />
            <div className="relative -rotate-2 rounded-md border border-border bg-amber-100 px-3 py-1.5 text-stone-900 shadow-sm">
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
            </div>
        </div>
    );
}

function Fleet() {
    const [openId, setOpenId] = useState<string | null>(null);
    useEffect(() => {
        if (!openId) return;
        const close = () => setOpenId(null);
        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
    }, [openId]);
    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-x-5 gap-y-10">
            {fleetStacks().map(({ facility, copies }) => (
                <Stack
                    key={facility.id}
                    facility={facility}
                    copies={copies}
                    open={openId === facility.id}
                    onOpen={() => setOpenId(facility.id)}
                />
            ))}
        </div>
    );
}

function Stack({
    facility: f,
    copies,
    open,
    onOpen,
}: {
    facility: Facility;
    copies: OwnedFacility[];
    open: boolean;
    onOpen: () => void;
}) {
    const color = CATEGORY_COLOR[f.category];
    const ghosts = Math.min(copies.length - 1, 3);
    return (
        <div className={`relative w-52 ${open ? "z-30" : "z-0"}`}>
            {!open &&
                Array.from({ length: ghosts }, (_, i) => (
                    <div
                        key={i}
                        className="absolute inset-0 rounded-lg bg-zinc-800"
                        style={{
                            boxShadow: `0 0 0 2px ${color}`,
                            transform: `translate(${(i + 1) * 3}px, ${-(i + 1) * 3}px)`,
                        }}
                    />
                ))}
            <button
                type="button"
                className="relative z-10 block text-left"
                onClick={(e) => {
                    if (copies.length < 2) return;
                    e.stopPropagation();
                    onOpen();
                }}
            >
                <BinderCard
                    facility={f}
                    footer={
                        <Footer
                            left={
                                copies[0]!.underConstruction
                                    ? "Under construction"
                                    : open
                                      ? `Built R${copies[0]!.builtRound}`
                                      : "Remaining"
                            }
                            right={
                                open
                                    ? roundsLabel(copies[0]!.remainingRounds)
                                    : lifetimeRange(copies)
                            }
                        />
                    }
                />
                {copies.length > 1 && !open && (
                    <span
                        className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 font-mono text-xs font-bold text-white shadow"
                        style={{ backgroundColor: color }}
                    >
                        {copies.length} cards
                    </span>
                )}
            </button>
            {/* The fan: floats over the grid below, so nothing reflows. */}
            <div className="absolute inset-x-0 top-full">
                <AnimatePresence>
                    {open &&
                        copies.slice(1).map((c, i) => {
                            const tilt = (i % 2 === 0 ? -1 : 1) * (1 + i * 0.6);
                            return (
                                <motion.div
                                    key={i}
                                    className="overflow-hidden rounded-b-lg shadow-xl"
                                    style={{
                                        boxShadow: `0 0 0 2px ${color}, 0 8px 16px rgba(0,0,0,.4)`,
                                        zIndex: 9 - i,
                                        position: "relative",
                                    }}
                                    initial={{
                                        y: -(i + 1) * ROW_H,
                                        rotate: 0,
                                        opacity: 0,
                                    }}
                                    animate={{ y: 0, rotate: tilt, opacity: 1 }}
                                    exit={{
                                        y: -(i + 1) * ROW_H,
                                        rotate: 0,
                                        opacity: 0,
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 22,
                                        delay: i * 0.06,
                                    }}
                                >
                                    <Footer
                                        left={`Built R${c.builtRound}`}
                                        right={
                                            <>
                                                <LifetimePips
                                                    remaining={
                                                        c.remainingRounds
                                                    }
                                                    total={f.lifetime_rounds}
                                                    color={color}
                                                />
                                                {roundsLabel(c.remainingRounds)}
                                            </>
                                        }
                                    />
                                </motion.div>
                            );
                        })}
                </AnimatePresence>
            </div>
        </div>
    );
}
