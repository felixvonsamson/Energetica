/** Resolution picker component for time series charts. */

import { Duration, TimeModeToggle } from "@/components/ui";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

    const availableResolutions = currentTick
        ? resolutions.filter(
              (res) =>
                  res.id === 0 || currentTick > res.resolution * minDatapoints,
          )
        : [];

    return (
        <div>
            <Label className="mb-2">Resolution</Label>
            <div className="flex flex-wrap gap-2 items-center">
                {availableResolutions.length > 0 && (
                    <Tabs
                        value={String(selectedResolution.id)}
                        onValueChange={(value) => setResolution(Number(value))}
                    >
                        <TabsList>
                            {availableResolutions.map((res) => (
                                <TabsTrigger
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
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                )}
                <TimeModeToggle />
            </div>
        </div>
    );
}
