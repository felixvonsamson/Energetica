import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { ReactNode } from "react";

import { RequirementsDisplay, ConstructionInfo } from "@/components/facilities";
import { TechnologyIcon, Money, CardContent, AssetName } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { TypographyH2 } from "@/components/ui/typography";
import { useQueueProject } from "@/hooks/use-projects";
import { getFacilityRoute } from "@/lib/facility-routes";
import { ProjectType, Requirement } from "@/types/projects";

interface TechnologyDetailModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
    technology:
        | (T & {
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
          })
        | null;
    renderEffectsTable: (technology: T) => ReactNode;
}

/**
 * Modal displaying detailed technology information. Shows full specs,
 * requirements, research info, and action buttons.
 */
export function TechnologyDetailDialog<T>({
    isOpen,
    onClose,
    technology,
    renderEffectsTable,
}: TechnologyDetailModalProps<T>) {
    const queueProjectMutation = useQueueProject();

    const handleResearch = () => {
        if (technology === null) return;
        queueProjectMutation.mutate({
            type: technology.name,
        });
        onClose();
    };

    const imageUrl = `/static/images/technologies/${technology?.name}.jpg`;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-w-4xl">
                {technology === null ? null : (
                    <>
                        <DialogHeader className="sr-only">
                            <DialogTitle>
                                <AssetName
                                    assetId={technology.name}
                                    mode="long"
                                />
                                {` Level ${technology.level}`}
                            </DialogTitle>
                            <DialogDescription>
                                Technology details, requirements, and research
                                information.
                            </DialogDescription>
                        </DialogHeader>

                        {/* Scrollable body */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                            {/* Image */}
                            <div className="w-full overflow-hidden">
                                <img
                                    src={imageUrl}
                                    alt={`${technology.name} technology`}
                                    className="w-full aspect-[3/1] object-cover rounded-lg"
                                    onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                    }}
                                />
                            </div>

                            {/* Header */}
                            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                                <TypographyH2 className="flex items-center gap-2 mr-auto">
                                    <TechnologyIcon
                                        technology={technology.name}
                                        size={28}
                                    />
                                    <AssetName
                                        assetId={technology.name}
                                        mode="long"
                                    />
                                </TypographyH2>
                                <p className="text-3xl text-muted-foreground">
                                    Level {technology.level}
                                </p>
                            </div>

                            {/* Description & Learn More */}
                            <CardContent className="space-y-2">
                                <div className="[&_p:last-of-type]:inline">
                                    <div
                                        className="contents"
                                        dangerouslySetInnerHTML={{
                                            __html: technology.description,
                                        }}
                                    />
                                </div>
                                <a
                                    href={technology.wikipedia_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground w-fit"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Learn more
                                </a>
                                {/* Affected Facilities */}
                                {technology.affected_facilities.length > 0 && (
                                    <div>
                                        <strong>Affects:</strong>{" "}
                                        <span className="text-hyperlink">
                                            {technology.affected_facilities.map(
                                                (facilityName, idx) => {
                                                    const route =
                                                        getFacilityRoute(
                                                            facilityName,
                                                        );
                                                    return (
                                                        <span
                                                            key={facilityName}
                                                        >
                                                            {route ? (
                                                                <Link
                                                                    to={route}
                                                                    className="underline hover:opacity-80"
                                                                >
                                                                    <AssetName
                                                                        assetId={
                                                                            facilityName
                                                                        }
                                                                        mode="long"
                                                                        className="underline"
                                                                    />
                                                                </Link>
                                                            ) : (
                                                                <AssetName
                                                                    assetId={
                                                                        facilityName
                                                                    }
                                                                    mode="long"
                                                                />
                                                            )}
                                                            {idx <
                                                                technology
                                                                    .affected_facilities
                                                                    .length -
                                                                    1 && ", "}
                                                        </span>
                                                    );
                                                },
                                            )}
                                        </span>
                                    </div>
                                )}
                            </CardContent>

                            {/* Effects Table */}
                            <CardContent className="flex justify-around">
                                {renderEffectsTable(technology)}
                            </CardContent>
                        </div>

                        {/* Footer — always visible */}
                        <div className="shrink-0 border-t border-border bg-background px-6 py-4 flex flex-col gap-3">
                            {/* Construction info */}
                            <ConstructionInfo
                                constructionTime={technology.construction_time}
                                constructionPower={
                                    technology.construction_power
                                }
                                className="w-full justify-evenly"
                            />

                            {/* Unlock requirements */}
                            {technology.requirements.some(
                                (r) => r.status !== "satisfied",
                            ) && (
                                <RequirementsDisplay
                                    requirements={technology.requirements}
                                />
                            )}

                            {/* Price + Action button */}
                            <div className="flex items-center justify-around">
                                <div className="flex items-center gap-2">
                                    <Money
                                        amount={Math.round(
                                            technology.price *
                                                (technology.discount ?? 1),
                                        )}
                                        long
                                        className="text-lg font-semibold"
                                    />
                                    {/* Knowledge spillover badge */}
                                    {technology.discount && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 text-sm font-semibold cursor-help select-none">
                                                    −
                                                    {Math.round(
                                                        (1 -
                                                            technology.discount) *
                                                            100,
                                                    )}
                                                    %
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-56 text-center leading-snug">
                                                <Link
                                                    to="/app/wiki/$slug"
                                                    params={{
                                                        slug: "technologies",
                                                    }}
                                                    hash="knowledge-spillover"
                                                    className="underline hover:opacity-80"
                                                >
                                                    Knowledge spillover
                                                </Link>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                                <Button
                                    size="lg"
                                    onClick={handleResearch}
                                    disabled={
                                        technology.requirements_status ===
                                        "unsatisfied"
                                    }
                                    variant={
                                        technology.requirements_status ===
                                        "unsatisfied"
                                            ? "destructive"
                                            : "default"
                                    }
                                    className="px-8 text-base font-bold"
                                >
                                    {technology.requirements_status ===
                                    "unsatisfied"
                                        ? "Locked"
                                        : technology.requirements_status ===
                                            "queued"
                                          ? "Queue Research"
                                          : "Start Research"}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
