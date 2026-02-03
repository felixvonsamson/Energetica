import { ExternalLink, GitCompareArrows } from "lucide-react";
import { ReactNode } from "react";

import { RequirementsDisplay, ConstructionInfo } from "@/components/facilities";
import {
    FacilityName,
    FacilityIcon,
    Money,
    CardContent,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { TypographyH2 } from "@/components/ui/typography";
import { useQueueProject } from "@/hooks/useProjects";
import { imageExtensionMap } from "@/lib/projects";
import { ProjectType, Requirement } from "@/types/projects";

interface FacilityDetailDialogProps<T> {
    isOpen: boolean;
    onClose: () => void;
    facility:
        | (T & {
              name: ProjectType;
              price: number;
              description: string;
              wikipedia_link: string;
              requirements_status: string;
              requirements: Requirement[];
              construction_time: number;
              construction_power: number;
              construction_pollution?: number | null;
          })
        | null;
    facilityType: "power" | "storage" | "extraction" | "functional";
    renderDescription?: (facility: T) => ReactNode;
    renderStatsTable: (facility: T) => ReactNode;
    extraHeaderContent?: (facility: T) => ReactNode;
    onCompare?: (facility: T) => void;
}

/**
 * Dialog displaying detailed facility information. Shows full specs,
 * requirements, construction info, and action buttons.
 */
export function FacilityDetailDialog<T>({
    isOpen,
    onClose,
    facility,
    facilityType,
    renderDescription,
    renderStatsTable,
    extraHeaderContent,
    onCompare,
}: FacilityDetailDialogProps<T>) {
    const queueProjectMutation = useQueueProject();

    const handleConstruction = () => {
        if (!facility) return;
        queueProjectMutation.mutate({ type: facility.name });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                {facility !== null &&
                    FacilityContent(
                        facility,
                        facilityType,
                        extraHeaderContent,
                        renderDescription,
                        renderStatsTable,
                        onCompare,
                        handleConstruction,
                    )}
            </DialogContent>
        </Dialog>
    );
}

// Non-empty content for FacilityDetailDialog
function FacilityContent<T>(
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
    },
    facilityType: string,
    extraHeaderContent: ((facility: T) => ReactNode) | undefined,
    renderDescription: ((facility: T) => ReactNode) | undefined,
    renderStatsTable: (facility: T) => ReactNode,
    onCompare: ((facility: T) => void) | undefined,
    handleConstruction: () => void,
) {
    const imageExtension = imageExtensionMap[facility.name] ?? "jpg";
    const imageUrl = `/static/images/${facilityType}_facilities/${facility.name}.${imageExtension}`;

    return (
        <>
            <DialogHeader className="sr-only">
                <DialogTitle>
                    <FacilityName facility={facility.name} mode="long" />
                </DialogTitle>
                <DialogDescription>
                    Facility details, requirements, and construction
                    information.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
                {/* Image */}
                <div className="w-auto">
                    <img
                        src={imageUrl}
                        alt={`${facility.name} ${facilityType} facility`}
                        className="w-full aspect-3/2 object-cover rounded-lg"
                    />
                </div>

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                        <TypographyH2 className="flex items-center gap-2">
                            <FacilityIcon facility={facility.name} size={28} />
                            <FacilityName
                                facility={facility.name}
                                mode="long"
                            />
                        </TypographyH2>
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
                    facility.requirements.length > 0 && (
                        <CardContent>
                            <RequirementsDisplay
                                requirements={facility.requirements}
                            />
                        </CardContent>
                    )}

                {/* Stats Table */}
                <CardContent className="flex justify-around">
                    {renderStatsTable(facility)}
                </CardContent>

                {/* Construction Info */}
                <CardContent className="flex justify-around">
                    <ConstructionInfo
                        constructionTime={facility.construction_time}
                        constructionPower={facility.construction_power}
                        constructionPollution={
                            facility.construction_pollution ?? undefined
                        }
                    />
                </CardContent>
            </div>
            <DialogFooter>
                {/* Action Buttons */}
                {onCompare && (
                    <Button
                        size="lg"
                        variant="secondary"
                        onClick={() => onCompare(facility)}
                        className="px-6 text-lg font-semibold"
                    >
                        <GitCompareArrows className="w-5 h-5 mr-2" />
                        Compare
                    </Button>
                )}
                <Button
                    size="lg"
                    onClick={handleConstruction}
                    disabled={facility.requirements_status === "unsatisfied"}
                    variant={
                        facility.requirements_status === "unsatisfied"
                            ? "destructive"
                            : "default"
                    }
                    className="px-8 text-lg font-bold"
                >
                    {facility.requirements_status === "unsatisfied"
                        ? "Locked"
                        : "Start Construction"}
                </Button>
            </DialogFooter>
        </>
    );
}
