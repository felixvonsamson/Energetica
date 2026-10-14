/**
 * One Round's levers in the facilitator's console (#1018), in two groups:
 * Facility & Investment, and Fuel & Market. Each lever is a card with a
 * segmented picker whose options run from the simplest game to the most
 * complex, left to right. A change also applies to every later Round, and a
 * note says which Rounds it carried to. A change that would leave a later Round
 * invalid is refused, and the toast names that Round. A locked Round's levers
 * are shown but cannot change.
 */

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { TypographyMuted } from "@/components/ui/typography";
import { useChangeLevers, usePlanChangePending } from "@/hooks/use-workshop";
import { carriedNote, carriedRounds } from "@/lib/workshop-console";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopPlans = ApiSchema<"WorkshopPlansOut">;
type RoundPlan = ApiSchema<"WorkshopRoundPlanOut">;
type LeverChanges = ApiSchema<"LeverChanges">;
type Lever = Exclude<keyof LeverChanges, "carbon_tax_vote">;

interface LeverOption {
    value: string;
    label: string;
    /** Why the option cannot be picked in this Round, if it cannot. */
    unavailable?: string;
}

interface LeverDefinition {
    lever: Lever;
    title: string;
    description: string;
    value: (plan: RoundPlan) => string;
    options: (plan: RoundPlan) => LeverOption[];
    changes: (value: string) => LeverChanges;
}

const TRADING_FORMAT: LeverDefinition = {
    lever: "trading_format",
    title: "Trading format",
    description:
        "How each Trading period is simulated: one week that stands for the season, or every day of it.",
    value: (plan) => plan.levers.round_format.trading_format,
    options: (plan) => [
        {
            value: "representative_week",
            label: "Representative week",
            unavailable:
                plan.levers.round_format.storage === "all"
                    ? "Every storage type needs the full season."
                    : undefined,
        },
        { value: "full_season", label: "Full season" },
    ],
    changes: (value) => ({
        trading_format: value as LeverChanges["trading_format"],
    }),
};

const CLEARINGS_PER_DAY: LeverDefinition = {
    lever: "clearings_per_day",
    title: "Clearings per day",
    description:
        "How often the market clears in a simulated day: every hour, every 15 minutes or every 5 minutes.",
    value: (plan) => `${plan.levers.round_format.clearings_per_day}`,
    options: () => [
        { value: "24", label: "24" },
        { value: "96", label: "96" },
        { value: "288", label: "288" },
    ],
    changes: (value) => ({
        clearings_per_day: Number(value) as LeverChanges["clearings_per_day"],
    }),
};

const STORAGE: LeverDefinition = {
    lever: "storage",
    title: "Storage",
    description: "Which storage players can buy.",
    value: (plan) => plan.levers.round_format.storage,
    options: (plan) => [
        { value: "off", label: "None" },
        { value: "batteries", label: "Batteries" },
        {
            value: "all",
            label: "Every type",
            unavailable:
                plan.levers.round_format.trading_format !== "full_season"
                    ? "Needs the full-season trading format."
                    : undefined,
        },
    ],
    changes: (value) => ({ storage: value as LeverChanges["storage"] }),
};

const FUEL_PROCUREMENT: LeverDefinition = {
    lever: "fuel_procurement",
    title: "Fuel",
    description:
        "Whether players are billed for the fuel they burn, or buy it themselves in each price-setting window.",
    value: (plan) => plan.levers.fuel_procurement,
    options: () => [
        { value: "automatic", label: "Billed" },
        { value: "manual", label: "Bought by players" },
    ],
    changes: (value) => ({
        fuel_procurement: value as LeverChanges["fuel_procurement"],
    }),
};

const GROUPS: { title: string; levers: LeverDefinition[] }[] = [
    { title: "Facility & Investment", levers: [STORAGE] },
    {
        title: "Fuel & Market",
        levers: [TRADING_FORMAT, CLEARINGS_PER_DAY, FUEL_PROCUREMENT],
    },
];

/** The note left by the last change, under the lever it changed. */
interface CarriedNote {
    lever: Lever;
    text: string;
}

export function RoundLevers({
    plans,
    plan,
}: {
    plans: WorkshopPlans;
    plan: RoundPlan;
}) {
    const { mutate: changeLevers } = useChangeLevers();
    const pending = usePlanChangePending();
    const [note, setNote] = useState<CarriedNote | null>(null);

    const change = (definition: LeverDefinition, value: string) => {
        setNote(null);
        changeLevers(
            { round: plan.round, changes: definition.changes(value) },
            {
                onSuccess: (after) => {
                    const text = carriedNote(
                        carriedRounds(plans, after, plan.round),
                    );
                    if (text) setNote({ lever: definition.lever, text });
                },
            },
        );
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {GROUPS.map((group) => (
                <section key={group.title} className="space-y-3">
                    <h3 className="font-semibold">{group.title}</h3>
                    {group.levers.map((definition) => (
                        <LeverCard
                            key={definition.lever}
                            definition={definition}
                            plan={plan}
                            disabled={plan.locked || pending}
                            note={
                                note?.lever === definition.lever
                                    ? note.text
                                    : null
                            }
                            onChange={(value) => change(definition, value)}
                        />
                    ))}
                </section>
            ))}
        </div>
    );
}

function LeverCard({
    definition,
    plan,
    disabled,
    note,
    onChange,
}: {
    definition: LeverDefinition;
    plan: RoundPlan;
    disabled: boolean;
    note: string | null;
    onChange: (value: string) => void;
}) {
    const value = definition.value(plan);
    const options = definition.options(plan);
    const unavailable = options
        .filter((option) => option.unavailable)
        .map((option) => `${option.label}: ${option.unavailable}`);

    return (
        <Card className="gap-3 py-4">
            <CardHeader className="px-4">
                <CardTitle className="text-base">{definition.title}</CardTitle>
                <TypographyMuted className="text-xs">
                    {definition.description}
                </TypographyMuted>
            </CardHeader>
            <CardContent className="space-y-2 px-4">
                <SegmentedPicker
                    value={value}
                    activationMode="manual"
                    onValueChange={(next) => {
                        if (next !== value) onChange(next);
                    }}
                    className="flex h-auto w-full flex-wrap"
                >
                    {options.map((option) => (
                        <SegmentedPickerOption
                            key={option.value}
                            value={option.value}
                            disabled={disabled || !!option.unavailable}
                            className="flex-1"
                        >
                            {option.label}
                        </SegmentedPickerOption>
                    ))}
                </SegmentedPicker>
                {!plan.locked &&
                    unavailable.map((reason) => (
                        <p
                            key={reason}
                            className="text-xs text-muted-foreground"
                        >
                            {reason}
                        </p>
                    ))}
                {note && (
                    <p className="text-xs font-medium" role="status">
                        {note}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
