/**
 * Shared component for displaying construction/research information. Shows
 * duration, power consumption, and emissions as icon + value pairs.
 */

import { Clock, Zap, Cloud } from "lucide-react";

import { DualDuration } from "@/components/ui";
import { formatPower, formatMass } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface ConstructionInfoProps {
    constructionTime: number;
    constructionPower: number;
    constructionPollution?: number | null;
    className?: string;
}

export function ConstructionInfo({
    constructionTime,
    constructionPower,
    constructionPollution,
    className,
}: ConstructionInfoProps) {
    return (
        <div className={cn("flex flex-wrap gap-4 items-center", className)}>
            <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 shrink-0" />
                <strong>
                    <DualDuration ticks={constructionTime} compact />
                </strong>
            </div>
            <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 shrink-0" />
                <strong>{formatPower(constructionPower)}</strong>
            </div>
            {constructionPollution !== undefined &&
                constructionPollution !== null && (
                    <div className="flex items-center gap-1.5">
                        <Cloud className="w-4 h-4 shrink-0" />
                        <strong>{formatMass(constructionPollution)} CO₂</strong>
                    </div>
                )}
        </div>
    );
}
