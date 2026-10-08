/** Merit Order & Market Clearing chart for electricity markets */

import { memo, useMemo, useState } from "react";

import { MeritOrderView } from "@/components/charts/merit-order-view";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAssetColorGetter } from "@/hooks/use-asset-color-getter";
import { useMarketData } from "@/hooks/use-charts";
import { useElectricityMarket } from "@/hooks/use-electricity-markets";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { usePlayerColorGetter } from "@/hooks/use-player-color-getter";
import { usePlayerMap } from "@/hooks/use-players";
import { getAssetLongName } from "@/lib/assets/asset-names";
import { formatDuration } from "@/lib/format-utils";

export type {
    ActiveMode,
    ColorMode,
} from "@/components/charts/merit-order-view";

// ── MeritOrderChart ───────────────────────────────────────────────────────────

export interface MeritOrderChartProps {
    marketId: number;
    height?: number;
}

/**
 * A persistent-world market's merit order at any of its last 360 ticks, picked
 * with a slider.
 */
function MeritOrderChartInner({
    marketId,
    height = 500,
}: MeritOrderChartProps) {
    const { currentTick } = useGameTick();
    const { data: gameEngine } = useGameEngine();
    const getColor = useAssetColorGetter();
    const getPlayerColor = usePlayerColorGetter();
    const playerMap = usePlayerMap();
    const marketDetails = useElectricityMarket(marketId);

    // Tick selection (last 360 ticks).
    // ticksBack=0 always shows the latest tick; increases as the slider moves left.
    const [ticksBack, setTicksBack] = useState(0);
    const maxTick = currentTick !== undefined ? currentTick - 1 : 0;
    const minTick = useMemo(() => {
        if (!currentTick) return 0;
        const marketStart = marketDetails?.created_tick ?? 0;
        return Math.max(marketStart, currentTick - 360);
    }, [currentTick, marketDetails]);
    const selectedTick = Math.max(minTick, maxTick - ticksBack);

    const {
        data: marketData,
        isLoading,
        isError,
    } = useMarketData({ marketId, tick: selectedTick });

    const sliderLabel = useMemo(() => {
        if (!currentTick || !gameEngine) return `Tick ${selectedTick}`;
        const ticksAgo = currentTick - selectedTick;
        if (ticksAgo <= 0) return "Current";
        return `${formatDuration(ticksAgo, gameEngine, true)} ago`;
    }, [selectedTick, currentTick, gameEngine]);

    if (!currentTick) return null;

    return (
        <MeritOrderView
            data={marketData}
            isLoading={isLoading}
            isError={isError}
            height={height}
            getFacilityColor={getColor}
            getPlayerColor={getPlayerColor}
            playerName={(playerId) =>
                playerMap?.[playerId]?.username ?? `Player ${playerId}`
            }
            facilityName={getAssetLongName}
            toolbar={
                <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium shrink-0 w-28 text-right">
                        {sliderLabel}
                    </Label>
                    <div className="flex-1">
                        <Slider
                            min={minTick}
                            max={maxTick}
                            step={1}
                            value={[selectedTick]}
                            onValueChange={(values) =>
                                setTicksBack(maxTick - (values[0] ?? maxTick))
                            }
                            disabled={minTick >= maxTick}
                        />
                    </div>
                </div>
            }
        />
    );
}

export const MeritOrderChart = memo(MeritOrderChartInner);
