/**
 * The facilitator's bonus multipliers: one per team, which multiplies the
 * team's score, for example to reward a quiz held outside the game. Shown only
 * in a Run with teams. Every multiplier starts at 1, and while all are 1 the
 * players' scoreboard shows nothing about them. A change shows on every
 * scoreboard at once.
 */

import { useState } from "react";
import { toast } from "sonner";

import {
    useSetBonusMultipliers,
    useWorkshopScoreboard,
} from "@/hooks/use-workshop";
import { resolveErrorMessage } from "@/lib/game-messages";
import type { ApiSchema } from "@/types/api-helpers";
import { Button } from "@energetica/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@energetica/ui/components/card";
import { Input } from "@energetica/ui/components/input";
import { Money } from "@energetica/ui/components/money";
import { Spinner } from "@energetica/ui/components/spinner";
import { TypographyMuted } from "@energetica/ui/components/typography";

type TeamScore = ApiSchema<"TeamScore">;

/** The highest multiplier the server accepts. */
const MAX_MULTIPLIER = 2;

export function BonusMultipliersCard() {
    const scoreboard = useWorkshopScoreboard();
    // A Run without teams has nothing to multiply.
    if (scoreboard.data?.teams === null) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bonus multipliers</CardTitle>
                <TypographyMuted>
                    Multiply a team&apos;s score, for example to reward a quiz.
                    While every multiplier is 1, players see nothing about them.
                    Otherwise their team scoreboard shows a Bonus column.
                </TypographyMuted>
            </CardHeader>
            <CardContent>
                {scoreboard.isError ? (
                    <TypographyMuted>
                        The bonus multipliers could not be loaded.
                    </TypographyMuted>
                ) : scoreboard.data?.teams ? (
                    // Remounted when the multipliers change elsewhere, so the fields start from them.
                    <MultipliersForm
                        key={scoreboard.data.teams
                            .map(
                                (team) =>
                                    `${team.name}:${team.bonus_multiplier}`,
                            )
                            .join("|")}
                        teams={scoreboard.data.teams}
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

/** Whether `multiplier` is one the server accepts: above 0, at most 2. */
function isValidMultiplier(multiplier: number): boolean {
    return (
        Number.isFinite(multiplier) &&
        multiplier > 0 &&
        multiplier <= MAX_MULTIPLIER
    );
}

function MultipliersForm({ teams }: { teams: TeamScore[] }) {
    const { mutate: setMultipliers, isPending } = useSetBonusMultipliers();
    // Listed by name rather than by score, so a row stays put as scores change.
    const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    const [draft, setDraft] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            teams.map((team) => [team.name, `${team.bonus_multiplier}`]),
        ),
    );
    const multiplierOf = (team: TeamScore) => Number(draft[team.name]);
    const valid = teams.every((team) => isValidMultiplier(multiplierOf(team)));
    const changed = teams.filter(
        (team) => multiplierOf(team) !== team.bonus_multiplier,
    );

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                setMultipliers(
                    Object.fromEntries(
                        changed.map((team) => [team.name, multiplierOf(team)]),
                    ),
                    {
                        onSuccess: () =>
                            toast.success("Bonus multipliers saved."),
                        onError: (error) =>
                            toast.error(resolveErrorMessage(error)),
                    },
                );
            }}
        >
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-secondary">
                            <th className="py-2 px-4 text-left font-semibold">
                                Team
                            </th>
                            <th className="py-2 px-4 text-right font-semibold">
                                Score before bonus
                            </th>
                            <th className="py-2 px-4 text-right font-semibold">
                                Multiplier
                            </th>
                            <th className="py-2 px-4 text-right font-semibold">
                                Score
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((team) => {
                            const id = `bonus-${team.name}`;
                            const multiplier = multiplierOf(team);
                            const invalid = !isValidMultiplier(multiplier);
                            const base = team.score / team.bonus_multiplier;
                            return (
                                <tr
                                    key={team.name}
                                    className="border-b border-border/30"
                                >
                                    <td className="py-2 px-4 font-medium">
                                        <label htmlFor={id}>{team.name}</label>
                                    </td>
                                    <td className="py-2 px-4 text-right">
                                        <Money amount={base} />
                                    </td>
                                    <td className="py-2 px-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="text-muted-foreground">
                                                ×
                                            </span>
                                            <Input
                                                id={id}
                                                type="number"
                                                inputMode="decimal"
                                                min={0}
                                                max={MAX_MULTIPLIER}
                                                step="any"
                                                value={draft[team.name]}
                                                aria-invalid={invalid}
                                                onChange={(event) =>
                                                    setDraft({
                                                        ...draft,
                                                        [team.name]:
                                                            event.target.value,
                                                    })
                                                }
                                                className="w-20 text-right"
                                            />
                                        </div>
                                    </td>
                                    <td className="py-2 px-4 text-right font-semibold">
                                        {invalid ? (
                                            "—"
                                        ) : (
                                            <Money amount={base * multiplier} />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {!valid && (
                <p className="text-xs text-destructive">
                    Each multiplier must be above 0 and at most {MAX_MULTIPLIER}
                    .
                </p>
            )}
            <Button
                type="submit"
                size="sm"
                disabled={!valid || changed.length === 0 || isPending}
            >
                Save
            </Button>
        </form>
    );
}
