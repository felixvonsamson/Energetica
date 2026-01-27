/** Resolution picker component for time series charts. */

import { Duration, TimeModeToggle } from "@/components/ui";
import { Label } from "@/components/ui/label";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { useTimeMode } from "@/contexts/time-mode-context";
import { resolutions } from "@/types/charts";

interface ResolutionPickerProps {
    currentTick: number | undefined;
    /** Minimum number of datapoints required to show a resolution option */
    minDatapoints?: number;
    /** Minimum tick where data is available (e.g., when a market was created) */
    minTick?: number;
}

/**
 * Resolution picker component for selecting time ranges in charts. Only shows
 * resolution options that have enough data available.
 */
export function ResolutionPicker({
    currentTick,
    minDatapoints = 60,
    minTick,
}: ResolutionPickerProps) {
    const { selectedResolution, setResolution } = useTimeMode();

    const availableResolutions = currentTick
        ? resolutions.filter((res) => {
              if (res.id === 0) return true;
              const dataAge = currentTick - (minTick ?? 0);
              return dataAge > res.resolution * minDatapoints;
          })
        : [];

    return (
        <div>
            <Label className="mb-2">Resolution</Label>
            <div className="flex flex-wrap gap-2 items-center">
                {availableResolutions.length > 0 && (
                    <SegmentedPicker
                        value={String(selectedResolution.id)}
                        onValueChange={(value) => setResolution(Number(value))}
                    >
                        {availableResolutions.map((res) => (
                            <SegmentedPickerOption
                                key={res.id}
                                value={String(res.id)}
                                className="w-12"
                            >
                                <Duration
                                    ticks={
                                        res.resolution *
                                        (res.id === 0 ? 60 : 360)
                                    }
                                />
                            </SegmentedPickerOption>
                        ))}
                    </SegmentedPicker>
                )}
                <TimeModeToggle />
            </div>
        </div>
    );
}
