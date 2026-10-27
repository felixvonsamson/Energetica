/**
 * A player's username, with their team next to it in a Workshop Run with teams
 * (#1384). Pages that name a player use this, or {@link playerLabel} where only
 * text fits, such as a chart label, so the team shows the same way everywhere.
 * The scoreboard is the exception: its players' table has a Team column.
 */

/** A player's name as plain text: `username · team`, or the username alone. */
export function playerLabel(username: string, team: string | null): string {
    return team === null ? username : `${username} · ${team}`;
}

export function PlayerName({
    username,
    team,
}: {
    username: string;
    team: string | null;
}) {
    return (
        <>
            {username}
            {team !== null && (
                <span className="font-normal text-muted-foreground">
                    {" "}
                    · {team}
                </span>
            )}
        </>
    );
}
