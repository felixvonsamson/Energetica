import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@/contexts/theme-context";
import { useMyId, usePlayerMap } from "@/hooks/use-players";
import { resolveCSSVar } from "@/lib/charts/color-utils";
import { playerColorGetter } from "@/lib/charts/player-colors";

/**
 * Hook that returns each player's theme-aware chart color: the current player
 * in `--chart-self`, every other player in a shade between
 * `--chart-others-from` and `--chart-others-to`. See {@link playerColorGetter}.
 *
 * Colors are read after the theme class is applied to the page, as in
 * `useAssetColorGetter`, so they follow a theme toggle.
 */
export function usePlayerColorGetter(): (playerId: number) => string {
    const { resolvedTheme } = useTheme();
    const [appliedTheme, setAppliedTheme] = useState(resolvedTheme);
    useEffect(() => {
        setAppliedTheme(resolvedTheme);
    }, [resolvedTheme]);

    const myId = useMyId();
    const playerMap = usePlayerMap();

    return useMemo(() => {
        void appliedTheme; // read the colors again once the theme changes
        const playerIds = Object.keys(playerMap ?? {}).map(Number);
        return playerColorGetter(
            {
                self: resolveCSSVar("--chart-self"),
                othersFrom: resolveCSSVar("--chart-others-from"),
                othersTo: resolveCSSVar("--chart-others-to"),
            },
            myId,
            playerIds,
        );
    }, [appliedTheme, myId, playerMap]);
}
