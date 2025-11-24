import { useState, ReactNode } from "react";
import { ExternalLink } from "lucide-react";

import { Card, Money, TechnologyName } from "@/components/ui";
import { RequirementsDisplay, ConstructionInfo } from "@/components/facilities";
import { useQueueProject } from "@/hooks/useProjects";

interface TechnologyCardProps<T> {
    technology: T & {
        name: string;
        price: number;
        description: string;
        wikipedia_link: string;
        requirements_status: string;
        requirements: unknown;
        construction_time: number;
        construction_power: number;
        level: number;
        affected_facilities: string[];
        discount?: number | null;
        prevalence?: number | null;
    };
    renderEffectsTable: (technology: T) => ReactNode;
    extraHeaderContent?: (technology: T) => ReactNode;
}

export function TechnologyCard<T>({
    technology,
    renderEffectsTable,
    extraHeaderContent,
}: TechnologyCardProps<T>) {
    const [isExpanded, setIsExpanded] = useState(false);
    const queueProjectMutation = useQueueProject();

    const handleResearch = () => {
        queueProjectMutation.mutate({ type: technology.name as any });
    };

    const imageUrl = `/static/images/technologies/${technology.name}.jpg`;

    return (
        <Card
            className="cursor-pointer hover:border-brand-green transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Image */}
                <div className="flex-shrink-0">
                    <img
                        src={imageUrl}
                        alt={`${technology.name} technology`}
                        className="w-full lg:w-64 h-auto rounded"
                        onError={(e) => {
                            // Fallback if image doesn't exist
                            e.currentTarget.style.display = "none";
                        }}
                    />
                </div>

                {/* Main Info */}
                <div className="flex-grow space-y-3">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold">
                            <TechnologyName
                                technology={technology.name}
                                mode="long"
                            />
                        </h2>
                        {extraHeaderContent && extraHeaderContent(technology)}
                        <a
                            href={technology.wikipedia_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-white hover:opacity-80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                        <div className="text-lg font-semibold">
                            <Money
                                amount={technology.price}
                                iconSize="md"
                                long
                            />
                        </div>
                        {/* Knowledge spillover discount */}
                        {technology.discount && (
                            <div className="text-green-500 text-sm">
                                <em>
                                    (-
                                    {Math.round(
                                        (1 - technology.discount) * 100,
                                    )}
                                    %)
                                </em>
                                {technology.prevalence && (
                                    <span className="text-xs text-gray-400 ml-1">
                                        ({technology.prevalence} other player
                                        {technology.prevalence > 1 ? "s" : ""})
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Description & Affected Facilities */}
                    <div className="text-sm space-y-2">
                        <div
                            dangerouslySetInnerHTML={{
                                __html: technology.description,
                            }}
                        />
                        {technology.affected_facilities &&
                            technology.affected_facilities.length > 0 && (
                                <div>
                                    <strong>Affected facilities:</strong>{" "}
                                    <em className="text-blue-400">
                                        {technology.affected_facilities.join(
                                            ", ",
                                        )}
                                    </em>
                                </div>
                            )}
                    </div>

                    {/* Requirements */}
                    {technology.requirements_status !== "satisfied" && (
                        <RequirementsDisplay
                            requirements={technology.requirements as any}
                        />
                    )}
                </div>

                {/* Stats Table (visible on desktop when not expanded) */}
                {!isExpanded && (
                    <div className="hidden xl:block flex-shrink-0">
                        {renderEffectsTable(technology)}
                    </div>
                )}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="mt-6 pt-6 border-t border-pine/20 dark:border-dark-border/50">
                    {/* Research Info & Button */}
                    <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleResearch();
                            }}
                            disabled={
                                technology.requirements_status === "unsatisfied"
                            }
                            className={`px-6 py-3 rounded font-bold text-white transition-colors ${
                                technology.requirements_status === "unsatisfied"
                                    ? "bg-alert-red cursor-not-allowed"
                                    : "bg-brand-green hover:bg-brand-green/80"
                            }`}
                        >
                            {technology.requirements_status === "unsatisfied"
                                ? "Locked"
                                : technology.requirements_status === "queued"
                                  ? "Queue Research"
                                  : "Start Research"}
                        </button>

                        <ConstructionInfo
                            constructionTime={technology.construction_time}
                            constructionPower={technology.construction_power}
                        />
                    </div>

                    {/* Full Effects Table */}
                    {renderEffectsTable(technology)}
                </div>
            )}
        </Card>
    );
}
