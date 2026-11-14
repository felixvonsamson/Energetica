import { useMemo } from "react";

import { useMyId, usePlayerMap } from "@/hooks/use-players";
import { usePlayerColors } from "@energetica/charts/hooks/use-player-colors";

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
