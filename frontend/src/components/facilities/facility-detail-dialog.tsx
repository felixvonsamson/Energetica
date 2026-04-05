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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { TypographyH2 } from "@/components/ui/typography";
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
    renderDescription?: (facility: T, learnMore?: ReactNode) => ReactNode;
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
            <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden">
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
    renderDescription:
        | ((facility: T, learnMore?: ReactNode) => ReactNode)
        | undefined,
    renderStatsTable: (facility: T) => ReactNode,
    onCompare: ((facility: T) => void) | undefined,
    handleConstruction: () => void,
) {
    const imageExtension = imageExtensionMap[facility.name] ?? "jpg";
    const imageUrl = `/static/images/${facilityType}_facilities/${facility.name}.${imageExtension}`;
    const isLocked = facility.requirements_status === "unsatisfied";
    const hasUnsatisfiedRequirements = facility.requirements.some(
        (r) => r.status !== "satisfied",
    );

    const learnMoreLink =
        facilityType !== "functional" ? (
            <a
                href={facility.wikipedia_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground w-fit"
                onClick={(e) => e.stopPropagation()}
            >
                <ExternalLink className="w-3 h-3" />
                Learn more
            </a>
        ) : undefined;

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

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                {/* Image */}
                <div className="w-full overflow-hidden">
                    <img
                        src={imageUrl}
                        alt={`${facility.name} ${facilityType} facility`}
                        className="w-full aspect-[3/1] object-cover rounded-lg"
                    />
                </div>

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3">
                    <TypographyH2 className="flex items-center gap-2 mr-auto">
                        <FacilityIcon facility={facility.name} size={28} />
                        <FacilityName facility={facility.name} mode="long" />
                    </TypographyH2>
                    {extraHeaderContent && extraHeaderContent(facility)}
                </div>

                {/* Description */}
                <CardContent>
                    {renderDescription ? (
                        renderDescription(facility, learnMoreLink)
                    ) : (
                        <div className="[&_p:last-of-type]:inline">
                            <div
                                className="contents"
                                dangerouslySetInnerHTML={{
                                    __html: facility.description,
                                }}
                            />
                            {facilityType !== "functional" && (
                                <>
                                    {" "}
                                    <a
                                        href={facility.wikipedia_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Learn more
                                    </a>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>

                {/* Stats Table + Compare */}
                <CardContent>
                    <div className="flex justify-center">
                        <div className="flex flex-col gap-3">
                            {renderStatsTable(facility)}
                            {onCompare && (
                                <div className="flex justify-center">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onCompare(facility)}
                                    >
                                        <GitCompareArrows className="w-4 h-4" />
                                        Compare
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </div>

            {/* Footer — always visible */}
            <div className="shrink-0 border-t border-border bg-background px-6 py-4 flex flex-col gap-3">
                {/* Construction info */}
                <ConstructionInfo
                    constructionTime={facility.construction_time}
                    constructionPower={facility.construction_power}
                    constructionPollution={
                        facility.construction_pollution ?? undefined
                    }
                    className="w-full justify-evenly"
                />

                {/* Unlock requirements */}
                {hasUnsatisfiedRequirements && (
                    <RequirementsDisplay requirements={facility.requirements} />
                )}

                {/* Price + Action button */}
                <div className="flex items-center justify-around">
                    <Money
                        amount={facility.price}
                        long
                        className="text-lg font-semibold"
                    />
                    <Button
                        size="lg"
                        onClick={handleConstruction}
                        disabled={isLocked}
                        variant={isLocked ? "destructive" : "default"}
                        className="px-8 text-base font-bold"
                    >
                        {isLocked ? "Locked" : "Start Construction"}
                    </Button>
                </div>
            </div>
        </>
    );
}
