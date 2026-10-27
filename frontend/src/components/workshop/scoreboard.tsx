/**
 * The scoreboard (#1017, #1222): every player ranked by score. It is open all
 * game (#1250) and counts the Rounds completed so far, so it changes as each
 * Recap opens, and the page follows without a reload because the scores are
 * cached under the session. Once the session is over, the scores are final. The
 * title says which Round the scores count up to, from the same response as the
 * scores.
 *
 * Each row shows what the score adds up from: operating profit, minus what the
 * player paid for facilities and any loan (#1225) and in carbon tax, plus the
 * residual value of the facilities still owned. The two costs are shown as
 * negative amounts, so the four columns add up to the score. Everyone in the
 * Run sees the same table, and a player's own row is highlighted. A panel below
 * the table spells out the formula and each of its terms.
 *
 * In a Run with teams (#1384), a table of teams comes first, each scoring the
 * sum of its members' scores, and the players' table gets a Team column. Once
 * the facilitator gives any team a bonus multiplier other than 1, such as for a
 * quiz, the teams' table gets a Bonus column and each team's score is the sum
 * times its multiplier. Until then, nothing about multipliers is shown.
 */

import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

import { useWorkshopEntry, useWorkshopScoreboard } from "@/hooks/use-workshop";
import type { ApiSchema } from "@/types/api-helpers";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@energetica/ui/components/card";
import { Money } from "@energetica/ui/components/money";
import { Spinner } from "@energetica/ui/components/spinner";
import {
    TypographyH1,
    TypographyMuted,
} from "@energetica/ui/components/typography";
import { cn } from "@energetica/ui/lib/utils";

const COLUMNS = [
    { key: "operating_profit", label: "Operating profit", sign: 1 },
    { key: "investments", label: "Investments", sign: -1 },
    { key: "carbon_tax", label: "Carbon tax", sign: -1 },
    { key: "residual_value", label: "Residual value", sign: 1 },
] as const;

export function Scoreboard() {
    const scoreboard = useWorkshopScoreboard();
    const { data: entry } = useWorkshopEntry();
    const me = entry?.player?.account_id;

    if (scoreboard.isError) {
        return (
            <TypographyMuted>
                The scoreboard could not be loaded.
            </TypographyMuted>
        );
    }
    if (scoreboard.isPending)
        return (
            <div className="flex justify-center py-12">
                <Spinner />
            </div>
        );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <TypographyH1 className="flex items-center gap-3">
                    <Trophy className="size-8 text-brand" />
                    {scoresTitle(scoreboard.data)}
                </TypographyH1>
                {scoreboard.data.final ? null : (
                    <TypographyMuted>
                        The scores count every Round completed so far, and
                        change as each Round&apos;s Recap opens.
                    </TypographyMuted>
                )}
            </div>
            {scoreboard.data.teams && (
                <TeamTable
                    teams={scoreboard.data.teams}
                    scores={scoreboard.data.scores}
                    me={me}
                />
            )}
            <PlayerTable
                scores={scoreboard.data.scores}
                hasTeams={scoreboard.data.teams !== null}
                me={me}
            />
            <ScoreFormula
                bonus={
                    scoreboard.data.teams !== null &&
                    hasBonus(scoreboard.data.teams)
                }
            />
        </div>
    );
}

type Score = ApiSchema<"Score">;
type TeamScore = ApiSchema<"TeamScore">;

/** Whether any team's score is multiplied by something other than 1. */
function hasBonus(teams: TeamScore[]): boolean {
    return teams.some((team) => team.bonus_multiplier !== 1);
}

/** Every team ranked by the sum of its members' scores (#1384). */
function TeamTable({
    teams,
    scores,
    me,
}: {
    teams: TeamScore[];
    scores: Score[];
    me: number | undefined;
}) {
    const usernames = new Map(
        scores.map((row) => [row.account_id, row.username]),
    );
    const bonus = hasBonus(teams);
    return (
        <ScoreTable label="Team" bonusColumn={bonus}>
            {teams.map((team, index) => {
                const mine = me !== undefined && team.account_ids.includes(me);
                return (
                    <tr
                        key={team.name}
                        className={cn(
                            "border-b border-border/30",
                            mine && "bg-brand/10",
                        )}
                    >
                        <td className="py-2 px-4 text-right font-mono">
                            {index + 1}
                        </td>
                        <td className="py-2 px-4">
                            <div className="font-medium">
                                {team.name}
                                {mine && (
                                    <span className="text-muted-foreground">
                                        {" "}
                                        (your team)
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {team.account_ids
                                    .map((id) => usernames.get(id))
                                    .join(", ")}
                            </div>
                        </td>
                        <ScoreCells
                            row={team}
                            bonusMultiplier={
                                bonus ? team.bonus_multiplier : undefined
                            }
                        />
                    </tr>
                );
            })}
        </ScoreTable>
    );
}

/** Every player ranked by score, with a Team column in a Run with teams. */
function PlayerTable({
    scores,
    hasTeams,
    me,
}: {
    scores: Score[];
    hasTeams: boolean;
    me: number | undefined;
}) {
    return (
        <ScoreTable label="Player" teamColumn={hasTeams}>
            {scores.map((row, index) => (
                <tr
                    key={row.account_id}
                    className={cn(
                        "border-b border-border/30",
                        row.account_id === me && "bg-brand/10",
                    )}
                >
                    <td className="py-2 px-4 text-right font-mono">
                        {index + 1}
                    </td>
                    <td className="py-2 px-4 font-medium">
                        {row.username}
                        {row.account_id === me && (
                            <span className="text-muted-foreground">
                                {" "}
                                (you)
                            </span>
                        )}
                    </td>
                    {hasTeams && (
                        <td className="py-2 px-4 text-muted-foreground">
                            {row.team}
                        </td>
                    )}
                    <ScoreCells row={row} />
                </tr>
            ))}
        </ScoreTable>
    );
}

/**
 * A ranking table's frame and header: rank, the ranked name, the four parts,
 * the bonus multiplier if shown, and the score.
 */
function ScoreTable({
    label,
    teamColumn = false,
    bonusColumn = false,
    children,
}: {
    label: string;
    teamColumn?: boolean;
    bonusColumn?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-secondary">
                        <th className="py-2 px-4 text-right font-semibold">
                            Rank
                        </th>
                        <th className="py-2 px-4 text-left font-semibold">
                            {label}
                        </th>
                        {teamColumn && (
                            <th className="py-2 px-4 text-left font-semibold">
                                Team
                            </th>
                        )}
                        {COLUMNS.map((column) => (
                            <th
                                key={column.key}
                                className="py-2 px-4 text-right font-semibold"
                            >
                                {column.label}
                            </th>
                        ))}
                        {bonusColumn && (
                            <th className="py-2 px-4 text-right font-semibold">
                                Bonus
                            </th>
                        )}
                        <th className="py-2 px-4 text-right font-bold tracking-wide">
                            SCORE
                        </th>
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

/**
 * The four parts of a score, the two costs as negative amounts, then the bonus
 * multiplier if given, then the score.
 */
function ScoreCells({
    row,
    bonusMultiplier,
}: {
    row: Score | TeamScore;
    bonusMultiplier?: number;
}) {
    return (
        <>
            {COLUMNS.map((column) => (
                <td key={column.key} className="py-2 px-4 text-right">
                    <Money amount={column.sign * row[column.key]} />
                </td>
            ))}
            {bonusMultiplier !== undefined && (
                <td className="py-2 px-4 text-right font-mono">
                    ×{bonusMultiplier}
                </td>
            )}
            <td className="py-2 px-4 text-right font-semibold">
                <Money amount={row.score} />
            </td>
        </>
    );
}

function scoresTitle(scoreboard: ApiSchema<"Scoreboard">): string {
    if (scoreboard.final) return "Final scores";
    if (scoreboard.completed_rounds === 0) return "Scores";
    return `Scores after Round ${scoreboard.completed_rounds}`;
}

const TERMS = [
    {
        term: "Operating profit",
        explanation:
            "What your facilities earned on the market in the completed Rounds, less what they cost to run, their fuel and any revenue tax.",
    },
    {
        term: "Investments",
        explanation:
            "What you paid for every facility you bought, plus what the loan cost if you took it: the payments less the money it brought in.",
    },
    {
        term: "Carbon tax",
        explanation:
            "The carbon tax you paid on your emissions and on building, less the share of the tax that was paid back to you.",
    },
    {
        term: "Residual value",
        explanation:
            "What the facilities you still own are worth: each one's price times the share of its lifetime it has left after the last completed Round. A facility still being built is worth its full price.",
    },
] as const;

function ScoreFormula({ bonus }: { bonus: boolean }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>How the score adds up</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <p className="text-center font-mono text-base md:text-lg">
                    Score = Operating profit − Investments − Carbon tax +
                    Residual value
                </p>
                <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-[max-content_1fr]">
                    {TERMS.map(({ term, explanation }) => (
                        <div key={term} className="contents">
                            <dt className="font-semibold">{term}</dt>
                            <dd className="text-muted-foreground">
                                {explanation}
                            </dd>
                        </div>
                    ))}
                </dl>
                {bonus && (
                    <TypographyMuted>
                        A team&apos;s score is the sum of its members&apos;
                        scores, times the team&apos;s bonus multiplier.
                    </TypographyMuted>
                )}
                <TypographyMuted>
                    Cash is not part of the score: it already moves with the
                    terms above, so counting it would count them twice.
                </TypographyMuted>
            </CardContent>
        </Card>
    );
}
