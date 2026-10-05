/**
 * PROTOTYPE — Variant A, "Top Trumps".
 *
 * A plain, uniform grid of cards. Each card is a coloured frame with a title
 * band, the image, then a numbered stat table. The cost of buying sits on a
 * dashed "ticket" under the card.
 *
 * Fleet: clicking a stack slides each copy down from behind the top card, in
 * the page flow, so the grid below moves out of the way. Only each copy's
 * bottom row (its remaining lifetime) shows.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Clock, Cloud, Hammer } from "lucide-react";
import { useState } from "react";

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

const ROW_H = 36;

export function VariantA({
    tab,
    catalog,
}: {
    tab: "catalog" | "fleet";
    catalog: Facility[];
}) {
    if (tab === "catalog") {
        return (
            <div className="flex flex-wrap gap-6">
                {catalog.map((f, i) => (
                    <div key={f.id} className="flex flex-col gap-2">
                        <TrumpCard facility={f} number={i + 1} />
                        <BuyTicket facility={f} />
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-8">
            {fleetStacks().map(({ facility, copies }) => (
                <Stack key={facility.id} facility={facility} copies={copies} />
            ))}
        </div>
    );
}

function TrumpCard({
    facility: f,
    number,
    bottom,
}: {
    facility: Facility;
    number?: number;
    bottom?: React.ReactNode;
}) {
    const color = CATEGORY_COLOR[f.category];
    const stats = cardStats(f, CATALOG);
    return (
        <div
            className="w-56 overflow-hidden rounded-xl border-4 bg-card shadow-md"
            style={{ borderColor: color }}
        >
            <div
                className="flex items-center justify-between px-2 py-1 text-sm font-bold text-white"
                style={{ backgroundColor: color }}
            >
                <span className="truncate">{f.name}</span>
                {number !== undefined && (
                    <span className="font-mono text-xs opacity-80">
                        #{String(number).padStart(2, "0")}
                    </span>
                )}
            </div>
            <div className="relative">
                <img
                    src={f.image}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                />
                {f.availability !== "base" && (
                    <span className="absolute top-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300 uppercase">
                        ★ Upgrade
                    </span>
                )}
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {f.category}
                </span>
            </div>
            <table className="w-full text-xs">
                <tbody>
                    {stats.map((s, i) => (
                        <tr
                            key={s.key}
                            className={i % 2 === 0 ? "bg-muted/60" : ""}
                        >
                            <td className="px-2 py-1 text-muted-foreground">
                                {s.label}
                            </td>
                            <td className="px-2 py-1 text-right font-mono font-semibold">
                                {s.value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {bottom ?? (
                <LifetimeRow>
                    <span>Lifetime</span>
                    <span className="font-mono font-semibold">
                        {roundsLabel(f.lifetime_rounds)}
                    </span>
                </LifetimeRow>
            )}
        </div>
    );
}

function LifetimeRow({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="flex items-center justify-between border-t border-border px-2 text-xs"
            style={{ height: ROW_H }}
        >
            {children}
        </div>
    );
}

function BuyTicket({ facility: f }: { facility: Facility }) {
    return (
        <div className="w-56 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs">
            <div className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Cost to buy
            </div>
            <div className="flex items-center justify-between">
                <Money amount={f.base_price} className="text-base font-bold" />
                <span
                    className="flex items-center gap-1"
                    title="Construction time"
                >
                    <Hammer className="size-3.5" />
                    {f.construction_lag_rounds === 0
                        ? "Ready now"
                        : `${roundsLabel(f.construction_lag_rounds)}`}
                </span>
                <span
                    className="flex items-center gap-1"
                    title="Construction pollution"
                >
                    <Cloud className="size-3.5" />
                    {formatEmissions(f.base_construction_pollution)}
                </span>
            </div>
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

    return (
        <div className="relative w-56" style={{ paddingRight: ghosts * 4 }}>
            {/* Ghost cards peeking out behind the top card. */}
            {!open &&
                Array.from({ length: ghosts }, (_, i) => (
                    <div
                        key={i}
                        className="absolute inset-0 w-56 rounded-xl border-4 bg-card"
                        style={{
                            borderColor: color,
                            transform: `translate(${(ghosts - i) * 4}px, ${(ghosts - i) * 4}px)`,
                            opacity: 0.9 - i * 0.15,
                        }}
                    />
                ))}
            <button
                type="button"
                className="relative z-10 block cursor-pointer text-left"
                onClick={() => many && setOpen((o) => !o)}
            >
                <TrumpCard
                    facility={f}
                    bottom={
                        <LifetimeRow>
                            <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {open
                                    ? `Built Round ${copies[0]!.builtRound}`
                                    : "Remaining"}
                            </span>
                            <span className="font-mono font-semibold">
                                {open
                                    ? roundsLabel(copies[0]!.remainingRounds)
                                    : lifetimeRange(copies)}
                            </span>
                        </LifetimeRow>
                    }
                />
                {many && (
                    <span
                        className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full border-2 border-background text-sm font-bold text-white shadow"
                        style={{ backgroundColor: color }}
                    >
                        ×{copies.length}
                    </span>
                )}
                {copies[0]!.underConstruction && (
                    <span className="absolute top-10 left-1/2 -translate-x-1/2 rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
                        Under construction
                    </span>
                )}
            </button>
            <AnimatePresence>
                {open &&
                    copies.slice(1).map((c, i) => (
                        <motion.div
                            key={i}
                            className="relative w-56 overflow-hidden rounded-b-xl border-4 border-t-0 bg-card"
                            style={{ borderColor: color, zIndex: 9 - i }}
                            initial={{ y: -(i + 1) * ROW_H, opacity: 0.6 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -(i + 1) * ROW_H, opacity: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 30,
                                delay: i * 0.05,
                            }}
                        >
                            <LifetimeRow>
                                <span className="text-muted-foreground">
                                    Built Round {c.builtRound}
                                </span>
                                <span className="flex items-center gap-2 font-mono font-semibold">
                                    <LifetimePips
                                        remaining={c.remainingRounds}
                                        total={f.lifetime_rounds}
                                        color={color}
                                    />
                                    {roundsLabel(c.remainingRounds)}
                                </span>
                            </LifetimeRow>
                        </motion.div>
                    ))}
            </AnimatePresence>
        </div>
    );
}
