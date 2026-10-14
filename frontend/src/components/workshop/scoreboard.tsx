/**
 * The scoreboard (#1017): every player ranked by final score, once the session
 * is over. Each row shows what the score adds up from: operating profit over
 * the whole session, the cash held at the end, and the residual value of the
 * facilities still owned. Everyone in the Run sees the same table, and a
 * player's own row is highlighted.
 */

import { Trophy } from "lucide-react";

import { Money } from "@/components/ui/money";
import { Spinner } from "@/components/ui/spinner";
import { TypographyH1, TypographyMuted } from "@/components/ui/typography";
import { useWorkshopEntry, useWorkshopScoreboard } from "@/hooks/use-workshop";
import { ApiClientError, isGameError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const COLUMNS = [
    { key: "operating_profit", label: "Operating profit" },
    { key: "cash", label: "Final cash" },
    { key: "residual_value", label: "Residual value" },
] as const;

export function Scoreboard() {
    const scoreboard = useWorkshopScoreboard();
    const { data: entry } = useWorkshopEntry();
    const me = entry?.player?.account_id;

    if (scoreboard.isError) {
        const error =
            scoreboard.error instanceof ApiClientError
                ? scoreboard.error
                : null;
        const notFinished =
            isGameError(error?.detail) &&
            error.detail.game_exception_type ===
                "WORKSHOP_SESSION_NOT_FINISHED";
        return (
            <TypographyMuted>
                {notFinished
                    ? "The scoreboard opens once the session is over."
                    : "The scoreboard could not be loaded."}
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
                    Final scores
                </TypographyH1>
                <TypographyMuted>
                    Score = operating profit + final cash + residual value. A
                    facility&apos;s residual value is its price times the share
                    of its lifetime it has left.
                </TypographyMuted>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-secondary">
                            <th className="py-2 px-4 text-right font-semibold">
                                Rank
                            </th>
                            <th className="py-2 px-4 text-left font-semibold">
                                Player
                            </th>
                            {COLUMNS.map((column) => (
                                <th
                                    key={column.key}
                                    className="py-2 px-4 text-right font-semibold"
                                >
                                    {column.label}
                                </th>
                            ))}
                            <th className="py-2 px-4 text-right font-bold tracking-wide">
                                SCORE
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {scoreboard.data.map((row, index) => (
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
                                {COLUMNS.map((column) => (
                                    <td
                                        key={column.key}
                                        className="py-2 px-4 text-right"
                                    >
                                        <Money amount={row[column.key]} />
                                    </td>
                                ))}
                                <td className="py-2 px-4 text-right font-semibold">
                                    <Money amount={row.score} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
