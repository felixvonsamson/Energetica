/**
 * The facilitator's events (#1012): pick a vignette and its severity for each
 * category, and see what fired. A pick waits for the next boundary of its kind,
 * the next Trading period or the next Round, and can be changed or dropped
 * until then. The facilitator never sees a headline, so the Recap surprises
 * them too. A star marks the severity the session's CO₂ suggests for a climate
 * event. #1018 turns this into the console's tile grid.
 */

import { Check, Star } from "lucide-react";

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
    useDropEvent,
    useEventChangePending,
    usePickEvent,
    useWorkshopEvents,
} from "@/hooks/use-workshop";
import { formatEmissions } from "@/lib/format-utils";
import { SEASON_LABELS } from "@/lib/workshop-timeline";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopEvents = ApiSchema<"WorkshopEventsOut">;
type WorkshopEvent = ApiSchema<"WorkshopEventOut">;
type EventPick = ApiSchema<"EventPick">;
type Severity = WorkshopEvent["severities"][number];
type Fuel = ApiSchema<"Fuel">;

/**
 * The picks each group holds at most one of: a category and the boundary it
 * fires at. Price shocks on facilities wait for a Round, those on fuel for a
 * Trading period.
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

const FIRES_AT: Record<WorkshopEvent["boundary_type"], string> = {
    trading_period: "Fires when the next Trading period opens.",
    round: "Fires when the next Round's Investment phase opens.",
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
    const { data: events, isError } = useWorkshopEvents();

    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>Events</CardTitle>
                <TypographyMuted>
                    Pick at most one event per group. It fires at the next
                    boundary shown, and you can change or drop it until then.
                    Players read its headline at the Recap, and so do you.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                {isError ? (
                    <TypographyMuted>
                        The events could not be loaded.
                    </TypographyMuted>
                ) : events ? (
                    <EventGroups events={events} />
                ) : (
                    <div className="flex justify-center py-12">
                        <Spinner />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function EventGroups({ events }: { events: WorkshopEvents }) {
    const names = new Map(events.events.map((event) => [event.id, event]));

    return (
        <div className="space-y-6">
            {GROUPS.map((group) => {
                const members = events.events.filter(
                    (event) =>
                        event.category === group.category &&
                        event.boundary_type === group.boundary,
                );
                const pick = events.picks.find((p) => {
                    const event = names.get(p.event);
                    return (
                        event?.category === group.category &&
                        event.boundary_type === group.boundary
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
                                {FIRES_AT[group.boundary]}
                                {group.category === "climate" &&
                                    ` CO₂ so far: ${formatEmissions(events.emissions)}.`}
                            </p>
                        </div>
                        <ul className="divide-y divide-border">
                            {members.map((event) => (
                                <EventRow
                                    key={event.id}
                                    event={event}
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
            <FiredEvents events={events} />
        </div>
    );
}

function EventRow({
    event,
    pick,
}: {
    event: WorkshopEvent;
    pick: EventPick | undefined;
}) {
    const pickEvent = usePickEvent();
    const dropEvent = useDropEvent();
    const busy = useEventChangePending();

    // Clicking the current pick again drops it.
    const toggle = (next: EventPick) =>
        pick?.severity === next.severity && pick.fuel === next.fuel
            ? dropEvent.mutate(event.id)
            : pickEvent.mutate(next);

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

function FiredEvents({ events }: { events: WorkshopEvents }) {
    if (events.fired.length === 0) return null;
    return (
        <section className="space-y-2 border-t border-border pt-4">
            <h3 className="font-semibold">Fired so far</h3>
            <ul className="space-y-1 text-sm">
                {events.fired.map((fired) => (
                    <li
                        key={`${fired.event}:${fired.round}:${fired.season}`}
                        className="flex items-center gap-2"
                    >
                        <span className="text-muted-foreground">
                            Round {fired.round}
                            {fired.season
                                ? ` · ${SEASON_LABELS[fired.season]}`
                                : ""}
                        </span>
                        <span>
                            {fired.name}
                            {fired.severity !== "base" &&
                                ` (${SEVERITY_LABELS[fired.severity].toLowerCase()})`}
                            {fired.fuel && ` on ${FUEL_NAMES[fired.fuel]}`}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
