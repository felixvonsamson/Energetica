/**
 * Shared component for displaying construction information. Shows duration,
 * power consumption, and emissions.
 */

import { Zap, Cloud } from "lucide-react";

import { TogglingDuration } from "@/components/ui";
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
    return (
        <div className="flex flex-wrap gap-4 w-full justify-around">
            <div className="flex items-center gap-2">
                <span className="text-foreground">Duration:</span>
                <strong>
                    <TogglingDuration ticks={constructionTime} />
                </strong>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-foreground">Power:</span>
                <strong>{formatPower(constructionPower)}</strong>
                <Zap className="w-4 h-4" />
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
