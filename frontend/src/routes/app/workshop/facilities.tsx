/**
 * The Workshop facility page (#998): the catalog of facilities players can buy
 * now, and the player's own fleet, both as playing cards. Open at every point
 * in the session. During the Investment phase, the player picks facilities from
 * the catalog into a selection shown above it, which is bought when the phase
 * closes (#999). A storage type whose retired facilities leave stored energy
 * that nothing holds gets a warning under its price tag, until the selection
 * holds it (#1001). Players only: a facilitator moderates rather than plays, so
 * is sent back to the Workshop home.
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
import { InvestmentSelection } from "@/components/workshop/investment-selection";
import { StoredEnergyWarning } from "@/components/workshop/stored-energy-warning";
import {
    useAddToSelection,
    useInvestmentOpen,
    useRemoveFromSelection,
    useWorkshopEntry,
    useWorkshopFacilities,
    useWorkshopFleet,
    useWorkshopSelection,
} from "@/hooks/use-workshop";
import { fleetStacks } from "@/lib/workshop-fleet";
import type { ApiSchema } from "@/types/api-helpers";

type Tab = "catalog" | "fleet";
type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;
type OwnedFacility = ApiSchema<"WorkshopOwnedFacilityOut">;
type WorkshopSelection = ApiSchema<"WorkshopSelectionOut">;

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
    const selection = useWorkshopSelection();

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
            {facilities.isError ||
            fleet.isError ||
            // Only the catalog shows the selection.
            (tab === "catalog" && selection.isError) ? (
                <InfoBanner variant="error">
                    Could not load the facilities. They are retried every few
                    seconds.
                </InfoBanner>
            ) : !facilities.data || !fleet.data ? (
                <Loading />
            ) : tab === "fleet" ? (
                <Fleet facilities={facilities.data} fleet={fleet.data} />
            ) : !selection.data ? (
                <Loading />
            ) : (
                <Catalog
                    facilities={facilities.data}
                    fleet={fleet.data}
                    selection={selection.data}
                />
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
    selection,
}: {
    facilities: WorkshopFacility[];
    fleet: OwnedFacility[];
    selection: WorkshopSelection;
}) {
    const investmentOpen = useInvestmentOpen();
    const add = useAddToSelection();
    const remove = useRemoveFromSelection();
    const moneyLeft = selection.money - selection.total_cost;

    return (
        <div className="space-y-8">
            {/* Kept while a closed phase's selection waits to be bought. */}
            {(investmentOpen || selection.facilities.length > 0) && (
                <InvestmentSelection
                    facilities={facilities}
                    selection={selection}
                    investmentOpen={investmentOpen}
                    onRemove={(facility) => remove.mutate(facility)}
                />
            )}
            <div className={GRID}>
                {/* Facilities the player owns but can no longer buy are only on the fleet tab. */}
                {facilities
                    .filter((facility) => facility.for_sale)
                    .map((facility) => {
                        const energyAtRisk =
                            selection.stored_energy_at_risk[facility.id];
                        return (
                            <div
                                key={facility.id}
                                className="row-span-2 grid grid-rows-subgrid justify-items-center gap-0"
                            >
                                <div className="relative flex items-center">
                                    {/*
                                     * The top of the price tag's string. It runs from
                                     * behind the card's middle to the bottom of the row,
                                     * so it meets the card's bottom edge however much
                                     * shorter than the row the card is.
                                     */}
                                    <div className="absolute top-1/2 bottom-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground" />
                                    <FacilityCard facility={facility} />
                                </div>
                                {/* The cell's second row, under the card. */}
                                <div className="flex flex-col items-center">
                                    <FacilityPriceTag
                                        facility={facility}
                                        owned={
                                            fleet.filter(
                                                (owned) =>
                                                    owned.facility ===
                                                    facility.id,
                                            ).length
                                        }
                                        selected={
                                            selection.facilities.filter(
                                                (id) => id === facility.id,
                                            ).length
                                        }
                                        investmentOpen={investmentOpen}
                                        affordable={
                                            facility.base_price <= moneyLeft
                                        }
                                        onAdd={() => add.mutate(facility.id)}
                                        adding={add.isPending}
                                    />
                                    {investmentOpen &&
                                        energyAtRisk !== undefined && (
                                            <StoredEnergyWarning
                                                energyAtRisk={energyAtRisk}
                                            />
                                        )}
                                </div>
                            </div>
                        );
                    })}
            </div>
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
                // The list has every facility the player owns, even one no
                // longer for sale, so this always finds one.
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
