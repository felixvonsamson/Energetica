import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { GameLayout } from "@/components/layout/GameLayout";
import {
    TechnologyItem,
    TechnologyDetailModal,
    TechnologyEffectsTable,
} from "@/components/technologies";
import { CatalogGrid } from "@/components/ui";
import { useTechnologiesCatalog } from "@/hooks/useProjects";
import type { ApiSchema } from "@/types/api-helpers";

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
        infoModal: {
            contents: <TechnologiesHelp />,
        },
    },
});

function TechnologyPage() {
    return (
        <GameLayout>
            <TechnologyContent />
        </GameLayout>
    );
}

type Technology = ApiSchema<"TechnologyCatalogOut">;

function TechnologyContent() {
    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useTechnologiesCatalog();

    const technologies = catalogData?.technologies ?? [];
    const [selectedTechnology, setSelectedTechnology] =
        useState<Technology | null>(null);

    return (
        <div className="p-4 md:p-8">
            {/* Title */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Technologies
                </h1>
            </div>

            {/* TODO: Under construction technologies will show here */}
            <div id="under_construction" className="mb-6"></div>

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
                                    setSelectedTechnology(technology)
                                }
                            />
                        ))}
                    </CatalogGrid>

                    {/* Detail Modal */}
                    {selectedTechnology && (
                        <TechnologyDetailModal
                            isOpen={selectedTechnology !== null}
                            onClose={() => setSelectedTechnology(null)}
                            technology={selectedTechnology}
                            renderEffectsTable={(technology) => (
                                <TechnologyEffectsTable
                                    technology={technology}
                                />
                            )}
                        />
                    )}
                </>
            )}
        </div>
    );
}
