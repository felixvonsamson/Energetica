/**
 * PROTOTYPE — Variant B, "Pokémon on a shop shelf".
 *
 * Cards are grouped on shelves, one per category. Each card has a thick
 * gradient frame, the headline stat (power, or capacity for storage) in the
 * corner like a Pokémon's HP, a "type" line, and stats as icon rows. Upgrade
 * cards get a holographic shimmer. The cost of buying is printed on the shelf
 * edge under each card, like a shop label.
 *
 * Fleet: clicking a stack lifts it into an overlay. The copies slide down from
 * behind the top card there, so the page underneath never moves.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Cloud, Hammer, Star, X } from "lucide-react";
import { useState } from "react";

import { Money } from "@/components/ui/money";
import { formatEmissions } from "@/lib/format-utils";

import {
    CATALOG,
    type Category,
    CATEGORY_COLOR,
    type Facility,
    fleetStacks,
    lifetimeRange,
    type OwnedFacility,
} from "./mock";
import { cardStats, LifetimePips, roundsLabel } from "./stats";

const ROW_H = 34;

export function VariantB({
    tab,
    catalog,
}: {
    tab: "catalog" | "fleet";
    catalog: Facility[];
}) {
    if (tab === "catalog") {
        const categories = [...new Set(catalog.map((f) => f.category))];
        return (
            <div className="flex flex-col gap-10">
                {categories.map((cat) => (
                    <Shelf key={cat} category={cat}>
                        {catalog
                            .filter((f) => f.category === cat)
                            .map((f) => (
                                <div key={f.id} className="flex flex-col">
                                    <PokeCard facility={f} />
                                    <ShelfLabel facility={f} />
                                </div>
                            ))}
                    </Shelf>
                ))}
            </div>
        );
    }
    return <Fleet />;
}

function Shelf({
    category,
    children,
}: {
    category: Category;
    children: React.ReactNode;
}) {
    return (
        <section>
            <h3
                className="mb-3 inline-block rounded-full px-3 py-0.5 text-sm font-bold text-white"
                style={{ backgroundColor: CATEGORY_COLOR[category] }}
            >
                {category}
            </h3>
            <div className="flex flex-wrap gap-6 border-b-8 border-muted pb-0">
                {children}
            </div>
        </section>
    );
}

function PokeCard({
    facility: f,
    footer,
}: {
    facility: Facility;
    footer?: React.ReactNode;
}) {
    const color = CATEGORY_COLOR[f.category];
    const stats = cardStats(f, CATALOG);
    const [headline, ...rest] = stats;
    const upgrade = f.availability !== "base";
    return (
        <div
            className="relative w-60 rounded-2xl p-2 shadow-lg"
            style={{
                background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, white))`,
            }}
        >
            {upgrade && (
                <div
                    className="pointer-events-none absolute inset-0 rounded-2xl opacity-40 mix-blend-overlay"
                    style={{
                        background:
                            "linear-gradient(115deg, transparent 20%, #ff80bf 35%, #80ffea 50%, #ffff80 65%, transparent 80%)",
                        backgroundSize: "250% 250%",
                        animation: "proto-holo 4s linear infinite",
                    }}
                />
            )}
            <div className="relative rounded-xl bg-amber-50 p-2 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
                <div className="flex items-baseline justify-between gap-1">
                    <span className="flex items-center gap-1 truncate text-sm font-extrabold">
                        {upgrade && (
                            <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />
                        )}
                        {f.name}
                    </span>
                    <span className="shrink-0 text-xs font-bold whitespace-nowrap">
                        <span className="text-[10px] opacity-60">
                            {headline!.label === "Capacity" ? "" : "⚡"}
                        </span>
                        {headline!.value}
                    </span>
                </div>
                <div
                    className="mt-1 overflow-hidden rounded-md border-4"
                    style={{
                        borderColor: `color-mix(in srgb, ${color} 60%, #d6c48a)`,
                    }}
                >
                    <img
                        src={f.image}
                        alt=""
                        className="aspect-[16/10] w-full object-cover"
                    />
                </div>
                <div className="my-1 text-center text-[10px] italic opacity-70">
                    {f.category} facility
                    {f.fuel_type ? ` · burns ${f.fuel_type}` : ""}
                </div>
                <ul className="divide-y divide-stone-300 text-xs dark:divide-stone-700">
                    {rest
                        .filter((s) => s.key !== "fuel")
                        .map((s) => (
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
                    <div
                        className="mt-1 flex items-center justify-between border-t-2 border-stone-300 pt-1 text-[11px] dark:border-stone-700"
                        style={{ height: ROW_H - 6 }}
                    >
                        <span className="opacity-70">Lifetime</span>
                        <span className="flex items-center gap-1.5 font-bold">
                            <LifetimePips
                                remaining={f.lifetime_rounds}
                                total={f.lifetime_rounds}
                                color={color}
                            />
                            {roundsLabel(f.lifetime_rounds)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ShelfLabel({ facility: f }: { facility: Facility }) {
    return (
        <div className="mt-3 flex w-60 items-center justify-between rounded-t-md bg-foreground px-2 py-1.5 text-xs text-background">
            <Money amount={f.base_price} className="text-sm font-bold" />
            <span className="flex items-center gap-1">
                <Hammer className="size-3" />
                {f.construction_lag_rounds === 0
                    ? "Instant"
                    : roundsLabel(f.construction_lag_rounds)}
            </span>
            <span className="flex items-center gap-1">
                <Cloud className="size-3" />
                {formatEmissions(f.base_construction_pollution)}
            </span>
        </div>
    );
}

function Fleet() {
    const [openId, setOpenId] = useState<string | null>(null);
    const stacks = fleetStacks();
    const opened = stacks.find((s) => s.facility.id === openId);
    return (
        <>
            <div className="flex flex-wrap gap-8">
                {stacks.map(({ facility, copies }) => (
                    <motion.button
                        key={facility.id}
                        layoutId={`stack-${facility.id}`}
                        type="button"
                        className="relative text-left"
                        onClick={() =>
                            copies.length > 1 && setOpenId(facility.id)
                        }
                        style={{
                            visibility:
                                openId === facility.id ? "hidden" : "visible",
                        }}
                    >
                        <StackPile copies={copies} facility={facility} />
                    </motion.button>
                ))}
            </div>
            <AnimatePresence>
                {opened && (
                    <motion.div
                        className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/60 pt-16 pb-24 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setOpenId(null)}
                    >
                        <motion.div
                            layoutId={`stack-${opened.facility.id}`}
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                className="absolute -top-10 right-0 rounded-full bg-background p-1.5"
                                onClick={() => setOpenId(null)}
                            >
                                <X className="size-4" />
                            </button>
                            <OpenStack
                                facility={opened.facility}
                                copies={opened.copies}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function StackFooter({
    left,
    right,
}: {
    left: React.ReactNode;
    right: React.ReactNode;
}) {
    return (
        <div
            className="mt-1 flex items-center justify-between border-t-2 border-stone-300 pt-1 text-[11px] dark:border-stone-700"
            style={{ height: ROW_H - 6 }}
        >
            <span className="opacity-70">{left}</span>
            <span className="flex items-center gap-1.5 font-bold">{right}</span>
        </div>
    );
}

function StackPile({
    facility: f,
    copies,
}: {
    facility: Facility;
    copies: OwnedFacility[];
}) {
    const color = CATEGORY_COLOR[f.category];
    const ghosts = Math.min(copies.length - 1, 3);
    return (
        <div className="relative">
            {Array.from({ length: ghosts }, (_, i) => (
                <div
                    key={i}
                    className="absolute inset-0 rounded-2xl shadow"
                    style={{
                        background: color,
                        transform: `rotate(${(i + 1) * 2.5}deg)`,
                        opacity: 0.85 - i * 0.2,
                    }}
                />
            ))}
            <div className="relative">
                <PokeCard
                    facility={f}
                    footer={
                        <StackFooter
                            left={
                                copies[0]!.underConstruction
                                    ? "🚧 Under construction"
                                    : "Remaining"
                            }
                            right={lifetimeRange(copies)}
                        />
                    }
                />
            </div>
            {copies.length > 1 && (
                <span className="absolute -right-3 -bottom-3 flex size-9 items-center justify-center rounded-full bg-foreground text-sm font-extrabold text-background shadow-lg ring-2 ring-background">
                    {copies.length}
                </span>
            )}
        </div>
    );
}

function OpenStack({
    facility: f,
    copies,
}: {
    facility: Facility;
    copies: OwnedFacility[];
}) {
    const color = CATEGORY_COLOR[f.category];
    return (
        <div className="relative">
            <div className="relative z-20">
                <PokeCard
                    facility={f}
                    footer={
                        <StackFooter
                            left={`Built Round ${copies[0]!.builtRound}`}
                            right={
                                <>
                                    <LifetimePips
                                        remaining={copies[0]!.remainingRounds}
                                        total={f.lifetime_rounds}
                                        color={color}
                                    />
                                    {roundsLabel(copies[0]!.remainingRounds)}
                                </>
                            }
                        />
                    }
                />
            </div>
            {copies.slice(1).map((c, i) => (
                <motion.div
                    key={i}
                    className="relative -mt-2 rounded-b-2xl px-2 pt-2 pb-2"
                    style={{
                        zIndex: 19 - i,
                        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, white))`,
                    }}
                    initial={{ y: -(i + 1) * (ROW_H + 8) }}
                    animate={{ y: 0 }}
                    transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 24,
                        delay: 0.15 + i * 0.07,
                    }}
                >
                    <div className="rounded-lg bg-amber-50 px-2 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
                        <StackFooter
                            left={`Built Round ${c.builtRound}`}
                            right={
                                <>
                                    <LifetimePips
                                        remaining={c.remainingRounds}
                                        total={f.lifetime_rounds}
                                        color={color}
                                    />
                                    {roundsLabel(c.remainingRounds)}
                                </>
                            }
                        />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
