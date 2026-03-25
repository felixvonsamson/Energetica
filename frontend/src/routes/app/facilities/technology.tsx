import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { Microscope } from "lucide-react";
import { useMemo, useState } from "react";

import {
    ProjectsPanel,
    ProjectsPanelToggle,
} from "@/components/dashboard/projects-panel";
import { GameLayout } from "@/components/layout/game-layout";
import {
    TechnologyItem,
    TechnologyDetailDialog,
    TechnologyEffectsTable,
} from "@/components/technologies";
import { CatalogGrid } from "@/components/ui";
import { useTechnologiesCatalog, useProjects } from "@/hooks/use-projects";

function TechnologiesHelp() {
    return (
        <div className="space-y-3">
            <p>
                Here you can find all the technologies that can be researched
                thanks to the laboratory and their specific information.
            </p>
            <p>
                Click on any technology to open a detailed view with full
                specifications and a button to start research.
            </p>
            <p>
                Technologies usually require specific levels of other
                technologies or laboratory to be researched.
            </p>
            <p>
                For more information about Technologies, refer to{" "}
                <a
                    href="/wiki/technologies"
                    className="underline hover:opacity-80 text-foreground"
                >
                    this section in the wiki
                </a>
                .
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilities/technology")({
    component: TechnologyPage,
    staticData: {
        title: "Technologies",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) =>
                cap.has_laboratory
                    ? { unlocked: true }
                    : { unlocked: false, reason: "Build a Laboratory to unlock" },
        },
        infoDialog: {
            contents: <TechnologiesHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): { technology?: string } => ({
        technology: search.technology ? String(search.technology) : undefined,
    }),
});

function TechnologyPage() {
    return (
        <GameLayout>
            <TechnologyContent />
        </GameLayout>
    );
}

function TechnologyContent() {
    const navigate = useNavigate({ from: "/app/facilities/technology" });
    const { technology } = useSearch({
        from: "/app/facilities/technology",
    });
    const { data: projectsData } = useProjects();
    const researchCount = projectsData?.research_queue.length ?? 0;
    const [projectsPanelOpen, setProjectsPanelOpen] = useState(false);

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useTechnologiesCatalog();

    const technologies = useMemo(
        () => catalogData?.technologies ?? [],
        [catalogData?.technologies],
    );

    // Find selected technology from URL param
    const selectedTechnology = useMemo(
        () => technologies.find((t) => t.name === technology) || null,
        [technologies, technology],
    );

    return (
        <div className="p-4 md:p-8">
            {/* Research projects panel — very top, full width */}
            <ProjectsPanel
                projectCategory="research"
                icon={Microscope}
                panelTitle="Under Research"
                isOpen={projectsPanelOpen}
            />

            <div className="flex justify-end mb-6">
                <ProjectsPanelToggle
                    count={researchCount}
                    icon={Microscope}
                    buttonLabel="Research Projects"
                    isOpen={projectsPanelOpen}
                    onToggle={() => setProjectsPanelOpen((p) => !p)}
                />
            </div>

            {/* Loading state */}
            {isCatalogLoading && (
                <div className="text-center py-8 text-gray-500">
                    Loading technologies...
                </div>
            )}

            {/* Error state */}
            {isCatalogError && (
                <div className="text-center py-8 text-alert-red">
                    Failed to load technologies. Please try again.
                </div>
            )}

            {/* Technologies grid */}
            {!isCatalogLoading && technologies.length > 0 && (
                <>
                    <CatalogGrid>
                        {technologies.map((technology) => (
                            <TechnologyItem
                                key={technology.name}
                                technologyName={technology.name}
                                price={technology.price}
                                isLocked={
                                    technology.requirements_status ===
                                    "unsatisfied"
                                }
                                discount={technology.discount}
                                level={technology.level}
                                onClick={() =>
                                    navigate({
                                        search: { technology: technology.name },
                                    })
                                }
                            />
                        ))}
                    </CatalogGrid>

                    {/* Detail Dialog */}
                    <TechnologyDetailDialog
                        isOpen={selectedTechnology !== null}
                        onClose={() => navigate({ search: {} })}
                        technology={selectedTechnology}
                        renderEffectsTable={(technology) => (
                            <TechnologyEffectsTable technology={technology} />
                        )}
                    />
                </>
            )}

        </div>
    );
}
