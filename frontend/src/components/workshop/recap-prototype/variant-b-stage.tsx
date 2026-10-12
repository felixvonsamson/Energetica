/**
 * PROTOTYPE — wipe me. Recap variant B, "Stage": one story per slide, in big
 * type, for the facilitator to narrate from a projector. A player on a laptop
 * steps through at their own pace. Space, Page Down or ↓ goes forward; ↑ or
 * Page Up goes back. (← and → are taken by the prototype switcher.)
 */

import {
    ArrowDown,
    ArrowUp,
    Factory,
    Flag,
    type LucideIcon,
    Newspaper,
    Sparkles,
    TrendingUp,
    Users,
    Zap,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Button, Money } from "@/components/ui";
import { SEASON_ICONS } from "@/components/workshop/season-icons";
import { formatEmissions, formatEnergy, formatPower } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { SEASON_LABELS } from "@/lib/workshop-timeline";

import {
    demandChange,
    formatPercent,
    type RecapScenario,
    type RecapStory,
} from "./prototype-data";

interface Slide {
    key: string;
    icon: LucideIcon;
    eyebrow: string;
    body: ReactNode;
    tone?: "bad" | "good" | "alarm";
}

function buildSlides(scenario: RecapScenario): Slide[] {
    const next = scenario.round + 1;
    const isLast = scenario.round === scenario.roundCount;
    const slides: Slide[] = [
        {
            key: "title",
            icon: Flag,
            eyebrow: `Round ${scenario.round} of ${scenario.roundCount}`,
            body: (
                <Big>
                    {isLast ? "The last year is over." : "The year is over."}
                </Big>
            ),
        },
    ];
    if (scenario.blackout) {
        slides.push({
            key: "blackout",
            icon: Zap,
            tone: "alarm",
            eyebrow: `${SEASON_LABELS[scenario.blackout.season]} · Blackout`,
            body: (
                <>
                    <Big>The grid went down.</Big>
                    <Small>
                        The room could not cover must-serve demand. The rest of
                        the year was called off, and everyone's cash was reset
                        to the same amount.
                    </Small>
                </>
            ),
        });
    }
    for (const story of scenario.happened) slides.push(storySlide(story));
    if (!isLast) {
        if (scenario.coming.length || scenario.unlocks.length) {
            slides.push({
                key: "ahead",
                icon: Newspaper,
                eyebrow: `Round ${next}`,
                body: <Big>Here is what changes next year.</Big>,
            });
        }
        for (const story of scenario.coming) slides.push(storySlide(story));
        for (const unlock of scenario.unlocks) {
            slides.push({
                key: `unlock:${unlock.facility}`,
                icon: Sparkles,
                tone: "good",
                eyebrow: `New technology · from Round ${next}`,
                body: (
                    <>
                        <Big>{unlock.facility} is now on sale.</Big>
                        <Small>
                            {unlock.from ? `It upgrades ${unlock.from}. ` : ""}
                            {unlock.why}.
                        </Small>
                    </>
                ),
            });
        }
        const change = demandChange(scenario);
        if (change !== null && scenario.demand) {
            slides.push({
                key: "demand",
                icon: TrendingUp,
                eyebrow: `Demand in Round ${next}`,
                body: (
                    <>
                        <p
                            className={cn(
                                "text-[clamp(4rem,14vw,11rem)] leading-none font-black",
                                change > 0 && "text-warning",
                                change < 0 && "text-success",
                            )}
                        >
                            {formatPercent(change)}
                        </p>
                        <Small>
                            Peak demand {formatPower(scenario.demand.thisRound)}{" "}
                            → {formatPower(scenario.demand.nextRound)}
                            {scenario.demand.drivers.length > 0 &&
                                `, because of: ${scenario.demand.drivers.join(", ")}`}
                        </Small>
                    </>
                ),
            });
        }
    }
    slides.push({
        key: "room",
        icon: Users,
        eyebrow: `The room in Round ${scenario.round}`,
        body: (
            <div className="grid grid-cols-2 gap-x-12 gap-y-6 text-left md:grid-cols-3">
                <Stat label="CO₂ emitted">
                    {formatEmissions(scenario.room.emissionsRound)}
                </Stat>
                <Stat label="CO₂ since Round 1">
                    {formatEmissions(scenario.room.emissionsTotal)}
                </Stat>
                <Stat label="From renewables">
                    {(scenario.room.renewableShare * 100).toFixed(0)}%
                </Stat>
                <Stat label="Capacity built">
                    {formatPower(scenario.room.builtCapacity)}
                </Stat>
                <Stat label="Energy sold">
                    {formatEnergy(scenario.room.energySold)}
                </Stat>
                <Stat label="Average price /MWh">
                    <Money amount={scenario.room.averagePrice} />
                </Stat>
            </div>
        ),
    });
    slides.push({
        key: "end",
        icon: Factory,
        eyebrow: isLast ? "Game over" : `Round ${next}`,
        body: (
            <Big>
                {isLast
                    ? "Thank you for playing."
                    : "Investment opens when the facilitator is ready."}
            </Big>
        ),
    });
    return slides;
}

function storySlide(story: RecapStory): Slide {
    return {
        key: story.id,
        icon: story.season ? SEASON_ICONS[story.season] : Newspaper,
        tone: story.tone,
        eyebrow: [
            story.season ? SEASON_LABELS[story.season] : "Next Round",
            story.name,
            story.severity,
        ]
            .filter(Boolean)
            .join(" · "),
        body: (
            <>
                <p className="font-serif text-[clamp(1.75rem,4vw,3.5rem)] leading-tight font-bold">
                    “{story.headline}”
                </p>
                <Small>{story.effect}</Small>
            </>
        ),
    };
}

export function VariantStage({ scenario }: { scenario: RecapScenario }) {
    const slides = buildSlides(scenario);
    const [index, setIndex] = useState(0);
    const at = Math.min(index, slides.length - 1);
    const go = (by: number) =>
        setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + by)));

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (["ArrowDown", "PageDown", " "].includes(event.key)) {
                event.preventDefault();
                go(1);
            }
            if (["ArrowUp", "PageUp"].includes(event.key)) {
                event.preventDefault();
                go(-1);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const slide = slides[at]!;
    const Icon = slide.icon;
    return (
        <div
            className={cn(
                "relative flex min-h-[calc(100svh-12rem)] flex-col rounded-2xl border p-6 transition-colors md:p-12",
                slide.tone === "alarm"
                    ? "border-destructive bg-destructive text-white"
                    : slide.tone === "bad"
                      ? "border-warning/40 bg-warning/5"
                      : slide.tone === "good"
                        ? "border-success/40 bg-success/5"
                        : "border-border bg-card",
            )}
        >
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                <Icon className="size-16 opacity-80 md:size-24" />
                <p className="text-sm tracking-[0.25em] uppercase opacity-70 md:text-base">
                    {slide.eyebrow}
                </p>
                <div className="max-w-5xl space-y-6">{slide.body}</div>
            </div>
            <div className="mt-8 flex items-center justify-between gap-4">
                <Button
                    variant="ghost"
                    onClick={() => go(-1)}
                    disabled={at === 0}
                >
                    <ArrowUp className="size-4" /> Back
                </Button>
                <div className="flex flex-wrap justify-center gap-1.5">
                    {slides.map((s, i) => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-label={`Slide ${i + 1}`}
                            className={cn(
                                "h-2 rounded-full bg-current transition-all",
                                i === at ? "w-6 opacity-90" : "w-2 opacity-25",
                            )}
                        />
                    ))}
                </div>
                <Button
                    variant={at === slides.length - 1 ? "ghost" : "default"}
                    onClick={() => go(1)}
                    disabled={at === slides.length - 1}
                >
                    Next <ArrowDown className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function Big({ children }: { children: ReactNode }) {
    return (
        <p className="font-titles text-[clamp(2.25rem,6vw,5rem)] leading-tight font-bold">
            {children}
        </p>
    );
}

function Small({ children }: { children: ReactNode }) {
    return <p className="text-lg opacity-75 md:text-2xl">{children}</p>;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-sm tracking-wide uppercase opacity-60">
                {label}
            </p>
            <p className="text-3xl font-bold md:text-5xl">{children}</p>
        </div>
    );
}
