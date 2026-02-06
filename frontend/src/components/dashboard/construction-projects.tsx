import { useMemo } from "react";

import { ProgressItem } from "@/components/dashboard/progress-item";
import { AssetName } from "@/components/ui/asset-name";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import {
    useCancelProject,
    useDecreaseProjectPriority,
    useIncreaseProjectPriority,
    usePauseProject,
    useProjects,
    useResumeProject,
} from "@/hooks/use-projects";
import { formatTicksRemaining, getTicksRemaining } from "@/lib/format-utils";
import { calculateProjectProgress } from "@/lib/progress-utils";
import { isConstructionProject } from "@/lib/project-utils";

interface ConstructionProjectsProps {
    showActions?: boolean;
}

/**
 * Component for displaying ongoing construction projects with progress
 * tracking. Shows status, progress bars, time remaining, and optional action
 * buttons.
 */
export function ConstructionProjects({
    showActions = true,
}: ConstructionProjectsProps) {
    const { data: projectsData, isLoading } = useProjects();
    const { data: engine } = useGameEngine();
    const { currentTick } = useGameTick();

    // Mutations
    const pauseMutation = usePauseProject();
    const resumeMutation = useResumeProject();
    const cancelMutation = useCancelProject();
    const increasePriorityMutation = useIncreaseProjectPriority();
    const decreasePriorityMutation = useDecreaseProjectPriority();

    // Filter for construction projects only
    const constructionProjects = useMemo(() => {
        if (!projectsData?.projects) return [];
        return projectsData.projects.filter(isConstructionProject);
    }, [projectsData]);

    // Get queue info
    const constructionQueue = projectsData?.construction_queue || [];

    if (isLoading || currentTick === undefined) {
        return (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                Loading construction projects...
            </div>
        );
    }

    if (constructionProjects.length === 0) {
        return null; // Let DashboardSection handle empty state
    }

    return (
        <div className="space-y-3">
            {constructionProjects.map((project) => {
                // Calculate progress
                const progress = calculateProjectProgress(
                    project.duration,
                    project.end_tick,
                    project.ticks_passed,
                    currentTick,
                    project.status,
                );

                // Calculate time remaining
                let timeRemaining: string | undefined;
                if (project.status !== 0 && project.end_tick && engine) {
                    // Not paused - calculate time remaining
                    const ticksLeft = getTicksRemaining(
                        project.end_tick,
                        currentTick,
                    );
                    timeRemaining = formatTicksRemaining(ticksLeft, engine);
                }

                // Map status enum to string
                const statusMap: Record<
                    number,
                    "paused" | "waiting" | "ongoing"
                > = {
                    0: "paused",
                    1: "waiting",
                    2: "ongoing",
                };
                const status = statusMap[project.status] || "ongoing";

                // Queue position
                const queueIndex = constructionQueue.indexOf(project.id);
                const isFirstInQueue = queueIndex === 0;
                const isLastInQueue =
                    queueIndex === constructionQueue.length - 1;

                return (
                    <ProgressItem
                        key={project.id}
                        title={<AssetName assetId={project.type} mode="long" />}
                        subtitle={
                            project.level !== null
                                ? `Level ${project.level}`
                                : undefined
                        }
                        progress={progress}
                        status={status}
                        timeRemaining={timeRemaining}
                        speed={
                            project.speed !== 1.0 ? project.speed : undefined
                        }
                        showActions={showActions}
                        onPause={
                            showActions
                                ? () => pauseMutation.mutate(project.id)
                                : undefined
                        }
                        onResume={
                            showActions
                                ? () => resumeMutation.mutate(project.id)
                                : undefined
                        }
                        onCancel={
                            showActions
                                ? () => cancelMutation.mutate(project.id)
                                : undefined
                        }
                        onIncreasePriority={
                            showActions
                                ? () =>
                                      increasePriorityMutation.mutate(
                                          project.id,
                                      )
                                : undefined
                        }
                        onDecreasePriority={
                            showActions
                                ? () =>
                                      decreasePriorityMutation.mutate(
                                          project.id,
                                      )
                                : undefined
                        }
                        isPausing={pauseMutation.isPending}
                        isResuming={resumeMutation.isPending}
                        isCancelling={cancelMutation.isPending}
                        isChangingPriority={
                            increasePriorityMutation.isPending ||
                            decreasePriorityMutation.isPending
                        }
                        isFirstInQueue={isFirstInQueue}
                        isLastInQueue={isLastInQueue}
                    />
                );
            })}
        </div>
    );
}
