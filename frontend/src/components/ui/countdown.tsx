import { useEffect, useState } from "react";

import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { formatTicksRemaining, getTicksRemaining } from "@/lib/format-utils";

export function Countdown({ endTick }: { endTick: number | null }) {
    const { currentTick } = useGameTick();
    const { data: engine } = useGameEngine();
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        if (!endTick) return;

        const interval = setInterval(() => {
            forceUpdate((n) => n + 1); // Trigger re-render
        }, 1000);

        return () => clearInterval(interval);
    }, [endTick]);

    if (!endTick || !engine || currentTick === undefined) return null;

    // TODO: actually compute the fractional tick correctly based on engine config
    // const ticksLeft = getTicksRemaining(endTick, currentTick + Math.random()); // test that the timer works
    const ticksLeft = getTicksRemaining(endTick, currentTick);
    return <>{formatTicksRemaining(ticksLeft, engine)}</>;
}
