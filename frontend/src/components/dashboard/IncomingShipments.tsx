import { ProgressItem } from "@/components/dashboard/ProgressItem";
import { AssetName } from "@/components/ui/AssetName";
import { useGameEngine } from "@/hooks/useGame";
import { useGameTick } from "@/hooks/useGameTick";
import { useShipments } from "@/hooks/useShipments";
import {
    formatMass,
    formatTicksRemaining,
    getTicksRemaining,
} from "@/lib/format-utils";
import { calculateShipmentProgress } from "@/lib/progress-utils";

/**
 * Component for displaying incoming resource shipments with progress tracking.
 * Shows status, progress bars, and time remaining. Shipments cannot be
 * cancelled or paused.
 */
export function IncomingShipments() {
    const { data: shipmentsData, isLoading } = useShipments();
    const { data: engine } = useGameEngine();
    const { currentTick } = useGameTick();

    if (isLoading || currentTick === undefined) {
        return (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                Loading shipments...
            </div>
        );
    }

    const shipments = shipmentsData?.shipments || [];

    if (shipments.length === 0) {
        return null; // Let DashboardSection handle empty state
    }

    return (
        <div className="space-y-3">
            {shipments.map((shipment) => {
                // Calculate progress
                const progress = calculateShipmentProgress(
                    shipment.duration,
                    shipment.arrival_tick,
                    currentTick,
                );

                // Calculate time remaining
                let timeRemaining: string | undefined;
                if (engine) {
                    const ticksLeft = getTicksRemaining(
                        shipment.arrival_tick,
                        currentTick,
                    );
                    timeRemaining = formatTicksRemaining(ticksLeft, engine);
                }

                return (
                    <ProgressItem
                        key={shipment.id}
                        title={
                            <AssetName
                                assetId={shipment.resource}
                                mode="long"
                            />
                        }
                        subtitle={formatMass(shipment.quantity)}
                        progress={progress}
                        status="in-transit"
                        timeRemaining={timeRemaining}
                        showActions={false}
                    />
                );
            })}
        </div>
    );
}
