/** Profile page - Overview of player assets and statistics. */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Modal, Card, CardTitle, Money } from "@components/ui";
import { FacilityGauge } from "@components/ui/FacilityGauge";
import { useFacilities } from "@hooks/useFacilities";
import { usePlayerProfile } from "@hooks/usePlayerProfile";
import { useHasCapability } from "@hooks/useCapabilities";
import { FacilityGroupTable } from "@components/profile/FacilityGroupTable";
import {
    formatPower,
    formatEnergy,
    formatMassRate,
    formatMass,
} from "@lib/format-utils";
import { dummyFacilities } from "@/data/dummyFacilities";

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
    const {
        data: facilities,
        isLoading: facilitiesLoading,
        error: facilitiesError,
    } = useFacilities();
    const {
        data: profile,
        isLoading: profileLoading,
        error: profileError,
    } = usePlayerProfile();
    const hasGreenhouseGasEffect = useHasCapability(
        "has_greenhouse_gas_effect",
    );

    // TEMPORARY: Set to true to showcase all asset colors with dummy data
    const SHOW_DUMMY_DATA = false;

    const isLoading = facilitiesLoading || profileLoading;
    const error = facilitiesError || profileError;

    if (isLoading && !SHOW_DUMMY_DATA) {
        return (
            <div className="p-4 md:p-8 text-center">
                <p className="text-lg">Loading profile...</p>
            </div>
        );
    }

    if (error && !SHOW_DUMMY_DATA) {
        return (
            <div className="p-4 md:p-8 text-center text-red-600">
                <p className="text-lg">Error loading profile</p>
            </div>
        );
    }

    const displayFacilities = SHOW_DUMMY_DATA ? dummyFacilities : facilities;

    if (!displayFacilities || !profile) {
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
                    {profile.username}
                </h2>
            </div>

            {/* Power Facilities */}
            <section className="mb-8">
                <Card>
                    <CardTitle className="mb-4">Power Facilities</CardTitle>
                    <div className="overflow-x-auto">
                        <FacilityGroupTable
                            facilities={displayFacilities.power_facilities}
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
                                    render: (f) => (
                                        <FacilityGauge
                                            facilityType={f.facility}
                                            value={f.usage * 100}
                                        />
                                    ),
                                    renderSummary: (facilities) => {
                                        const avgUsage =
                                            facilities.reduce(
                                                (sum, f) => sum + f.usage,
                                                0,
                                            ) / facilities.length;
                                        const firstFacility = facilities[0];
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

            {/* Storage Facilities */}
            <section className="mb-8">
                <Card>
                    <CardTitle className="mb-4">Storage Facilities</CardTitle>
                    <div className="overflow-x-auto">
                        <FacilityGroupTable
                            facilities={displayFacilities.storage_facilities}
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
                                    render: (f) => (
                                        <FacilityGauge
                                            facilityType={f.facility}
                                            value={f.state_of_charge * 100}
                                        />
                                    ),
                                    renderSummary: (facilities) => {
                                        const avgSOC =
                                            facilities.reduce(
                                                (sum, f) =>
                                                    sum + f.state_of_charge,
                                                0,
                                            ) / facilities.length;
                                        const firstFacility = facilities[0];
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

            {/* Extraction Facilities */}
            <section className="mb-8">
                <Card>
                    <CardTitle className="mb-4">
                        Extraction Facilities
                    </CardTitle>
                    <div className="overflow-x-auto">
                        <FacilityGroupTable
                            facilities={displayFacilities.extraction_facilities}
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
                                    render: (f) => (
                                        <FacilityGauge
                                            facilityType={f.facility}
                                            value={f.usage * 100}
                                        />
                                    ),
                                    renderSummary: (facilities) => {
                                        const avgUsage =
                                            facilities.reduce(
                                                (sum, f) => sum + f.usage,
                                                0,
                                            ) / facilities.length;
                                        const firstFacility = facilities[0];
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

            {/* Bottom section: Functional Facilities, Technologies, and Other Information */}
            <section className="mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Functional Facilities */}
                    <Card>
                        <CardTitle className="mb-4">
                            Functional Facilities
                        </CardTitle>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">Industry</td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile
                                                        .functional_facility_lvl
                                                        .industry
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Laboratory
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile
                                                        .functional_facility_lvl
                                                        .laboratory
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">Warehouse</td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile
                                                        .functional_facility_lvl
                                                        .warehouse
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3">
                                            Carbon Capture
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile
                                                        .functional_facility_lvl
                                                        .carbon_capture
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Technologies */}
                    <Card>
                        <CardTitle className="mb-4">Technologies</CardTitle>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Mathematics
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .mathematics
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Mechanical Engineering
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .mechanical_engineering
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Thermodynamics
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .thermodynamics
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">Physics</td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {profile.technology_lvl.physics}
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Building Technology
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .building_technology
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Mineral Extraction
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .mineral_extraction
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Transport Technology
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .transport_technology
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">Materials</td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .materials
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Civil Engineering
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .civil_engineering
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Aerodynamics
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .aerodynamics
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">Chemistry</td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .chemistry
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3">
                                            Nuclear Engineering
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            lvl{" "}
                                            <strong>
                                                {
                                                    profile.technology_lvl
                                                        .nuclear_engineering
                                                }
                                            </strong>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Other Information */}
                    <Card>
                        <CardTitle className="mb-4">
                            Other Information
                        </CardTitle>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">Network</td>
                                        <td className="py-2 px-3 text-center">
                                            {profile.network_name || "-"}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">Revenues</td>
                                        <td className="py-2 px-3 text-center">
                                            <Money
                                                amount={
                                                    profile.progression_metrics
                                                        .average_revenues
                                                }
                                            />{" "}
                                            /h
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">Max Power</td>
                                        <td className="py-2 px-3 text-center">
                                            {formatPower(
                                                profile.progression_metrics
                                                    .max_power_consumption,
                                            )}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Max Storage
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {formatEnergy(
                                                profile.progression_metrics
                                                    .max_energy_stored,
                                            )}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Imported Energy
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {formatEnergy(
                                                profile.progression_metrics
                                                    .imported_energy,
                                            )}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Exported Energy
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {formatEnergy(
                                                profile.progression_metrics
                                                    .exported_energy,
                                            )}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Extracted Resources
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {formatMass(
                                                profile.progression_metrics
                                                    .extracted_resources,
                                            )}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Bought Resources
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {formatMass(
                                                profile.progression_metrics
                                                    .bought_resources,
                                            )}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Sold Resources
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {formatMass(
                                                profile.progression_metrics
                                                    .sold_resources,
                                            )}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-3">
                                            Technology
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {
                                                profile.progression_metrics
                                                    .total_technologies
                                            }
                                        </td>
                                    </tr>
                                    <tr
                                        className={
                                            hasGreenhouseGasEffect
                                                ? "border-b border-gray-200 dark:border-gray-700"
                                                : ""
                                        }
                                    >
                                        <td className="py-2 px-3">XP</td>
                                        <td className="py-2 px-3 text-center">
                                            {Math.round(
                                                profile.progression_metrics.xp,
                                            )}
                                        </td>
                                    </tr>
                                    {hasGreenhouseGasEffect && (
                                        <>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <td className="py-2 px-3">
                                                    Emissions
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    {formatMass(
                                                        profile
                                                            .progression_metrics
                                                            .net_emissions,
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3">
                                                    Captured CO<sub>2</sub>
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    {formatMass(
                                                        profile
                                                            .progression_metrics
                                                            .captured_co2,
                                                    )}
                                                </td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </section>
        </div>
    );
}
