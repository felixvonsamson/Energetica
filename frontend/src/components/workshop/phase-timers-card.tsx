/**
 * The facilitator's phase timers (#996, #1018): how long the Investment phase
 * and each price-setting window are open when they start. They belong to the
 * whole session, not to a Round, and a change applies to the next phase that
 * opens. The countdown in the top bar only gives the running phase more time.
 */

import { useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TypographyMuted } from "@/components/ui/typography";
import { useSetTimers, useWorkshopTimers } from "@/hooks/use-workshop";
import { resolveErrorMessage } from "@/lib/game-messages";
import type { ApiSchema } from "@/types/api-helpers";

type PhaseTimers = ApiSchema<"PhaseTimers">;

const FIELDS: { key: keyof PhaseTimers; label: string }[] = [
    { key: "investment_minutes", label: "Investment phase" },
    { key: "price_setting_minutes", label: "Price-setting window" },
];

export function PhaseTimersCard() {
    const { data: timers, isError } = useWorkshopTimers();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Phase timers</CardTitle>
                <TypographyMuted>
                    How long each phase is open when it starts. A change applies
                    from the next phase that opens.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                {isError ? (
                    <TypographyMuted>
                        The phase timers could not be loaded.
                    </TypographyMuted>
                ) : timers ? (
                    // Remounted when the timers change elsewhere, so the fields start from them.
                    <TimersForm
                        key={`${timers.investment_minutes}:${timers.price_setting_minutes}`}
                        timers={timers}
                    />
                ) : (
                    <div className="flex justify-center py-6">
                        <Spinner />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/** Whether `minutes` is a timer the server accepts: a whole number, at least 1. */
function isValidTimer(minutes: number): boolean {
    return Number.isInteger(minutes) && minutes >= 1;
}

function TimersForm({ timers }: { timers: PhaseTimers }) {
    const { mutate: setTimers, isPending } = useSetTimers();
    const [draft, setDraft] = useState(
        () =>
            Object.fromEntries(
                FIELDS.map(({ key }) => [key, `${timers[key]}`]),
            ) as Record<keyof PhaseTimers, string>,
    );
    const parsed = Object.fromEntries(
        FIELDS.map(({ key }) => [key, Number(draft[key])]),
    ) as PhaseTimers;
    const valid = FIELDS.every(({ key }) => isValidTimer(parsed[key]));
    const changed = FIELDS.some(({ key }) => parsed[key] !== timers[key]);

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                setTimers(parsed, {
                    onSuccess: () => toast.success("Phase timers saved."),
                    onError: (error) => toast.error(resolveErrorMessage(error)),
                });
            }}
        >
            {FIELDS.map((field) => {
                const id = `timer-${field.key}`;
                const invalid = !isValidTimer(parsed[field.key]);
                return (
                    <div key={field.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor={id}>{field.label}</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id={id}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    step={1}
                                    value={draft[field.key]}
                                    aria-invalid={invalid}
                                    aria-describedby={
                                        invalid ? `${id}-error` : undefined
                                    }
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            [field.key]: event.target.value,
                                        })
                                    }
                                    className="w-20 text-right"
                                />
                                <span className="text-sm text-muted-foreground">
                                    min
                                </span>
                            </div>
                        </div>
                        {invalid && (
                            <p
                                id={`${id}-error`}
                                className="text-right text-xs text-destructive"
                            >
                                A whole number of minutes, at least 1.
                            </p>
                        )}
                    </div>
                );
            })}
            <Button
                type="submit"
                size="sm"
                disabled={!valid || !changed || isPending}
            >
                Save
            </Button>
        </form>
    );
}
