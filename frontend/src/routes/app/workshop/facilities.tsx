/**
 * The Workshop facility page (#998): the catalog of facilities players can buy
 * now, and the player's own fleet, both as playing cards. Open at every point
 * in the session. Buying lands in #999. Players only: a facilitator moderates
 * rather than plays, so is sent back to the Workshop home.
 *
 * Cards differ in height, since storage and fuel-burning facilities have more
 * stats. Each grid cell is a two-row subgrid: the card is centred in the first
 * row and its price tag (or, in the fleet, an opened stack) lines up in the
 * second.
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Layers } from "lucide-react";

import { EmptyState, InfoBanner } from "@/components/ui";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { Spinner } from "@/components/ui/spinner";
import { TypographyH2 } from "@/components/ui/typography";
import { FacilityCard } from "@/components/workshop/facility-card";
import { FacilityPriceTag } from "@/components/workshop/facility-price-tag";
import { FleetStack } from "@/components/workshop/fleet-stack";
import {
    useWorkshopEntry,
    useWorkshopFacilities,
    useWorkshopFleet,
} from "@/hooks/use-workshop";
import { fleetStacks } from "@/lib/workshop-fleet";
import type { ApiSchema } from "@/types/api-helpers";

type Tab = "catalog" | "fleet";
type WorkshopFacility = ApiSchema<"WorkshopFacility">;
type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;

export const Route = createFileRoute("/app/workshop/facilities")({
    component: FacilitiesPage,
    staticData: { title: "Facilities", runMode: "workshop" },
    validateSearch: (search: Record<string, unknown>): { tab?: "fleet" } => ({
        tab: search.tab === "fleet" ? "fleet" : undefined,
    }),
});

const GRID =
    "grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] justify-items-center gap-x-6 gap-y-10";

function FacilitiesPage() {
    const { data: entry } = useWorkshopEntry();
    if (!entry) return <Loading />;
    if (entry.role !== "player") return <Navigate to="/app/workshop" replace />;
    return <PlayerFacilities />;
}

function PlayerFacilities() {
    const navigate = Route.useNavigate();
    const { tab = "catalog" } = Route.useSearch();
    const facilities = useWorkshopFacilities();
    const fleet = useWorkshopFleet();

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <TypographyH2>Facilities</TypographyH2>
                <SegmentedPicker<Tab>
                    value={tab}
                    onValueChange={(next) =>
                        navigate({
                            search: {
                                tab: next === "fleet" ? "fleet" : undefined,
                            },
                            replace: true,
                        })
                    }
                >
                    <SegmentedPickerOption value="catalog">
                        Catalog
                    </SegmentedPickerOption>
                    <SegmentedPickerOption value="fleet">
                        Your fleet
                    </SegmentedPickerOption>
                </SegmentedPicker>
            </div>
            {facilities.isError || fleet.isError ? (
                <InfoBanner variant="error">
                    Could not load the facilities. They are retried every few
                    seconds.
                </InfoBanner>
            ) : !facilities.data || !fleet.data ? (
                <Loading />
            ) : tab === "catalog" ? (
                <Catalog facilities={facilities.data} fleet={fleet.data} />
            ) : (
                <Fleet facilities={facilities.data} fleet={fleet.data} />
            )}
        </div>
    );
}

function Loading() {
    return (
        <div className="flex justify-center py-12">
            <Spinner />
        </div>
    );
}

function Catalog({
    facilities,
    fleet,
}: {
    facilities: WorkshopFacility[];
    fleet: OwnedFacility[];
}) {
    return (
        <div className={GRID}>
            {facilities.map((facility) => (
                <div
                    key={facility.id}
                    className="row-span-2 grid grid-rows-subgrid justify-items-center gap-0"
                >
                    <div className="flex items-center">
                        <FacilityCard facility={facility} />
                    </div>
                    <FacilityPriceTag
                        facility={facility}
                        owned={
                            fleet.filter(
                                (owned) => owned.facility === facility.id,
                            ).length
                        }
                    />
                </div>
            ))}
        </div>
    );
}

function Fleet({
    facilities,
    fleet,
}: {
    facilities: WorkshopFacility[];
    fleet: OwnedFacility[];
}) {
    if (fleet.length === 0) {
        return (
            <EmptyState
                icon={Layers}
                title="You don't own any facilities yet"
                description="Facilities you buy in the Investment phase show up here."
            />
        );
    }
    const byId = new Map(facilities.map((facility) => [facility.id, facility]));
    return (
        <div className={GRID}>
            {fleetStacks(fleet).map((stack) => {
                // Only an available facility can have been bought, and none is
                // ever taken off the catalog, so this always finds one.
                const facility = byId.get(stack.facility);
                return (
                    facility && (
                        <FleetStack
                            key={stack.facility}
                            facility={facility}
                            stack={stack}
                        />
                    )
                );
            })}
        </div>
    );
}
