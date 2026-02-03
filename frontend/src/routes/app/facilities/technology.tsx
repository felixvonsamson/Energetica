import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { Microscope } from "lucide-react";
import { useMemo } from "react";

import { ResearchProjectsDialog } from "@/components/dashboard/research-projects-dialog";
import { GameLayout } from "@/components/layout/game-layout";
import {
    TechnologyItem,
    TechnologyDetailDialog,
    TechnologyEffectsTable,
} from "@/components/technologies";
import { CatalogGrid, Button } from "@/components/ui";
import { useTechnologiesCatalog, useProjects } from "@/hooks/useProjects";

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
            isUnlocked: (cap) => cap.has_laboratory,
        },
        infoDialog: {
            contents: <TechnologiesHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): { technology?: string; projects?: boolean } => ({
        technology: search.technology ? String(search.technology) : undefined,
        projects:
            search.projects === "true" || search.projects === true
                ? true
                : undefined,
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
    const { technology, projects } = useSearch({
        from: "/app/facilities/technology",
    });
    const { data: projectsData } = useProjects();

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

    // Check if there are any research projects
    const hasResearchProjects = (projectsData?.research_queue.length ?? 0) > 0;

    return (
        <div className="p-4 md:p-8">
            {/* Research projects button - only shown if there are ongoing projects */}
            {hasResearchProjects && (
                <div className="mb-6 flex justify-center">
                    <Button
                        variant="outline"
                        onClick={() =>
                            navigate({
                                search: (prev) => ({ ...prev, projects: true }),
                            })
                        }
                        className="flex items-center gap-2"
                    >
                        <Microscope className="w-5 h-5" />
                        View Research Projects
                    </Button>
                </div>
            )}

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

            {/* Research Projects Dialog */}
            <ResearchProjectsDialog
                isOpen={projects === true}
                onClose={() =>
                    navigate({
                        search: (prev) => ({ ...prev, projects: undefined }),
                    })
                }
            />
        </div>
    );
}
