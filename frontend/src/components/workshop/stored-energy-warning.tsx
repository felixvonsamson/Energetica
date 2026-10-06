/**
 * A warning under a storage facility's price tag (#1001): some of the energy
 * that type holds no longer fits, because some of its facilities retired. The
 * energy stays with the type, so only building more of that same type saves it.
 * Whatever still does not fit is lost when the Investment phase closes.
 */

import { AlertTriangle } from "lucide-react";

import { formatEnergy } from "@/lib/format-utils";

export function StoredEnergyWarning({
    energyAtRisk,
}: {
    /**
     * The energy that neither the visitor's facilities nor their selection
     * holds, in Wh.
     */
    energyAtRisk: number;
}) {
    return (
        <p className="mt-3 flex max-w-60 items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            Build at least {formatEnergy(energyAtRisk)} so your stored energy is
            not lost.
        </p>
    );
}
