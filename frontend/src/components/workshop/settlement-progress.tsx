/**
 * The bar that shows how far the simulation of a Trading period has got
 * (#1155), on every Workshop page while it runs. A full season can take a
 * minute, and without it the game looks stuck. The bar goes once the run is
 * over and the session is re-read with the period's results.
 */

import { useEffect, useState } from "react";

import { ProgressBar } from "@/components/ui/progress-bar";
import { useWorkshopSession } from "@/hooks/use-workshop";
import { settlementLabel } from "@/lib/workshop-settlement";
import type { ApiSchema } from "@/types/api-helpers";

/**
 * How long a run must have been going before the bar shows. A representative
 * day is usually over sooner, so it does not flash a bar.
 */
const SHOW_AFTER_MS = 500;

export function SettlementProgress() {
    const { data: session } = useWorkshopSession();
    const settlement = session?.settlement;
    // Mounted only while a run goes, so each run starts its wait afresh.
    return settlement ? <RunningSettlement settlement={settlement} /> : null;
}

function RunningSettlement({
    settlement,
}: {
    settlement: ApiSchema<"WorkshopSettlementOut">;
}) {
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setShown(true), SHOW_AFTER_MS);
        return () => clearTimeout(id);
    }, []);

    if (!shown) return null;
    // A representative day has no days to count, so its bar pulses instead.
    const isRepresentativeDay = settlement.days_total === 1;

    return (
        <div
            role="status"
            className="shrink-0 border-b border-border bg-card px-4 py-2"
        >
            <ProgressBar
                value={isRepresentativeDay ? 1 : settlement.days_done}
                max={isRepresentativeDay ? 1 : settlement.days_total}
                label={settlementLabel(settlement)}
                showPercentage={!isRepresentativeDay}
                className={
                    isRepresentativeDay
                        ? "mx-auto max-w-[1400px] animate-pulse"
                        : "mx-auto max-w-[1400px]"
                }
            />
        </div>
    );
}
