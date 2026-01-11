import { ExternalLink } from "lucide-react";
import { ReactNode } from "react";

import { RequirementsDisplay, ConstructionInfo } from "@/components/facilities";
import {
    Modal,
    TechnologyName,
    TechnologyIcon,
    Money,
    CardContent,
} from "@/components/ui";
import { useQueueProject } from "@/hooks/useProjects";
import { ProjectType, Requirement } from "@/types/projects";

interface TechnologyDetailModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
    technology: T & {
        name: ProjectType;
        price: number;
        description: string;
        wikipedia_link: string;
        requirements_status: string;
        requirements: Requirement[];
        construction_time: number;
        construction_power: number;
        level: number;
        affected_facilities: string[];
        discount?: number | null;
        prevalence?: number | null;
    };
    renderEffectsTable: (technology: T) => ReactNode;
}

/**
 * Modal displaying detailed technology information. Shows full specs,
 * requirements, research info, and action buttons.
 */
export function TechnologyDetailModal<T>({
    isOpen,
    onClose,
    technology,
    renderEffectsTable,
}: TechnologyDetailModalProps<T>) {
    const queueProjectMutation = useQueueProject();

    const handleResearch = () => {
        queueProjectMutation.mutate({
            type: technology.name,
        });
        onClose();
    };

    const imageUrl = `/static/images/technologies/${technology.name}.jpg`;

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
                        alt={`${technology.name} technology`}
                        className="w-full h-64 object-cover rounded-lg"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                </div>

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <TechnologyIcon
                                technology={technology.name}
                                size={28}
                            />
                            <TechnologyName
                                technology={technology.name}
                                level={technology.level}
                                mode="long"
                            />
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-xl font-semibold">
                            <Money
                                amount={technology.price}
                                iconSize="lg"
                                long
                            />
                        </div>
                        {/* Knowledge spillover discount */}
                        {technology.discount && (
                            <div className="text-green-500 text-base">
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
                        <a
                            href={technology.wikipedia_link}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:opacity-80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    </div>
                </div>

                {/* Description & Affected Facilities */}
                <CardContent>
                    <div className="space-y-2">
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
                </CardContent>

                {/* Requirements */}
                {technology.requirements_status !== "satisfied" && (
                    <CardContent>
                        <RequirementsDisplay
                            requirements={technology.requirements}
                        />
                    </CardContent>
                )}

                {/* Effects Table */}
                <CardContent className="flex justify-around">
                    <div className="w-xl">{renderEffectsTable(technology)}</div>
                </CardContent>

                {/* Research Info */}
                <CardContent className="flex justify-around">
                    <div className="w-xl">
                        <ConstructionInfo
                            constructionTime={technology.construction_time}
                            constructionPower={technology.construction_power}
                        />
                    </div>
                </CardContent>

                {/* Action Button */}
                <div className="flex justify-center pt-4 border-t border-border/50">
                    <button
                        onClick={handleResearch}
                        disabled={
                            technology.requirements_status === "unsatisfied"
                        }
                        className={`px-8 py-3 rounded-lg font-bold text-white transition-colors text-lg ${
                            technology.requirements_status === "unsatisfied"
                                ? "bg-destructive cursor-not-allowed"
                                : "bg-brand-green hover:bg-brand-green/80"
                        }`}
                    >
                        {technology.requirements_status === "unsatisfied"
                            ? "Locked"
                            : technology.requirements_status === "queued"
                              ? "Queue Research"
                              : "Start Research"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
