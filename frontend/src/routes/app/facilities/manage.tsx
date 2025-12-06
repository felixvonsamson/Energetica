/** Facility management page - Overview of player assets. */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Modal, Card, CardTitle } from "@components/ui";
import { FacilityGauge } from "@components/ui/FacilityGauge";
import { useFacilities } from "@hooks/useFacilities";
import { FacilityGroupTable } from "@/components/facilities/FacilityGroupTable";
import { formatPower, formatEnergy, formatMassRate } from "@lib/format-utils";
import { dummyFacilities } from "@/data/dummyFacilities";
import { useHasCapability } from "@/hooks/useCapabilities";

type FacilityCategory = "power" | "storage" | "extraction";

export const Route = createFileRoute("/app/facilities/manage")({
    component: FacilityManagementPage,
    staticData: {
        title: "Facility Management",
    },
});

function FacilityManagementPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <FacilityManagementContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function FacilityManagementContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);
    const [selectedCategory, setSelectedCategory] =
        useState<FacilityCategory>("power");
    const {
        data: facilities,
        isLoading: facilitiesLoading,
        error: facilitiesError,
    } = useFacilities();
    const hasStorage = useHasCapability("has_storage");

    // Only show category UI if more than just power facilities are available
    const showCategoryUI = hasStorage;

    // TEMPORARY: Set to true to showcase all asset colors with dummy data
    const SHOW_DUMMY_DATA = false;

    const isLoading = facilitiesLoading;
    const error = facilitiesError;

    if (isLoading && !SHOW_DUMMY_DATA) {
        return (
            <div className="p-4 md:p-8 text-center">
                <p className="text-lg">Loading...</p>
            </div>
        );
    }

    if (error && !SHOW_DUMMY_DATA) {
        return (
            <div className="p-4 md:p-8 text-center text-red-600">
                <p className="text-lg">Error loading data</p>
            </div>
        );
    }

    const displayFacilities = SHOW_DUMMY_DATA ? dummyFacilities : facilities;

    if (!displayFacilities) {
        return null;
    }

    const getCategoryLabel = (category: FacilityCategory): string => {
        const labels: Record<FacilityCategory, string> = {
            power: "Power",
            storage: "Storage",
            extraction: "Extraction",
        };
        return labels[category];
    };

    const renderFacilitySection = () => {
        switch (selectedCategory) {
            case "power":
                return (
                    <section className="mb-8">
                        <Card>
                            <CardTitle className="mb-4">
                                Power Facilities
                            </CardTitle>
                            <div className="overflow-x-auto">
                                <FacilityGroupTable
                                    facilities={
                                        displayFacilities.power_facilities
                                    }
                                    columns={[
                                        {
                                            header: "Max Power",
                                            className: "text-right",
                                            sortable: true,
                                            sortKey: "max_power_generation",
                                            render: (f) => (
                                                <span className="font-mono">
                                                    {formatPower(
                                                        f.max_power_generation,
                                                    )}
                                                </span>
                                            ),
                                            renderSummary: (facilities) => (
                                                <span className="font-mono">
                                                    {formatPower(
                                                        facilities.reduce(
                                                            (sum, f) =>
                                                                sum +
                                                                f.max_power_generation,
                                                            0,
                                                        ),
                                                    )}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: "Output",
                                            className:
                                                "text-center min-w-[150px]",
                                            render: (f) => (
                                                <FacilityGauge
                                                    facilityType={f.facility}
                                                    value={f.usage * 100}
                                                />
                                            ),
                                            renderSummary: (facilities) => {
                                                const avgUsage =
                                                    facilities.reduce(
                                                        (sum, f) =>
                                                            sum + f.usage,
                                                        0,
                                                    ) / facilities.length;
                                                const firstFacility =
                                                    facilities[0];
                                                return firstFacility ? (
                                                    <FacilityGauge
                                                        facilityType={
                                                            firstFacility.facility
                                                        }
                                                        value={avgUsage * 100}
                                                    />
                                                ) : null;
                                            },
                                        },
                                    ]}
                                    emptyMessage="No power facilities built yet"
                                />
                            </div>
                        </Card>
                    </section>
                );
            case "storage":
                return (
                    <section className="mb-8">
                        <Card>
                            <CardTitle className="mb-4">
                                Storage Facilities
                            </CardTitle>
                            <div className="overflow-x-auto">
                                <FacilityGroupTable
                                    facilities={
                                        displayFacilities.storage_facilities
                                    }
                                    columns={[
                                        {
                                            header: "Capacity",
                                            className: "text-right",
                                            sortable: true,
                                            sortKey: "storage_capacity",
                                            render: (f) => (
                                                <span className="font-mono">
                                                    {formatEnergy(
                                                        f.storage_capacity,
                                                    )}
                                                </span>
                                            ),
                                            renderSummary: (facilities) => (
                                                <span className="font-mono">
                                                    {formatEnergy(
                                                        facilities.reduce(
                                                            (sum, f) =>
                                                                sum +
                                                                f.storage_capacity,
                                                            0,
                                                        ),
                                                    )}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: "State of Charge",
                                            className:
                                                "text-center min-w-[150px]",
                                            render: (f) => (
                                                <FacilityGauge
                                                    facilityType={f.facility}
                                                    value={
                                                        f.state_of_charge * 100
                                                    }
                                                />
                                            ),
                                            renderSummary: (facilities) => {
                                                const avgSOC =
                                                    facilities.reduce(
                                                        (sum, f) =>
                                                            sum +
                                                            f.state_of_charge,
                                                        0,
                                                    ) / facilities.length;
                                                const firstFacility =
                                                    facilities[0];
                                                return firstFacility ? (
                                                    <FacilityGauge
                                                        facilityType={
                                                            firstFacility.facility
                                                        }
                                                        value={avgSOC * 100}
                                                    />
                                                ) : null;
                                            },
                                        },
                                    ]}
                                    emptyMessage="No storage facilities built yet"
                                />
                            </div>
                        </Card>
                    </section>
                );
            case "extraction":
                return (
                    <section className="mb-8">
                        <Card>
                            <CardTitle className="mb-4">
                                Extraction Facilities
                            </CardTitle>
                            <div className="overflow-x-auto">
                                <FacilityGroupTable
                                    facilities={
                                        displayFacilities.extraction_facilities
                                    }
                                    columns={[
                                        {
                                            header: "Extraction Rate",
                                            className: "text-right",
                                            sortable: true,
                                            sortKey: "extraction_rate",
                                            render: (f) => (
                                                <span className="font-mono">
                                                    {formatMassRate(
                                                        f.extraction_rate,
                                                    )}
                                                </span>
                                            ),
                                            renderSummary: (facilities) => (
                                                <span className="font-mono">
                                                    {formatMassRate(
                                                        facilities.reduce(
                                                            (sum, f) =>
                                                                sum +
                                                                f.extraction_rate,
                                                            0,
                                                        ),
                                                    )}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: "Usage",
                                            className:
                                                "text-center min-w-[150px]",
                                            render: (f) => (
                                                <FacilityGauge
                                                    facilityType={f.facility}
                                                    value={f.usage * 100}
                                                />
                                            ),
                                            renderSummary: (facilities) => {
                                                const avgUsage =
                                                    facilities.reduce(
                                                        (sum, f) =>
                                                            sum + f.usage,
                                                        0,
                                                    ) / facilities.length;
                                                const firstFacility =
                                                    facilities[0];
                                                return firstFacility ? (
                                                    <FacilityGauge
                                                        facilityType={
                                                            firstFacility.facility
                                                        }
                                                        value={avgUsage * 100}
                                                    />
                                                ) : null;
                                            },
                                        },
                                    ]}
                                    emptyMessage="No extraction facilities built yet"
                                />
                            </div>
                        </Card>
                    </section>
                );
        }
    };

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Facility Management
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
                title="Help : Facility Management"
            >
                <div className="space-y-3">
                    <p>
                        This is your facility management page with an overview
                        of all your assets.
                    </p>
                    <p>
                        You will find tables with all the instances of power,
                        storage and extraction facilities you own with their
                        respective information. You also have the possibility to
                        upgrade (after you researched a technology that affects
                        this facility) or dismantle each instance.
                    </p>
                </div>
            </Modal>

            {/* Category Filter */}
            {showCategoryUI && (
                <div className="mb-6 flex flex-wrap gap-2 justify-center">
                    {(["power", "storage", "extraction"] as const).map(
                        (category) => {
                            // Only show storage if capability is enabled
                            if (category === "storage" && !hasStorage) {
                                return null;
                            }
                            return (
                                <button
                                    key={category}
                                    onClick={() =>
                                        setSelectedCategory(category)
                                    }
                                    className={`px-4 py-2 rounded font-medium transition-colors ${
                                        selectedCategory === category
                                            ? "bg-primary text-white"
                                            : "bg-tan-green/20 dark:bg-dark-bg-tertiary hover:bg-tan-green/40 dark:hover:bg-dark-bg-secondary"
                                    }`}
                                >
                                    {getCategoryLabel(category)}
                                </button>
                            );
                        },
                    )}
                </div>
            )}

            {/* Facility Section */}
            {renderFacilitySection()}
        </div>
    );
}
