/**
 * One Round's events in the facilitator's console (#1012, #1018, #1190). The
 * Round has one slot for Round events, which fire when its Investment phase
 * opens, and one slot per season for seasonal events, which fire when that
 * season's Trading period opens. In each slot, every category is a pool of
 * tiles graded by severity. Clicking a tile plans it, in place of the
 * category's earlier pick for the slot, and clicking it again drops it. A
 * checkmark marks the pick, and a star the severity the session's CO₂ so far
 * suggests for a climate event. The facilitator never sees a headline, so the
 * Recap surprises them too.
 *
 * Round 1 holds no events. A locked Round lists what was planned, and which
 * events fired and which a blackout skipped.
 */

import { Check, Star } from "lucide-react";
import { useState } from "react";

import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { TypographyMuted } from "@/components/ui/typography";
import {
    usePlanChangePending,
    usePlanEvent,
    useUnplanEvent,
} from "@/hooks/use-workshop";
import { formatEmissions } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { SEASON_LABELS, SEASONS } from "@/lib/workshop-timeline";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopEvents = ApiSchema<"WorkshopEventsOut">;
type WorkshopEvent = ApiSchema<"WorkshopEventOut">;
type RoundPlan = ApiSchema<"WorkshopRoundPlanOut">;
type PlannedEvent = ApiSchema<"PlannedEvent">;
type PlannedEventOut = ApiSchema<"WorkshopPlannedEventOut">;
type Severity = WorkshopEvent["severities"][number];
type Fuel = ApiSchema<"Fuel">;
type Season = (typeof SEASONS)[number];

/** A Round's event slots: the Round itself, then each season. */
type Slot = "round" | Season;

/**
 * The pools each slot holds at most one pick from: a category and the boundary
 * it fires at. Price shocks on facilities fire with a Round, those on fuel with
 * a Trading period.
 */
const POOLS: {
    category: WorkshopEvent["category"];
    boundary: WorkshopEvent["boundary_type"];
    title: string;
}[] = [
    {
        category: "price_shock_geopolitical",
        boundary: "round",
        title: "Price shocks on facilities",
    },
    { category: "demand_shift", boundary: "round", title: "Demand shifts" },
    { category: "climate", boundary: "trading_period", title: "Climate" },
    {
        category: "price_shock_geopolitical",
        boundary: "trading_period",
        title: "Price shocks on fuel",
    },
];

const STATUS_LABELS: Record<PlannedEventOut["status"], string> = {
    planned: "planned",
    fired: "fired",
    skipped: "skipped: a blackout ended the Round first",
};

const SEVERITY_LABELS: Record<Severity, string> = {
    base: "Pick",
    minor: "Minor",
    moderate: "Moderate",
    major: "Major",
    catastrophic: "Catastrophic",
};

const FUEL_NAMES: Record<Fuel, string> = {
    coal: "Coal",
    gas: "Gas",
    uranium: "Uranium",
};

const FUELS = Object.keys(FUEL_NAMES) as Fuel[];

function slotLabel(slot: Slot): string {
    return slot === "round" ? "Round-wide" : SEASON_LABELS[slot];
}

function slotSeason(slot: Slot): Season | null {
    return slot === "round" ? null : slot;
}

export function RoundEvents({
    events,
    plan,
}: {
    events: WorkshopEvents;
    plan: RoundPlan;
}) {
    const [slot, setSlot] = useState<Slot>("round");

    if (plan.round === 1) {
        return (
            <TypographyMuted>
                Round 1 holds no events: no Recap comes before it to set the
                scene.
            </TypographyMuted>
        );
    }
    if (plan.locked) return <LockedEvents plan={plan} />;

    const season = slotSeason(slot);
    const slots: Slot[] = ["round", ...SEASONS];
    const pickCount = (candidate: Slot) =>
        plan.events.filter((event) => event.season === slotSeason(candidate))
            .length;

    return (
        <div className="space-y-4">
            <SegmentedPicker
                value={slot}
                onValueChange={setSlot}
                className="flex h-auto w-full flex-wrap sm:w-fit"
            >
                {slots.map((candidate) => (
                    <SegmentedPickerOption key={candidate} value={candidate}>
                        {slotLabel(candidate)}
                        {pickCount(candidate) > 0 && (
                            <span className="text-xs text-muted-foreground">
                                ({pickCount(candidate)})
                            </span>
                        )}
                    </SegmentedPickerOption>
                ))}
            </SegmentedPicker>
            <TypographyMuted className="text-xs">
                {season
                    ? `These fire when Round ${plan.round}'s ${SEASON_LABELS[season].toLowerCase()} Trading period opens.`
                    : `These fire when Round ${plan.round}'s Investment phase opens.`}
            </TypographyMuted>
            {POOLS.filter(
                (pool) => (pool.boundary === "round") === (season === null),
            ).map((pool) => {
                const members = events.events.filter(
                    (event) =>
                        event.category === pool.category &&
                        event.boundary_type === pool.boundary,
                );
                const ids = new Set(members.map((event) => event.id));
                const pick = plan.events.find(
                    (planned) =>
                        ids.has(planned.event) && planned.season === season,
                );
                return (
                    <section
                        key={`${pool.category}:${pool.boundary}`}
                        className="space-y-2"
                    >
                        <div className="flex flex-wrap items-baseline gap-x-3">
                            <h4 className="text-sm font-semibold">
                                {pool.title}
                            </h4>
                            {pool.category === "climate" && (
                                <span className="text-xs text-muted-foreground">
                                    <Star
                                        className="mr-1 inline size-3 fill-current"
                                        aria-hidden
                                    />
                                    CO₂ so far:{" "}
                                    {formatEmissions(events.emissions)}
                                </span>
                            )}
                        </div>
                        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {members.map((event) => (
                                <EventTile
                                    key={event.id}
                                    event={event}
                                    round={plan.round}
                                    season={season}
                                    pick={
                                        pick?.event === event.id
                                            ? pick
                                            : undefined
                                    }
                                />
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}

/**
 * One event: a tile holding a choice per severity, or per fuel for an event
 * that moves a fuel the facilitator picks. An event with one severity is a
 * single choice.
 */
function EventTile({
    event,
    round,
    season,
    pick,
}: {
    event: WorkshopEvent;
    round: number;
    season: Season | null;
    pick: PlannedEventOut | undefined;
}) {
    const planEvent = usePlanEvent();
    const unplanEvent = useUnplanEvent();
    const busy = usePlanChangePending();

    // Clicking the current pick again drops it.
    const toggle = (next: PlannedEvent) =>
        pick?.severity === next.severity && pick.fuel === next.fuel
            ? unplanEvent.mutate({ round, eventId: event.id, season })
            : planEvent.mutate({ round, planned: next });

    const choices = event.fuel_chosen
        ? FUELS.map((fuel) => ({
              key: fuel,
              label: FUEL_NAMES[fuel],
              picked: pick?.fuel === fuel,
              suggested: false,
              planned: {
                  event: event.id,
                  severity: "base",
                  fuel,
                  season,
              } satisfies PlannedEvent,
          }))
        : event.severities.map((severity) => ({
              key: severity,
              label: SEVERITY_LABELS[severity],
              picked: pick?.severity === severity,
              suggested:
                  event.suggested_severity === severity &&
                  event.severities.length > 1,
              planned: {
                  event: event.id,
                  severity,
                  fuel: null,
                  season,
              } satisfies PlannedEvent,
          }));

    return (
        <li
            className={cn(
                "flex flex-col gap-2 rounded-lg border p-3",
                pick ? "border-primary bg-primary/5" : "border-border",
            )}
        >
            <span className="text-sm font-medium">
                {event.name}{" "}
                <span className="text-muted-foreground">
                    {event.direction === "negative" ? "▼" : "▲"}
                </span>
            </span>
            <span className="flex flex-wrap gap-1">
                {choices.map((choice) => (
                    <button
                        key={choice.key}
                        type="button"
                        aria-pressed={choice.picked}
                        disabled={busy}
                        onClick={() => toggle(choice.planned)}
                        title={
                            choice.suggested
                                ? "Suggested by the CO₂ emitted so far"
                                : choice.picked
                                  ? "Click again to drop it"
                                  : undefined
                        }
                        className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                            choice.picked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:bg-muted",
                        )}
                    >
                        {choice.picked && (
                            <Check className="size-3" aria-hidden />
                        )}
                        {choice.suggested && (
                            <Star
                                className="size-3 fill-current"
                                aria-label="suggested"
                            />
                        )}
                        {choice.label}
                    </button>
                ))}
            </span>
        </li>
    );
}

function LockedEvents({ plan }: { plan: RoundPlan }) {
    if (plan.events.length === 0) {
        return (
            <TypographyMuted>
                No events were planned for this Round.
            </TypographyMuted>
        );
    }
    return (
        <ul className="space-y-1 text-sm">
            {plan.events.map((event) => (
                <li
                    key={`${event.event}:${event.season}`}
                    className="flex flex-wrap items-center gap-x-2"
                >
                    <span className="text-muted-foreground">
                        {event.season
                            ? SEASON_LABELS[event.season]
                            : "Round-wide"}
                    </span>
                    <span>
                        {event.name}
                        {event.severity !== "base" &&
                            ` (${SEVERITY_LABELS[event.severity].toLowerCase()})`}
                        {event.fuel && ` on ${FUEL_NAMES[event.fuel]}`}
                    </span>
                    <span
                        className={cn(
                            "text-xs",
                            event.status === "fired"
                                ? "font-medium"
                                : "text-muted-foreground",
                        )}
                    >
                        {STATUS_LABELS[event.status]}
                    </span>
                </li>
            ))}
        </ul>
    );
}
