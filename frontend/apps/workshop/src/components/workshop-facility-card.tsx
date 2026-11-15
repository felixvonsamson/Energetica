/**
 * The facility card from @energetica/facility-cards, with what its tooltips
 * need loaded from the session: this season's fuel prices, the carbon tax and
 * the session's Rounds. Every place in the Workshop that shows a card uses
 * this, so every card gets its tooltips.
 */

import { FacilityCard } from "@energetica/facility-cards/components/facility-card";
import type { TooltipInputs } from "@energetica/facility-cards/lib/facility-card-data";
import type { ComponentProps } from "react";

import {
    useWorkshopFuel,
    useWorkshopSession,
    useWorkshopVote,
} from "@/hooks/use-workshop";
import { nextBuyRound } from "@/lib/workshop-metrics";

export function WorkshopFacilityCard(
    props: Omit<ComponentProps<typeof FacilityCard>, "tooltipInputs">,
) {
    const tooltipInputs = useTooltipInputs();
    return <FacilityCard {...props} tooltipInputs={tooltipInputs} />;
}

/**
 * The fuel prices are this season's, or the catalog prices before the first
 * season, and are left out until they load, as is the tax rate.
 */
function useTooltipInputs(): TooltipInputs {
    const { data: fuel } = useWorkshopFuel();
    const { data: session } = useWorkshopSession();
    const { data: vote } = useWorkshopVote();
    return {
        fuelPrices: Object.fromEntries(
            (fuel?.fuels ?? []).map((line) => [line.fuel, line.price]),
        ),
        taxRate: vote?.tax_rate ?? null,
        taxInForce: (session?.carbon_tax_since ?? null) !== null,
        buyRound: session
            ? nextBuyRound(session.checkpoint, session.round_count)
            : null,
        roundCount: session?.round_count ?? null,
    };
}
