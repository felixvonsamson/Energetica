/** Resolution picker component for time series charts. */

import { Duration, TimeModeToggle } from "@/components/ui";
import { Label } from "@/components/ui/label";
import { useTimeMode } from "@/contexts/time-mode-context";
import { resolutions } from "@/types/charts";

interface ResolutionPickerProps {
    currentTick: number | undefined;
    /** Minimum number of datapoints required to show a resolution option */
    minDatapoints?: number;
}

/**
 * Resolution picker component for selecting time ranges in charts. Only shows
 * resolution options that have enough data available.
 */
export function ResolutionPicker({
    currentTick,
    minDatapoints = 60,
}: ResolutionPickerProps) {
    const { selectedResolution, setResolution } = useTimeMode();
    return (
        <div>
            <Label className="mb-2">Resolution</Label>
            <div className="flex flex-wrap gap-2">
                {currentTick &&
                    resolutions
                        .filter(
                            // Only show resolution if there's enough data
                            (res) =>
                                currentTick > res.resolution * minDatapoints,
                        )
                        .map((res) => (
                            <button
                                key={res.id}
                                onClick={() => setResolution(res.id)}
                                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                                    selectedResolution.id === res.id
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                }`}
                            >
                                <Duration
                                    ticks={
                                        res.resolution *
                                        (res.id === 0 ? 60 : 360)
                                    }
                                />
                            </button>
                        ))}
                <TimeModeToggle />
            </div>
        </div>
    );
}
