/**
 * Shared component for displaying construction/research information. Shows
 * duration, power consumption, and emissions as icon + value pairs.
 */

import { Clock, Zap, Cloud } from "lucide-react";

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
        <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <strong>
                    <TogglingDuration ticks={constructionTime} />
                </strong>
            </div>
            <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
                <strong>{formatPower(constructionPower)}</strong>
            </div>
            {constructionPollution !== undefined &&
                constructionPollution !== null && (
                    <div className="flex items-center gap-1.5">
                        <Cloud className="w-4 h-4 text-muted-foreground shrink-0" />
                        <strong>
                            {formatMass(constructionPollution)} CO₂
                        </strong>
                    </div>
                )}
        </div>
    );
}
