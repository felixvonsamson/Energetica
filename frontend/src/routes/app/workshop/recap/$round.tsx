/**
 * The recap that closes a Round. PROTOTYPE (#1013): renders the Recap variants
 * on mock data, switchable with `?variant=` and `?scenario=`. `?popout=1`
 * covers the Workshop chrome, for a projector window.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
    isScenarioKey,
    type ScenarioKey,
} from "@/components/workshop/recap-prototype/prototype-data";
import {
    type RecapChoice,
    RecapSwitcher,
    RecapVariant,
    rememberChoice,
} from "@/components/workshop/recap-prototype/recap-prototype";

export const Route = createFileRoute("/app/workshop/recap/$round")({
    component: RecapPage,
    staticData: { title: "Recap", runMode: "workshop", wide: true },
    validateSearch: (
        search: Record<string, unknown>,
    ): { variant?: string; scenario?: ScenarioKey; popout?: 1 } => ({
        variant:
            typeof search.variant === "string" ? search.variant : undefined,
        scenario: isScenarioKey(search.scenario) ? search.scenario : undefined,
        popout: search.popout ? 1 : undefined,
    }),
});

function RecapPage() {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });
    const choice: RecapChoice = {
        variant: search.variant ?? "A",
        scenario: search.scenario ?? "busy",
    };
    rememberChoice(choice);

    const change = (next: RecapChoice) =>
        void navigate({
            search: { ...search, ...next },
            replace: true,
        });

    const page = (
        <>
            <RecapVariant choice={choice} />
            <RecapSwitcher choice={choice} onChange={change} />
        </>
    );
    if (search.popout)
        return (
            <div className="fixed inset-0 z-50 overflow-auto bg-background p-4 pb-20 md:p-8">
                {page}
            </div>
        );
    return <div className="pb-16">{page}</div>;
}
