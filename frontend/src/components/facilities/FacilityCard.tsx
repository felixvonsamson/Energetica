import { ExternalLink } from "lucide-react";
import { useState, ReactNode } from "react";

import { RequirementsDisplay, ConstructionInfo } from "@/components/facilities";
import { Card, FacilityName, FacilityIcon, Money } from "@/components/ui";
import { useQueueProject } from "@/hooks/useProjects";
import { ProjectType, Requirement } from "@/types/projects";

interface FacilityCardProps<T> {
    facility: T & {
        name: ProjectType;
        price: number;
        description: string;
        wikipedia_link: string;
        requirements_status: string;
        requirements: Requirement[];
        construction_time: number;
        construction_power: number;
        construction_pollution?: number | null;
    };
    facilityType: "power" | "storage" | "extraction" | "functional";
    renderDescription?: (facility: T) => ReactNode;
    renderStatsTable: (facility: T) => ReactNode;
    imageExtensionMap?: Record<string, "png" | "jpg">;
    extraHeaderContent?: (facility: T) => ReactNode;
}

export function FacilityCard<T>({
    facility,
    facilityType,
    renderDescription,
    renderStatsTable,
    imageExtensionMap = {},
    extraHeaderContent,
}: FacilityCardProps<T>) {
    const [isExpanded, setIsExpanded] = useState(false);
    const queueProjectMutation = useQueueProject();

    const handleConstruction = () => {
        queueProjectMutation.mutate({ type: facility.name });
    };

    // Determine image extension
    const imageExtension =
        imageExtensionMap[facility.name as keyof typeof imageExtensionMap] ??
        "jpg";
    const imageUrl = `/static/images/${facilityType}_facilities/${facility.name}.${imageExtension}`;

    return (
        <Card
            className="cursor-pointer hover:border-brand-green transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Image */}
                <div className="shrink-0">
                    <img
                        src={imageUrl}
                        alt={`${facility.name} ${facilityType} facility`}
                        className="w-full lg:w-64 h-auto rounded"
                    />
                </div>

                {/* Main Info */}
                <div className="grow space-y-3">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FacilityIcon facility={facility.name} size={24} />
                            <FacilityName
                                facility={facility.name}
                                mode="long"
                            />
                        </h2>
                        {extraHeaderContent && extraHeaderContent(facility)}
                        <a
                            href={facility.wikipedia_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-white hover:opacity-80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                        <div className="text-lg font-semibold">
                            <Money amount={facility.price} iconSize="md" long />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="text-sm">
                        {renderDescription ? (
                            renderDescription(facility)
                        ) : (
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: facility.description,
                                }}
                            />
                        )}
                    </div>

                    {/* Requirements */}
                    {facility.requirements_status !== "satisfied" &&
                        facility.requirements && (
                            <RequirementsDisplay
                                requirements={facility.requirements}
                            />
                        )}
                </div>

                {/* Stats Table (visible on desktop when not expanded) */}
                {!isExpanded && (
                    <div className="hidden xl:block shrink-0">
                        {renderStatsTable(facility)}
                    </div>
                )}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="mt-6 pt-6 border-t border-pine/20 dark:border-dark-border/50">
                    {/* Construction Info & Button */}
                    <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleConstruction();
                            }}
                            disabled={
                                facility.requirements_status === "unsatisfied"
                            }
                            className={`px-6 py-3 rounded font-bold text-white transition-colors ${
                                facility.requirements_status === "unsatisfied"
                                    ? "bg-alert-red cursor-not-allowed"
                                    : "bg-brand-green hover:bg-brand-green/80"
                            }`}
                        >
                            {facility.requirements_status === "unsatisfied"
                                ? "Locked"
                                : "Start Construction"}
                        </button>

                        <ConstructionInfo
                            constructionTime={facility.construction_time}
                            constructionPower={facility.construction_power}
                            constructionPollution={
                                facility.construction_pollution ?? undefined
                            }
                        />
                    </div>

                    {/* Full Stats Table */}
                    {renderStatsTable(facility)}
                </div>
            )}
        </Card>
    );
}
