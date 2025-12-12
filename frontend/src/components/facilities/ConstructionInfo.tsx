/**
 * Shared component for displaying construction information. Shows duration,
 * power consumption, and emissions.
 */

import { Clock, Zap, Cloud } from "lucide-react";

import { formatPower, formatMass } from "@/lib/format-utils";

interface ConstructionInfoProps {
    constructionTime: number;
    constructionPower: number;
    constructionPollution?: number | null;
}

export function ConstructionInfo({
    constructionTime,
    constructionPower,
    constructionPollution,
}: ConstructionInfoProps) {
    // TODO: Format duration properly when we have game constants
    const formatDuration = (ticks: number) => {
        return `${ticks} ticks`;
    };

    return (
        <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <strong>{formatDuration(constructionTime)}</strong>
                <span className="text-xs text-gray-500">(Duration)</span>
            </div>
            <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <strong>{formatPower(constructionPower)}</strong>
                <span className="text-xs text-gray-500">(Power)</span>
            </div>
            {constructionPollution !== undefined &&
                constructionPollution !== null && (
                    <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4" />
                        <strong>{formatMass(constructionPollution)} CO₂</strong>
                        <span className="text-xs text-gray-500">
                            (Emissions)
                        </span>
                    </div>
                )}
        </div>
    );
}
