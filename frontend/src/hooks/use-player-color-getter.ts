import { useEffect, useMemo, useState } from "react";

import { useMyId, usePlayerMap } from "@/hooks/use-players";
import { resolveCSSVar } from "@/lib/charts/color-utils";
import { playerColorGetter } from "@/lib/charts/player-colors";
import { useTheme } from "@energetica/ui/contexts/theme-context";

/** A stable empty list, so a caller without teammates keeps the getter stable. */
const NO_TEAMMATES: readonly number[] = [];

/**
 * Hook that returns each player's theme-aware chart color: the current player
 * in `--chart-self`, their teammates in a shade between
 * `--chart-teammates-from` and `--chart-teammates-to`, and every other player
 * in a shade between `--chart-others-from` and `--chart-others-to`. See
 * {@link playerColorGetter}.
 *
 * `playerIds` should list every player in the game, and `currentPlayerId` is
 * `null` for a viewer with no player. `teammateIds` is empty without teams.
 * Colors are read after the theme class is applied to the page, as in
 * `useAssetColorGetter`, so they follow a theme toggle.
 */
export function usePlayerColors(
    currentPlayerId: number | null,
    playerIds: readonly number[],
    teammateIds: readonly number[] = NO_TEAMMATES,
): (playerId: number) => string {
    const { resolvedTheme } = useTheme();
    const [appliedTheme, setAppliedTheme] = useState(resolvedTheme);
    useEffect(() => {
        setAppliedTheme(resolvedTheme);
    }, [resolvedTheme]);

    return useMemo(() => {
        void appliedTheme; // read the colors again once the theme changes
        return playerColorGetter(
            {
                self: resolveCSSVar("--chart-self"),
                othersFrom: resolveCSSVar("--chart-others-from"),
                othersTo: resolveCSSVar("--chart-others-to"),
                teammatesFrom: resolveCSSVar("--chart-teammates-from"),
                teammatesTo: resolveCSSVar("--chart-teammates-to"),
            },
            currentPlayerId,
            playerIds,
            teammateIds,
        );
    }, [appliedTheme, currentPlayerId, playerIds, teammateIds]);
}

/** {@link usePlayerColors} for the persistent world's players. */
export function usePlayerColorGetter(): (playerId: number) => string {
    const myId = useMyId();
    const playerMap = usePlayerMap();
    const playerIds = useMemo(
        () => Object.keys(playerMap ?? {}).map(Number),
        [playerMap],
    );
    return usePlayerColors(myId, playerIds);
}
