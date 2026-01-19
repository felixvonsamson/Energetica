import type { ReactNode } from "react";

import { Duration, FacilityIcon, AssetName } from "@/components/ui";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useGameTick } from "@/hooks/useGameTick";
import { assetCSSColourVariable } from "@/lib/assets/asset-colors";

interface CustomTooltipContentProps {
    active?: boolean;
    payload?: ReadonlyArray<{
        value: number;
        name: string;
        [key: string]: unknown;
    }>;
    label?: string | number;
    formatValue: (value: number) => ReactNode;
    formatLabel?: (key: string) => ReactNode;
}
export function CustomTooltipContent({
    active,
    payload,
    label,
    formatValue,
    formatLabel,
}: CustomTooltipContentProps) {
    const { currentTick } = useGameTick();
    const { mode } = useTimeMode();

    const sortedPayload = payload
        ? payload
              .filter((p) => p.value !== 0)
              .sort((a, b) => (b.value as number) - (a.value as number))
        : undefined;

    const isVisible = active && sortedPayload && sortedPayload.length;
    if (!isVisible) return null;
    return (
        <div className="bg-neutral-100 dark:bg-neutral-600 p-2">
            <table>
                {currentTick !== undefined &&
                    label !== undefined &&
                    typeof label === "number" && (
                        <caption className="caption-bottom">
                            <Duration ticks={currentTick - label} compact />
                            <>{" ago "}</>
                            {mode}
                        </caption>
                    )}
                <thead hidden>
                    <tr>
                        <th />
                        <th>{"label"}</th>
                        <th>{"value"}</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedPayload.map((p) => (
                        <tr key={p.name}>
                            <td>
                                <div
                                    className="h-6 aspect-square"
                                    style={{
                                        backgroundColor: assetCSSColourVariable(
                                            p.name,
                                        ),
                                    }}
                                />
                            </td>
                            <td className="px-2 min-w-30">
                                {formatLabel ? (
                                    formatLabel(p.name)
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <FacilityIcon
                                            facility={p.name}
                                            size={18}
                                        />
                                        <AssetName assetId={p.name} />
                                    </div>
                                )}
                            </td>
                            <td className="px-2">{formatValue(p.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
