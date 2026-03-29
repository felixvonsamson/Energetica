import { ChevronDown, ChevronUp, Pause, Play, Trash2 } from "lucide-react";
import { ReactNode } from "react";

import { Money, TogglingDuration } from "@/components/ui";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TechnologyName, ResourceName } from "@/components/ui/asset-name";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/countdown";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataValue, TypographyP } from "@/components/ui/typography";
import {
    useCancelProject,
    useDecreaseProjectPriority,
    useIncreaseProjectPriority,
    usePauseProject,
    useResumeProject,
} from "@/hooks/use-projects";
import { useShipments } from "@/hooks/use-shipments";
import { formatMass } from "@/lib/format-utils";
import { useProjectProgress, useShipmentProgress } from "@/lib/progress-utils";
import { useProjectQueue } from "@/lib/project-utils";
import { Project, ProjectCategory, ProjectStatus } from "@/types/projects";
import { Shipment } from "@/types/shipments";

type ProjectListProps = {
    projectCategory: ProjectCategory;
};

export function ProjectList({ projectCategory }: ProjectListProps) {
    const projects = useProjectQueue(projectCategory);

    if (projects === undefined) {
        return (
            <div className="text-center text-muted-foreground">
                Loading {projectCategory} projects...
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {projects.map((project) => (
                <ProjectItem key={project.id} project={project} />
            ))}
        </div>
    );
}

export function ShipmentList() {
    const { data } = useShipments();

    if (data === undefined) {
        return (
            <div className="text-center text-muted-foreground">
                Loading shipments...
            </div>
        );
    }

    const shipments = data.shipments;

    if (shipments.length === 0) return null;

    return (
        <div className="space-y-2">
            {shipments.map((shipment) => (
                <ShipmentItem key={shipment.id} shipment={shipment} />
            ))}
        </div>
    );
}

type ProjectItemProps = {
    project: Project & { isFirst: boolean; isLast: boolean };
};

function ProjectItem({ project }: ProjectItemProps) {
    const progress = useProjectProgress(
        project.duration,
        project.end_tick,
        project.ticks_passed,
        project.status,
        project.speed,
    );
    const resumeMutation = useResumeProject();
    const onResume = () => resumeMutation.mutate(project.id);
    const pauseMutation = usePauseProject();
    const onPause = () => pauseMutation.mutate(project.id);
    const increasePriorityMutation = useIncreaseProjectPriority();
    const onIncreasePriority = () =>
        increasePriorityMutation.mutate(project.id);
    const decreasePriorityMutation = useDecreaseProjectPriority();
    const onDecreasePriority = () =>
        decreasePriorityMutation.mutate(project.id);
    const cancelMutation = useCancelProject();
    const onCancel = () => cancelMutation.mutate(project.id);

    const cardActions = (
        <>
            {/* Pause/Resume button */}
            {project.status === "paused" ? (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onResume}
                    disabled={resumeMutation.isPending}
                    className="p-1"
                    aria-label="Resume project"
                >
                    <Play size={14} />
                </Button>
            ) : (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onPause}
                    disabled={pauseMutation.isPending}
                    className="p-1"
                    aria-label="Pause project"
                >
                    <Pause size={14} />
                </Button>
            )}

            {/* Cancel button */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={cancelMutation.isPending}
                        className="p-1"
                        aria-label="Cancel project"
                    >
                        <Trash2 size={14} />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Are you sure you want to cancel this project?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="flex gap-1 text-foreground font-medium">
                            Cancel{" "}
                            <TechnologyName
                                technology={project.type}
                                level={project.level}
                            />
                        </AlertDialogDescription>
                        <AlertDialogDescription className="text-foreground">
                            This action cannot be undone.
                        </AlertDialogDescription>
                        <AlertDialogDescription className="text-foreground">
                            You will be refunded{" "}
                            <Money amount={project.cancellation_refund} /> i.e.{" "}
                            <DataValue>
                                {project.cancellation_refund_percentage.toFixed(
                                    0,
                                )}
                                %
                            </DataValue>{" "}
                            of the original cost of the project.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" asChild>
                            <Button
                                onClick={onCancel}
                                disabled={cancelMutation.isPending}
                            >
                                Continue
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );

    return (
        <div className="flex items-stretch gap-2">
            {/* Priority arrows — outside the card, left side, matching card bg */}
            <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 self-center">
                {!project.isFirst ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onIncreasePriority}
                        disabled={increasePriorityMutation.isPending}
                        className="h-6 w-6 p-0 bg-muted/30 hover:bg-muted/60"
                        aria-label="Increase priority"
                    >
                        <ChevronUp size={14} />
                    </Button>
                ) : (
                    <div className="h-6 w-6" />
                )}
                {!project.isLast ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDecreasePriority}
                        disabled={decreasePriorityMutation.isPending}
                        className="h-6 w-6 p-0 bg-muted/30 hover:bg-muted/60"
                        aria-label="Decrease priority"
                    >
                        <ChevronDown size={14} />
                    </Button>
                ) : (
                    <div className="h-6 w-6" />
                )}
            </div>

            {/* Card */}
            <div className="flex-1">
                <ProgressCard
                    status={project.status}
                    progress={progress}
                    endTick={project.end_tick}
                    speed={project.speed}
                    remainingTicks={
                        project.duration - (project.ticks_passed ?? 0)
                    }
                    label={
                        <TechnologyName
                            technology={project.type}
                            level={project.level}
                        />
                    }
                    actions={cardActions}
                />
            </div>
        </div>
    );
}

function ShipmentItem({ shipment }: { shipment: Shipment }) {
    const progress = useShipmentProgress(
        shipment.duration,
        shipment.arrival_tick,
    );
    return (
        <ProgressCard
            status="in-transit"
            progress={progress}
            label={
                <div className="flex flex-row gap-2">
                    <ResourceName resource={shipment.resource} />
                    <div className="text-muted-foreground">
                        {formatMass(shipment.quantity)}
                    </div>
                </div>
            }
            speed={shipment.speed}
            endTick={shipment.arrival_tick}
            actions={<></>}
        />
    );
}

interface ProgressCardProps {
    status: ProjectStatus | "in-transit";
    progress: number;
    speed: number | undefined;
    endTick: number | null;
    /** Ticks remaining (used for waiting status display) */
    remainingTicks?: number;
    label: ReactNode;
    actions: ReactNode;
}

function ProgressCard({
    status,
    progress,
    speed,
    endTick,
    remainingTicks,
    label,
    actions,
}: ProgressCardProps) {
    return (
        <div className="px-3 pt-2 pb-1 rounded-lg bg-muted/30">
            {/* Header row: Badge, Title, Actions */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {!(status === "ongoing" && speed !== undefined && speed === 0) && (
                        <StatusBadge status={status} size="sm" />
                    )}
                    {speed !== undefined && speed < 1.0 && (
                        <StatusBadge
                            status={speed > 0 ? "slowed" : "stopped"}
                            size="sm"
                        />
                    )}
                    {label}
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {actions}
                </div>
            </div>

            {/* Progress bar */}
            <ProgressBar value={progress} showPercentage={false} />

            {/* Info row: Time remaining, speed */}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                    <TypographyP>
                        {status === "paused" || status === "waiting" ? (
                            remainingTicks !== undefined ? (
                                <TogglingDuration ticks={remainingTicks} />
                            ) : null
                        ) : (
                            <Countdown endTick={endTick} speed={speed} />
                        )}
                    </TypographyP>
                    {speed !== undefined && speed < 1.0 && (
                        <>×{speed.toFixed(1)} speed</>
                    )}
                </div>
                <span className="font-medium">{progress.toFixed(0)}%</span>
            </div>
        </div>
    );
}
