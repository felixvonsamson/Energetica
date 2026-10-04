/**
 * The countdown on the running phase (#996), labeled by the decision it is for,
 * e.g. "Set prices — 2:14". The facilitator also gets "+N min" buttons to give
 * the room more time. No one can end a phase early.
 */

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useExtendPhase, useWorkshopSession } from "@/hooks/use-workshop";
import { cn } from "@/lib/utils";
import {
    formatCountdown,
    phaseDeadline,
    phaseLabel,
} from "@/lib/workshop-countdown";

/** The extensions the facilitator can pick from, in minutes. */
const EXTENSIONS = [1, 2, 5];

export function PhaseCountdown({ isFacilitator }: { isFacilitator: boolean }) {
    const { data: session, dataUpdatedAt } = useWorkshopSession();
    const [now, setNow] = useState(() => Date.now());
    const timer = session?.phase_timer;

    useEffect(() => {
        if (!timer) return;
        const id = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(id);
    }, [timer]);

    const label = session && phaseLabel(session.checkpoint);
    if (!timer || !label) return null;

    // `now` stops moving while no phase is timed, so right after a new timer
    // arrives it can be older than the answer. The answer's arrival is a
    // floor for the current time.
    const remainingMs =
        phaseDeadline(timer, dataUpdatedAt) - Math.max(now, dataUpdatedAt);
    const isRunning = remainingMs > 0;

    return (
        <div className="flex items-center gap-2">
            <span
                className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium tabular-nums",
                    isRunning
                        ? "border-border text-foreground"
                        : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
            >
                <Timer className="size-4" />
                {label} — {formatCountdown(remainingMs)}
            </span>
            {isFacilitator && isRunning && <ExtendButtons />}
        </div>
    );
}

function ExtendButtons() {
    const { mutate: extend, isPending } = useExtendPhase();

    return (
        <div className="flex items-center gap-1">
            {EXTENSIONS.map((minutes) => (
                <Button
                    key={minutes}
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => extend(minutes)}
                >
                    +{minutes} min
                </Button>
            ))}
        </div>
    );
}
