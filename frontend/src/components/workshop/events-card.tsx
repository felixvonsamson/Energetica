/**
 * The facilitator's events (#1012, #1190): plan a vignette and its severity for
 * each category of a Round, and see what became of each planned event. A Round
 * event fires when the Round's Investment phase opens, and a seasonal event
 * when its season's Trading period opens. Events can be planned for any Round
 * after the first whose plan is not locked yet. The facilitator never sees a
 * headline, so the Recap surprises them too. A star marks the severity the
 * session's CO₂ suggests for a climate event. #1018 turns this into the
 * console's tile grid, with a tab per Round.
 */

import { Check, Star } from "lucide-react";
import { useState } from "react";

import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui";
import { Spinner } from "@/components/ui/spinner";
import { TypographyMuted } from "@/components/ui/typography";
import {
    usePlanChangePending,
    usePlanEvent,
    useUnplanEvent,
    useWorkshopEvents,
    useWorkshopPlans,
} from "@/hooks/use-workshop";
import { formatEmissions } from "@/lib/format-utils";
import { SEASON_LABELS, SEASONS } from "@/lib/workshop-timeline";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopEvents = ApiSchema<"WorkshopEventsOut">;
type WorkshopEvent = ApiSchema<"WorkshopEventOut">;
type WorkshopPlans = ApiSchema<"WorkshopPlansOut">;
type PlannedEvent = ApiSchema<"PlannedEvent">;
type PlannedEventOut = ApiSchema<"WorkshopPlannedEventOut">;
type Severity = WorkshopEvent["severities"][number];
type Fuel = ApiSchema<"Fuel">;
type Season = (typeof SEASONS)[number];

/**
 * The events each group holds at most one of per boundary: a category and the
 * boundary it fires at. Price shocks on facilities fire with a Round, those on
 * fuel with a Trading period.
 */
const GROUPS: {
    category: WorkshopEvent["category"];
    boundary: WorkshopEvent["boundary_type"];
    title: string;
}[] = [
    { category: "climate", boundary: "trading_period", title: "Climate" },
    {
        category: "price_shock_geopolitical",
        boundary: "round",
        title: "Price shocks on facilities",
    },
    {
        category: "price_shock_geopolitical",
        boundary: "trading_period",
        title: "Price shocks on fuel",
    },
    { category: "demand_shift", boundary: "round", title: "Demand shifts" },
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

export function EventsCard() {
    const events = useWorkshopEvents();
    const plans = useWorkshopPlans();
    const isError = events.isError || plans.isError;

    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>Events</CardTitle>
                <TypographyMuted>
                    Plan at most one event per group for each Round, and for a
                    seasonal group, for each season. You can change a Round's
                    events until the Recap before it locks them. Players read
                    each headline at the Recap, and so do you.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                {isError ? (
                    <TypographyMuted>
                        The events could not be loaded.
                    </TypographyMuted>
                ) : events.data && plans.data ? (
                    <EventPlanner events={events.data} plans={plans.data} />
                ) : (
                    <div className="flex justify-center py-12">
                        <Spinner />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function EventPlanner({
    events,
    plans,
}: {
    events: WorkshopEvents;
    plans: WorkshopPlans;
}) {
    // Round 1 holds no events.
    const open = plans.rounds
        .filter((plan) => plan.round > 1 && !plan.locked)
        .map((plan) => plan.round);
    const [chosenRound, setChosenRound] = useState<number | null>(null);
    const [season, setSeason] = useState<Season>(SEASONS[0]);
    // A Round chosen earlier may have locked since.
    const round =
        chosenRound !== null && open.includes(chosenRound)
            ? chosenRound
            : open[0];

    return (
        <div className="space-y-6">
            {round === undefined ? (
                <TypographyMuted>
                    Every Round that can hold events is locked.
                </TypographyMuted>
            ) : (
                <>
                    <div className="space-y-2">
                        <Choices
                            label="Round"
                            options={open.map((value) => ({
                                value,
                                label: `${value}`,
                            }))}
                            value={round}
                            onChange={setChosenRound}
                        />
                        <Choices
                            label="Season"
                            options={SEASONS.map((value) => ({
                                value,
                                label: SEASON_LABELS[value],
                            }))}
                            value={season}
                            onChange={setSeason}
                        />
                    </div>
                    <EventGroups
                        events={events}
                        planned={plans.rounds[round - 1]?.events ?? []}
                        round={round}
                        season={season}
                    />
                </>
            )}
            <PlannedEvents plans={plans} />
        </div>
    );
}

function Choices<T extends string | number>({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1">
            <span className="w-16 text-sm text-muted-foreground">{label}</span>
            {options.map((option) => (
                <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={option.value === value ? "default" : "outline"}
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                    className="h-7 px-2 text-xs"
                >
                    {option.label}
                </Button>
            ))}
        </div>
    );
}

function EventGroups({
    events,
    planned,
    round,
    season,
}: {
    events: WorkshopEvents;
    planned: PlannedEventOut[];
    round: number;
    season: Season;
}) {
    const names = new Map(events.events.map((event) => [event.id, event]));

    return (
        <div className="space-y-6">
            {GROUPS.map((group) => {
                const groupSeason =
                    group.boundary === "trading_period" ? season : null;
                const members = events.events.filter(
                    (event) =>
                        event.category === group.category &&
                        event.boundary_type === group.boundary,
                );
                const pick = planned.find((p) => {
                    const event = names.get(p.event);
                    return (
                        event?.category === group.category &&
                        event.boundary_type === group.boundary &&
                        p.season === groupSeason
                    );
                });
                return (
                    <section
                        key={`${group.category}:${group.boundary}`}
                        className="space-y-2"
                    >
                        <div>
                            <h3 className="font-semibold">{group.title}</h3>
                            <p className="text-xs text-muted-foreground">
                                {groupSeason
                                    ? `Fires when Round ${round}'s ${SEASON_LABELS[groupSeason].toLowerCase()} Trading period opens.`
                                    : `Fires when Round ${round}'s Investment phase opens.`}
                                {group.category === "climate" &&
                                    ` CO₂ so far: ${formatEmissions(events.emissions)}.`}
                            </p>
                        </div>
                        <ul className="divide-y divide-border">
                            {members.map((event) => (
                                <EventRow
                                    key={event.id}
                                    event={event}
                                    round={round}
                                    season={groupSeason}
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

function EventRow({
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

    return (
        <li className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm">
                {event.name}{" "}
                <span className="text-muted-foreground">
                    {event.direction === "negative" ? "▼" : "▲"}
                </span>
            </span>
            <span className="flex flex-wrap gap-1">
                {event.fuel_chosen
                    ? FUELS.map((fuel) => (
                          <ChoiceButton
                              key={fuel}
                              label={FUEL_NAMES[fuel]}
                              picked={pick?.fuel === fuel}
                              suggested={false}
                              disabled={busy}
                              onClick={() =>
                                  toggle({
                                      event: event.id,
                                      severity: "base",
                                      fuel,
                                      season,
                                  })
                              }
                          />
                      ))
                    : event.severities.map((severity) => (
                          <ChoiceButton
                              key={severity}
                              label={SEVERITY_LABELS[severity]}
                              picked={pick?.severity === severity}
                              suggested={
                                  event.suggested_severity === severity &&
                                  event.severities.length > 1
                              }
                              disabled={busy}
                              onClick={() =>
                                  toggle({
                                      event: event.id,
                                      severity,
                                      fuel: null,
                                      season,
                                  })
                              }
                          />
                      ))}
            </span>
        </li>
    );
}

function ChoiceButton({
    label,
    picked,
    suggested,
    disabled,
    onClick,
}: {
    label: string;
    picked: boolean;
    suggested: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            size="sm"
            variant={picked ? "default" : "outline"}
            aria-pressed={picked}
            disabled={disabled}
            onClick={onClick}
            title={
                suggested
                    ? "Suggested by the CO₂ emitted so far"
                    : picked
                      ? "Click again to drop it"
                      : undefined
            }
            className="h-7 px-2 text-xs"
        >
            {picked && <Check className="size-3" />}
            {suggested && (
                <Star className="size-3 fill-current" aria-label="suggested" />
            )}
            {label}
        </Button>
    );
}

function PlannedEvents({ plans }: { plans: WorkshopPlans }) {
    const planned = plans.rounds.flatMap((plan) =>
        plan.events.map((event) => ({ round: plan.round, event })),
    );
    if (planned.length === 0) return null;
    return (
        <section className="space-y-2 border-t border-border pt-4">
            <h3 className="font-semibold">Planned so far</h3>
            <ul className="space-y-1 text-sm">
                {planned.map(({ round, event }) => (
                    <li
                        key={`${round}:${event.event}:${event.season}`}
                        className="flex flex-wrap items-center gap-x-2"
                    >
                        <span className="text-muted-foreground">
                            Round {round}
                            {event.season
                                ? ` · ${SEASON_LABELS[event.season]}`
                                : ""}
                        </span>
                        <span>
                            {event.name}
                            {event.severity !== "base" &&
                                ` (${SEVERITY_LABELS[event.severity].toLowerCase()})`}
                            {event.fuel && ` on ${FUEL_NAMES[event.fuel]}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {STATUS_LABELS[event.status]}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
