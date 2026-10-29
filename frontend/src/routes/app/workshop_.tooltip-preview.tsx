/**
 * A preview of every Workshop tooltip (#1400), at
 * `/app/workshop/tooltip-preview`, for checking their wording without playing
 * a session to the point where each one shows. The real components render
 * here, but from made-up data in a query cache of their own, so the page never
 * reads or changes the Run. It is public, so it needs no sign-in.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";

import { BalanceSheetView } from "@/components/workshop/balance-sheet";
import { FacilityCard } from "@/components/workshop/facility-card";
import {
    FacilityPriceTag,
    usePriceTag,
} from "@/components/workshop/facility-price-tag";
import { FuelOrders } from "@/components/workshop/fuel-orders";
import { Scoreboard } from "@/components/workshop/scoreboard";
import {
    PREVIEW_BALANCE_SHEET,
    PREVIEW_ENTRY,
    PREVIEW_FUEL,
    PREVIEW_SCOREBOARD,
    PREVIEW_VOTE,
    previewSession,
} from "@/components/workshop/tooltip-preview/data";
import { PREVIEW_FACILITIES } from "@/components/workshop/tooltip-preview/facilities";
import { queryKeys } from "@/lib/query-client";
import type { ApiSchema } from "@/types/api-helpers";
import {
    TypographyH1,
    TypographyH2,
    TypographyMuted,
} from "@energetica/ui/components/typography";

export const Route = createFileRoute("/app/workshop_/tooltip-preview")({
    component: TooltipPreviewPage,
    staticData: {
        title: "Tooltip preview",
        routeConfig: { requiredRole: null },
        runMode: "any",
    },
});

/** A query cache holding the made-up data, which it never refetches. */
function previewClient(taxInForce: boolean): QueryClient {
    const client = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: Infinity,
                retry: false,
                refetchOnMount: false,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
            },
        },
    });
    client.setQueryData(queryKeys.workshop.entry, PREVIEW_ENTRY);
    client.setQueryData(
        queryKeys.workshop.session,
        previewSession(taxInForce),
    );
    client.setQueryData(queryKeys.workshop.vote, PREVIEW_VOTE);
    client.setQueryData(queryKeys.workshop.fuel, PREVIEW_FUEL);
    client.setQueryData(queryKeys.workshop.facilities, PREVIEW_FACILITIES);
    client.setQueryData(queryKeys.workshop.scoreboard, PREVIEW_SCOREBOARD);
    return client;
}

function Preview({
    taxInForce,
    children,
}: {
    taxInForce: boolean;
    children: ReactNode;
}) {
    const [client] = useState(() => previewClient(taxInForce));
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function TooltipPreviewPage() {
    return (
        <div className="flex flex-col gap-10 p-6">
            <div>
                <TypographyH1>Tooltip preview</TypographyH1>
                <TypographyMuted>
                    Every Workshop tooltip, from made-up data. Hover anything
                    with an info mark, and the volumes and rates of the balance
                    sheet&apos;s detailed view.
                </TypographyMuted>
            </div>

            <Section
                title="Facility cards, no carbon tax"
                note="No tooltip on the emissions. The price tags name the construction time and pollution on hover."
            >
                <Preview taxInForce={false}>
                    <CardGrid />
                </Preview>
            </Section>

            <Section
                title="Facility cards, carbon tax in force"
                note="Only the emitting facilities: their emissions now have a tooltip."
            >
                <Preview taxInForce>
                    <CardGrid
                        filter={(facility) => facility.base_pollution > 0}
                    />
                </Preview>
            </Section>

            <Section
                title="Fuel in the bids panel"
                note="Coal is shocked and ran out last season; gas is burned; uranium is not."
            >
                <Preview taxInForce={false}>
                    <div className="max-w-md">
                        <FuelOrders
                            fuels={PREVIEW_FUEL.fuels}
                            procurement={PREVIEW_FUEL.procurement}
                            open={false}
                            showOrders
                        />
                    </div>
                </Preview>
            </Section>

            <Section
                title="Scoreboard"
                note="With teams and a bonus multiplier, so the Bonus header shows too."
            >
                <Preview taxInForce={false}>
                    <Scoreboard />
                </Preview>
            </Section>

            <Section
                title="Balance sheet"
                note="Switch on the detailed view. Wind dumps, coal burns bought fuel only, gas burns fuel from stock in summer, batteries buy energy. Spring has excess coal and construction CO₂, summer a blackout and a revenue tax."
            >
                <BalanceSheetView
                    sheet={PREVIEW_BALANCE_SHEET}
                    activeRound={2}
                />
            </Section>
        </div>
    );
}

function Section({
    title,
    note,
    children,
}: {
    title: string;
    note: string;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <TypographyH2>{title}</TypographyH2>
                <TypographyMuted>{note}</TypographyMuted>
            </div>
            {children}
        </section>
    );
}

function CardGrid({
    filter = () => true,
}: {
    filter?: (facility: ApiSchema<"WorkshopFacilityOut">) => boolean;
}) {
    return (
        <div className="flex flex-wrap gap-6">
            {PREVIEW_FACILITIES.filter(filter).map((facility) => (
                <div key={facility.id} className="flex flex-col items-center">
                    <FacilityCard facility={facility} />
                    <PreviewPriceTag facility={facility} />
                </div>
            ))}
        </div>
    );
}

function PreviewPriceTag({
    facility,
}: {
    facility: ApiSchema<"WorkshopFacilityOut">;
}) {
    const tag = usePriceTag({
        facility,
        owned: 0,
        selected: 0,
        investmentOpen: false,
        affordable: true,
        onAdd: () => {},
        adding: false,
    });
    return <FacilityPriceTag tag={tag} />;
}
