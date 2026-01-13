import { ExternalLink, GitCompareArrows } from "lucide-react";
import { ReactNode } from "react";

import { RequirementsDisplay, ConstructionInfo } from "@/components/facilities";
import {
    Modal,
    FacilityName,
    FacilityIcon,
    Money,
    CardContent,
} from "@/components/ui";
import { useQueueProject } from "@/hooks/useProjects";
import { ProjectType, Requirement } from "@/types/projects";

interface FacilityDetailModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
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
    imageExtension?: "png" | "jpg";
    extraHeaderContent?: (facility: T) => ReactNode;
    onCompare?: () => void;
}

/**
 * Modal displaying detailed facility information. Shows full specs,
 * requirements, construction info, and action buttons.
 */
export function FacilityDetailModal<T>({
    isOpen,
    onClose,
    facility,
    facilityType,
    renderDescription,
    renderStatsTable,
    imageExtension = "jpg",
    extraHeaderContent,
    onCompare,
}: FacilityDetailModalProps<T>) {
    const queueProjectMutation = useQueueProject();

    const handleConstruction = () => {
        queueProjectMutation.mutate({ type: facility.name });
        onClose();
    };

    const imageUrl = `/static/images/${facilityType}_facilities/${facility.name}.${imageExtension}`;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
            className="max-w-4xl max-h-[90vh] overflow-y-auto"
        >
            <div className="space-y-6">
                {/* Image */}
                <div className="w-full">
                    <img
                        src={imageUrl}
                        alt={`${facility.name} ${facilityType} facility`}
                        className="w-full h-64 object-cover rounded-lg"
                    />
                </div>

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <FacilityIcon facility={facility.name} size={28} />
                            <FacilityName
                                facility={facility.name}
                                mode="long"
                            />
                        </h2>
                        {extraHeaderContent && extraHeaderContent(facility)}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-xl font-semibold">
                            <Money amount={facility.price} iconSize="lg" long />
                        </div>
                        <a
                            href={facility.wikipedia_link}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:opacity-80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    </div>
                </div>

                {/* Description */}
                <CardContent>
                    {renderDescription ? (
                        renderDescription(facility)
                    ) : (
                        <div
                            dangerouslySetInnerHTML={{
                                __html: facility.description,
                            }}
                        />
                    )}
                </CardContent>

                {/* Requirements */}
                {facility.requirements_status !== "satisfied" &&
                    facility.requirements && (
                        <CardContent>
                            <RequirementsDisplay
                                requirements={facility.requirements}
                            />
                        </CardContent>
                    )}

                {/* Stats Table */}
                <CardContent className="flex justify-around">
                    <div className="w-xl">{renderStatsTable(facility)}</div>
                </CardContent>

                {/* Construction Info */}
                <CardContent className="flex justify-around">
                    <div className="w-xl">
                        <ConstructionInfo
                            constructionTime={facility.construction_time}
                            constructionPower={facility.construction_power}
                            constructionPollution={
                                facility.construction_pollution ?? undefined
                            }
                        />
                    </div>
                </CardContent>

                {/* Action Buttons */}
                <div className="flex justify-center gap-3 pt-4 border-t border-border/50">
                    {onCompare && (
                        <button
                            onClick={onCompare}
                            className="px-6 py-3 rounded-lg font-semibold bg-muted hover:bg-muted/80 transition-colors text-lg flex items-center gap-2"
                        >
                            <GitCompareArrows className="w-5 h-5" />
                            Compare
                        </button>
                    )}
                    <button
                        onClick={handleConstruction}
                        disabled={
                            facility.requirements_status === "unsatisfied"
                        }
                        className={`px-8 py-3 rounded-lg font-bold text-white transition-colors text-lg ${
                            facility.requirements_status === "unsatisfied"
                                ? "bg-destructive cursor-not-allowed"
                                : "bg-brand-green hover:bg-brand-green/80"
                        }`}
                    >
                        {facility.requirements_status === "unsatisfied"
                            ? "Locked"
                            : "Start Construction"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
