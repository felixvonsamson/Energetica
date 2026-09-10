/**
 * PROTOTYPE — Workshop Mode: Trading-period review page (issue #992, spec §12).
 * Reviews Round 3's Summer trading period: the real power-generation chart's
 * stand-in, a scrubber through the day's settlement points, the merit-order
 * chart for whichever point the scrubber is on, and a separate tab for the
 * price the player submitted (spec user story #53). All data is invented — see
 * `lib/workshop-prototype/sample-data.ts`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    GenerationStackChart,
    MeritOrderChart,
} from "@/components/workshop-prototype/charts";
import { WorkshopChrome } from "@/components/workshop-prototype/chrome";
import { cn } from "@/lib/utils";
import {
    SESSION,
    buildMeritOrderForHour,
    buildSummerDay,
} from "@/lib/workshop-prototype/sample-data";

export const Route = createFileRoute("/app/prototype/workshop/trading-period")({
    component: TradingPeriodPrototypePage,
    staticData: {
        title: "Workshop — Trading Period Review (Prototype)",
        routeConfig: { requiredRole: null },
    },
    // The mockup always shows Round 3's Summer regardless of which
    // timeline icon was clicked — round/season are accepted (so the
    // chrome's links type-check) but not used to vary content.
    validateSearch: (
        search: Record<string, unknown>,
    ): { round?: number; season?: string } => ({
        round: search.round !== undefined ? Number(search.round) : undefined,
        season: search.season !== undefined ? String(search.season) : undefined,
    }),
});

const DAY = buildSummerDay();

function TradingPeriodPrototypePage() {
    return (
        <WorkshopChrome
            phaseLabel="Review — Summer"
            phaseKind="review"
            phaseSeconds={null}
            carbonTaxActive
            timeline={{
                currentRound: 3,
                currentSeason: "summer",
            }}
            priceSeasonLabel="Summer"
        >
            <TradingPeriodContent />
        </WorkshopChrome>
    );
}

function TradingPeriodContent() {
    const [hour, setHour] = useState(19); // start on the evening peak — the interesting bit
    const [playing, setPlaying] = useState(false);
    const [tab, setTab] = useState<"chart" | "prices">("chart");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!playing) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(() => {
            setHour((h) => (h + 1) % 24);
        }, 700);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [playing]);

    const genAtHour = DAY.generation[hour]!;
    const { offers, clearingPrice } = buildMeritOrderForHour(hour, genAtHour);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold font-titles">
                        Round {SESSION.currentRound - 1} — Summer review
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        This period&apos;s bids were locked once, at the start
                        of Summer, and held for all 24 settlement points below.
                    </p>
                </div>
                <div className="flex rounded-lg border border-border p-0.5 bg-muted text-sm">
                    <button
                        onClick={() => setTab("chart")}
                        className={cn(
                            "px-3 py-1.5 rounded-md",
                            tab === "chart" &&
                                "bg-background shadow-sm font-medium",
                        )}
                    >
                        Chart
                    </button>
                    <button
                        onClick={() => setTab("prices")}
                        className={cn(
                            "px-3 py-1.5 rounded-md",
                            tab === "prices" &&
                                "bg-background shadow-sm font-medium",
                        )}
                    >
                        My prices
                    </button>
                </div>
            </div>

            {tab === "prices" ? (
                <MyPricesTab />
            ) : (
                <>
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h2 className="font-semibold font-titles text-sm text-muted-foreground uppercase tracking-wide">
                            Power generation — Summer, hourly
                        </h2>
                        <GenerationStackChart
                            hours={DAY.hours}
                            generation={DAY.generation as never}
                            markHour={hour}
                        />
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setPlaying((p) => !p)}
                                aria-label={playing ? "Pause" : "Play"}
                            >
                                {playing ? (
                                    <Pause className="size-4" />
                                ) : (
                                    <Play className="size-4" />
                                )}
                            </Button>
                            <Slider
                                value={[hour]}
                                min={0}
                                max={23}
                                step={1}
                                onValueChange={([v]) => {
                                    setPlaying(false);
                                    setHour(v ?? 0);
                                }}
                                className="flex-1"
                            />
                            <span className="font-mono text-sm w-14 text-right">
                                {String(hour).padStart(2, "0")}:00
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Scrub to any settlement point — a moderator can
                            pause here to narrate what happened.
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold font-titles text-sm text-muted-foreground uppercase tracking-wide">
                                Merit order — {String(hour).padStart(2, "0")}:00
                            </h2>
                            <span className="text-sm">
                                Clearing price:{" "}
                                <span className="font-mono font-semibold">
                                    €{clearingPrice}/MWh
                                </span>
                            </span>
                        </div>
                        <MeritOrderChart
                            offers={offers}
                            clearingPrice={clearingPrice}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

function MyPricesTab() {
    return (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 max-w-md">
            <h2 className="font-semibold font-titles text-sm text-muted-foreground uppercase tracking-wide">
                Your submitted price
            </h2>
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                <span>Summer, Round 3</span>
                <span className="font-mono text-2xl font-semibold">
                    €46/MWh
                </span>
            </div>
            <p className="text-sm text-muted-foreground">
                Held for the whole period — a static figure, not a per-hour
                value, which is why it&apos;s kept off the scrub view above.
            </p>
        </div>
    );
}
