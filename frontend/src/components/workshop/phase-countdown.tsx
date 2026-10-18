/**
 * The countdown on the running phase (#996), labeled by the decision it is for,
 * e.g. "Set prices — 2:14". The digits are large and bold, and glow red in the
 * last minute (#1249). Once the time is up, a status such as "Spring over"
 * replaces it. The facilitator also gets "+N min" buttons to give the room more
 * time while the phase runs. Ending a phase early is the advance button's job.
 */

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { useExtendPhase, useWorkshopSession } from "@/hooks/use-workshop";
import {
    formatCountdown,
    isFinalMinute,
    phaseDeadline,
    phaseLabel,
    timeUpStatus,
} from "@/lib/workshop-countdown";
import { Button } from "@energetica/ui/components/button";
import { cn } from "@energetica/ui/lib/utils";

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
    const status = session && timeUpStatus(session.checkpoint);
    if (!timer || !label || !status) return null;

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
                    "flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-medium tabular-nums",
                    isRunning ? "text-foreground" : "text-muted-foreground",
                )}
            >
                <Timer className="size-4 shrink-0" />
                {isRunning ? (
                    <>
                        {/* On a phone, the digits alone. */}
                        <span className="hidden sm:inline">{label} —</span>
                        <span
                            className={cn(
                                "text-base leading-none font-bold",
                                isFinalMinute(remainingMs) &&
                                    "text-destructive text-shadow-[0_0_8px_var(--color-destructive)]",
                            )}
                        >
                            {formatCountdown(remainingMs)}
                        </span>
                    </>
                ) : (
                    status
                )}
            </span>
            {isFacilitator && isRunning && <ExtendButtons />}
        </div>
    );
}

function ExtendButtons() {
    const { mutate: extend, isPending } = useExtendPhase();

    return (
        <div className="hidden items-center gap-1 md:flex">
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
