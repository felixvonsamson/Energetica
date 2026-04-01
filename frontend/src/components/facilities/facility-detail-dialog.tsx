import { ExternalLink, GitCompareArrows } from "lucide-react";
import { ReactNode } from "react";

import { TypographyH2 } from "@/components/ui/typography";

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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useQueueProject } from "@/hooks/use-projects";
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
                <div className="w-full overflow-hidden">
                    <img
                        src={imageUrl}
                        alt={`${facility.name} ${facilityType} facility`}
                        className="w-full aspect-[3/1] object-cover rounded-lg"
                    />
                </div>

                {/* Header */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <div className="flex items-center gap-2 mr-auto">
                        <TypographyH2 className="flex items-center gap-2">
                            <FacilityIcon facility={facility.name} size={28} />
                            <FacilityName
                                facility={facility.name}
                                mode="long"
                            />
                        </TypographyH2>
                        {extraHeaderContent && extraHeaderContent(facility)}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-xl font-semibold">
                            <Money amount={facility.price} long />
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-3">
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
                </div>

                {/* Requirements */}
                {facility.requirements_status !== "satisfied" &&
                    facility.requirements.length > 0 && (
                        <CardContent>
                            <RequirementsDisplay
                                requirements={facility.requirements}
                            />
                        </CardContent>
                    )}

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

                <hr className="border-border" />

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

                {/* Stats Table */}
                <CardContent className="flex justify-around">
                    {renderStatsTable(facility)}
                </CardContent>

                {/* Learn More */}
                {facilityType !== "functional" && (
                    <div className="flex justify-center">
                        <a
                            href={facility.wikipedia_link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-4 h-4" />
                            Learn more
                        </a>
                    </div>
                )}
            </div>
        </>
    );
}
