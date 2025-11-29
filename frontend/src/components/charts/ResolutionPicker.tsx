/** Resolution picker component for time series charts. */

import { Resolution } from "@/types/charts";

export interface ResolutionOption {
    id: number;
    label: string;
    resolution: Resolution;
}

interface ResolutionPickerProps {
    resolutions: ResolutionOption[];
    selectedResolutionIndex: number;
    onResolutionChange: (index: number) => void;
    currentTick: number | undefined;
    /** Minimum number of datapoints required to show a resolution option */
    minDatapoints?: number;
}

/**
 * Resolution picker component for selecting time ranges in charts. Only shows
 * resolution options that have enough data available.
 */
export function ResolutionPicker({
    resolutions,
    selectedResolutionIndex,
    onResolutionChange,
    currentTick,
    minDatapoints = 360,
}: ResolutionPickerProps) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">Resolution</label>
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
                                onClick={() => onResolutionChange(res.id)}
                                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                                    selectedResolutionIndex === res.id
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                }`}
                            >
                                {res.label}
                            </button>
                        ))}
            </div>
        </div>
    );
}
