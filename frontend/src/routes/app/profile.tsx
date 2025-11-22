/**
 * Profile page - Overview of player assets and statistics.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Modal, Card, CardTitle, Money } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useFacilities } from "@/hooks/useFacilities";
import { FacilityGroupTable } from "@/components/profile/FacilityGroupTable";
import type { ApiResponse } from "@/types/api-helpers";
import { formatPower, formatEnergy, formatMassRate } from "@/lib/format-utils";

// Type aliases from generated API types
type FacilitiesData = ApiResponse<"/api/v1/facilities", "get">;
type PowerFacilityOut = FacilitiesData["power_facilities"][number];
type StorageFacilityOut = FacilitiesData["storage_facilities"][number];
type ExtractionFacilityOut = FacilitiesData["extraction_facilities"][number];

export const Route = createFileRoute("/app/profile")({
    component: ProfilePage,
    staticData: {
        title: "Profile",
    },
});

function ProfilePage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <ProfileContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function ProfileContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);
    const { user } = useAuth();
    const { data: facilities, isLoading, error } = useFacilities();

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 text-center">
                <p className="text-lg">Loading facilities...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 md:p-8 text-center text-red-600">
                <p className="text-lg">Error loading facilities</p>
            </div>
        );
    }

    if (!facilities) {
        return null;
    }

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Profile
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
                title="Help : Profile"
            >
                <div className="space-y-3">
                    <p>
                        This is your profile page with an overview of all your
                        assets.
                    </p>
                    <p>
                        You will find 3 tables with all the instances of power,
                        storage and extraction facilities you own with their
                        respective information. You also have the possibility to
                        upgrade (after you researched a technology that affects
                        this facility) or dismantle each instance.
                    </p>
                    <p>
                        At the bottom of the page you will find 3 other tables
                        with your levels of functional facilities, technologies
                        and other information.
                    </p>
                </div>
            </Modal>

            {/* Username */}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-primary">
                    {user?.username || "Player"}
                </h2>
            </div>

            {/* Power Facilities */}
            <section className="mb-8">
                <Card>
                    <CardTitle className="mb-4">Power Facilities</CardTitle>
                    <div className="overflow-x-auto">
                        <FacilityGroupTable
                            facilities={facilities.power_facilities}
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
                                    className: "text-center min-w-[150px]",
                                    render: (f) => {
                                        const colorVar = `--asset-color-${f.facility.toLowerCase().replace(/_/g, "-")}`;
                                        return (
                                            <div className="relative w-full min-w-[120px] h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full transition-all"
                                                    style={{
                                                        width: `${f.usage * 100}%`,
                                                        backgroundColor: `var(${colorVar})`,
                                                    }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-white">
                                                    {Math.round(f.usage * 100)}%
                                                </span>
                                            </div>
                                        );
                                    },
                                    renderSummary: (facilities) => {
                                        const avgUsage =
                                            facilities.reduce(
                                                (sum, f) => sum + f.usage,
                                                0,
                                            ) / facilities.length;
                                        const firstFacility = facilities[0];
                                        const colorVar = firstFacility
                                            ? `--asset-color-${firstFacility.facility.toLowerCase().replace(/_/g, "-")}`
                                            : null;
                                        return (
                                            <div className="relative w-full min-w-[120px] h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 dark:bg-green-400 transition-all"
                                                    style={{
                                                        width: `${avgUsage * 100}%`,
                                                        ...(colorVar && {
                                                            backgroundColor: `var(${colorVar})`,
                                                        }),
                                                    }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-white">
                                                    {Math.round(avgUsage * 100)}
                                                    %
                                                </span>
                                            </div>
                                        );
                                    },
                                },
                            ]}
                            emptyMessage="No power facilities built yet"
                        />
                    </div>
                </Card>
            </section>

            {/* Storage Facilities */}
            <section className="mb-8">
                <Card>
                    <CardTitle className="mb-4">Storage Facilities</CardTitle>
                    <div className="overflow-x-auto">
                        <FacilityGroupTable
                            facilities={facilities.storage_facilities}
                            columns={[
                                {
                                    header: "Capacity",
                                    className: "text-right",
                                    sortable: true,
                                    sortKey: "storage_capacity",
                                    render: (f) => (
                                        <span className="font-mono">
                                            {formatEnergy(f.storage_capacity)}
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
                                    className: "text-center min-w-[150px]",
                                    render: (f) => {
                                        const colorVar = `--asset-color-${f.facility.toLowerCase().replace(/_/g, "-")}`;
                                        return (
                                            <div className="relative w-full min-w-[120px] h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full transition-all"
                                                    style={{
                                                        width: `${f.state_of_charge * 100}%`,
                                                        backgroundColor: `var(${colorVar})`,
                                                    }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-white">
                                                    {Math.round(
                                                        f.state_of_charge * 100,
                                                    )}
                                                    %
                                                </span>
                                            </div>
                                        );
                                    },
                                    renderSummary: (facilities) => {
                                        const avgSOC =
                                            facilities.reduce(
                                                (sum, f) =>
                                                    sum + f.state_of_charge,
                                                0,
                                            ) / facilities.length;
                                        const firstFacility = facilities[0];
                                        const colorVar = firstFacility
                                            ? `--asset-color-${firstFacility.facility.toLowerCase().replace(/_/g, "-")}`
                                            : null;
                                        return (
                                            <div className="relative w-full min-w-[120px] h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 dark:bg-blue-400 transition-all"
                                                    style={{
                                                        width: `${avgSOC * 100}%`,
                                                        ...(colorVar && {
                                                            backgroundColor: `var(${colorVar})`,
                                                        }),
                                                    }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-white">
                                                    {Math.round(avgSOC * 100)}%
                                                </span>
                                            </div>
                                        );
                                    },
                                },
                            ]}
                            emptyMessage="No storage facilities built yet"
                        />
                    </div>
                </Card>
            </section>

            {/* Extraction Facilities */}
            <section className="mb-8">
                <Card>
                    <CardTitle className="mb-4">
                        Extraction Facilities
                    </CardTitle>
                    <div className="overflow-x-auto">
                        <FacilityGroupTable
                            facilities={facilities.extraction_facilities}
                            columns={[
                                {
                                    header: "Extraction Rate",
                                    className: "text-right",
                                    sortable: true,
                                    sortKey: "extraction_rate",
                                    render: (f) => (
                                        <span className="font-mono">
                                            {formatMassRate(f.extraction_rate)}
                                        </span>
                                    ),
                                    renderSummary: (facilities) => (
                                        <span className="font-mono">
                                            {formatMassRate(
                                                facilities.reduce(
                                                    (sum, f) =>
                                                        sum + f.extraction_rate,
                                                    0,
                                                ),
                                            )}
                                        </span>
                                    ),
                                },
                                {
                                    header: "Usage",
                                    className: "text-center min-w-[150px]",
                                    render: (f) => {
                                        const colorVar = `--asset-color-${f.facility.toLowerCase().replace(/_/g, "-")}`;
                                        return (
                                            <div className="relative w-full min-w-[120px] h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full transition-all"
                                                    style={{
                                                        width: `${f.usage * 100}%`,
                                                        backgroundColor: `var(${colorVar})`,
                                                    }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-white">
                                                    {Math.round(f.usage * 100)}%
                                                </span>
                                            </div>
                                        );
                                    },
                                    renderSummary: (facilities) => {
                                        const avgUsage =
                                            facilities.reduce(
                                                (sum, f) => sum + f.usage,
                                                0,
                                            ) / facilities.length;
                                        const firstFacility = facilities[0];
                                        const colorVar = firstFacility
                                            ? `--asset-color-${firstFacility.facility.toLowerCase().replace(/_/g, "-")}`
                                            : null;
                                        return (
                                            <div className="relative w-full min-w-[120px] h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-orange-500 dark:bg-orange-400 transition-all"
                                                    style={{
                                                        width: `${avgUsage * 100}%`,
                                                        ...(colorVar && {
                                                            backgroundColor: `var(${colorVar})`,
                                                        }),
                                                    }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-white">
                                                    {Math.round(avgUsage * 100)}
                                                    %
                                                </span>
                                            </div>
                                        );
                                    },
                                },
                            ]}
                            emptyMessage="No extraction facilities built yet"
                        />
                    </div>
                </Card>
            </section>
        </div>
    );
}
