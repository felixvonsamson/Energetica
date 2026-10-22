/**
 * The in-game lifecycle banner (#866, T8), a strip under the top bar.
 *
 * - In the last day of `active`, it counts down to `freeze_at`, so the end of the
 *   game doesn't come as a surprise.
 * - From `freeze` on, it says the game has ended and the view is read-only. It
 *   can't be dismissed. It counts down to `ended_at`, when the instance goes
 *   away, and links to the run's recap on the lobby.
 *
 * Otherwise it renders nothing. The announced phase has its own full-screen
 * takeover (`AnnouncedScreen`).
 */

import { useQueryClient } from "@tanstack/react-query";
import { Clock, Snowflake } from "lucide-react";
import { useEffect, useState } from "react";

import { useGameEngine } from "@/hooks/use-game";
import {
    formatTimeLeft,
    isReadOnlyPhase,
    showFreezeCountdown,
} from "@/lib/lifecycle";
import { queryKeys } from "@/lib/query-client";
import {
    currentRunSlug,
    derivePhase,
    lobbyHref,
} from "@energetica/core/instances";

/**
 * How often the banner re-reads the engine config, so an admin moving
 * `freeze_at` or `ended_at` shows without a reload.
 */
const ENGINE_REFRESH_MS = 5 * 60 * 1000;

export function LifecycleBanner() {
    const { data: engine } = useGameEngine();
    const queryClient = useQueryClient();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const id = setInterval(
            () =>
                void queryClient.invalidateQueries({
                    queryKey: queryKeys.game.engine,
                }),
            ENGINE_REFRESH_MS,
        );
        return () => clearInterval(id);
    }, [queryClient]);

    if (!engine?.starts_at) return null;
    const phase = derivePhase(
        {
            starts_at: engine.starts_at,
            freeze_at: engine.freeze_at,
            ended_at: engine.ended_at,
        },
        new Date(now),
    );

    if (showFreezeCountdown(phase, engine.freeze_at, now) && engine.freeze_at) {
        return (
            <div
                role="status"
                className="bg-warning/15 text-foreground border-warning flex items-center justify-center gap-2 border-b px-4 py-1.5 text-sm"
            >
                <Clock className="text-warning size-4 shrink-0" />
                <span>
                    The game freezes in{" "}
                    <span className="font-semibold tabular-nums">
                        {formatTimeLeft(Date.parse(engine.freeze_at) - now)}
                    </span>
                    . After that you can still look around, but not play.
                </span>
            </div>
        );
    }

    if (isReadOnlyPhase(phase)) {
        const slug = currentRunSlug();
        return (
            <div
                role="status"
                className="bg-info/15 text-foreground border-info flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-sm"
            >
                <span className="flex items-center gap-2">
                    <Snowflake className="text-info size-4 shrink-0" />
                    <span>
                        <span className="font-semibold">
                            This game has ended.
                        </span>{" "}
                        You&apos;re viewing a read-only snapshot.
                    </span>
                </span>
                {phase === "freeze" && engine.ended_at && (
                    <span className="text-muted-foreground">
                        Closes in{" "}
                        <span className="tabular-nums">
                            {formatTimeLeft(Date.parse(engine.ended_at) - now)}
                        </span>
                    </span>
                )}
                {slug && (
                    <a
                        href={lobbyHref(`/runs/${slug}/recap`)}
                        className="font-medium underline hover:opacity-70"
                    >
                        View the recap
                    </a>
                )}
            </div>
        );
    }

    return null;
}
