import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { GameLayout } from "@/components/layout/GameLayout";
import { Modal } from "@/components/ui";
import { useTechnologiesCatalog } from "@/hooks/useProjects";
import {
    TechnologyCard,
    TechnologyEffectsTable,
} from "@/components/technologies";

export const Route = createFileRoute("/app/facilities/technology")({
    component: TechnologyPage,
    staticData: {
        title: "Technologies",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_laboratory,
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

function TechnologyContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useTechnologiesCatalog();

    const technologies = catalogData?.technologies ?? [];

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Technologies
                </h1>
                <button
                    onClick={() => setShowInfoPopup(true)}
                    className="text-primary hover:opacity-80 transition-opacity"
                    aria-label="Show help"
                >
                    <HelpCircle className="w-8 h-8" />
                </button>
            </div>

            {/* Info modal */}
            <Modal
                isOpen={showInfoPopup}
                onClose={() => setShowInfoPopup(false)}
                title="Help : Technologies"
            >
                <div className="space-y-3">
                    <p>
                        Here you can find all the technologies that can be
                        researched thanks to the laboratory and their specific
                        information.
                    </p>
                    <p>
                        Each technology has a unique effect on a given set of
                        facilities. When clicking on a specific tile, it will
                        extend the tile and show you more information about the
                        technology as well as a button to start the research.
                    </p>
                    <p>
                        Technologies usually require specific levels of other
                        technologies or laboratory to be researched.
                    </p>
                    <p>
                        For more information about Technologies, refer to{" "}
                        <a
                            href="/wiki/technologies"
                            className="underline hover:opacity-80 text-white dark:text-dark-text-primary"
                        >
                            this section in the wiki
                        </a>
                        .
                    </p>
                </div>
            </Modal>

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

            {/* Technologies list */}
            {!isCatalogLoading && technologies.length > 0 && (
                <div className="space-y-4">
                    {technologies.map((technology) => (
                        <TechnologyCard
                            key={technology.name}
                            technology={technology}
                            renderEffectsTable={(technology) => (
                                <TechnologyEffectsTable
                                    technology={technology}
                                />
                            )}
                            extraHeaderContent={(technology) => (
                                <span className="text-lg">
                                    lvl.{" "}
                                    <em className="text-xl">
                                        {technology.level}
                                    </em>
                                </span>
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
