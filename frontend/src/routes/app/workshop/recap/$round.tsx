/**
 * The Recap that closes a Round (#1013). With `?window=1`, it covers the
 * Workshop's chrome, for a window of its own on a projector.
 */

import { createFileRoute } from "@tanstack/react-router";

import { RecapForRound } from "@/components/workshop/recap-view";

export const Route = createFileRoute("/app/workshop/recap/$round")({
    component: RecapPage,
    staticData: { title: "Recap", runMode: "workshop", wide: true },
    validateSearch: (search: Record<string, unknown>): { window?: 1 } =>
        search.window ? { window: 1 } : {},
});

function RecapPage() {
    const { round } = Route.useParams();
    const search = Route.useSearch();
    const recap = <RecapForRound round={Number(round)} />;
    if (search.window)
        return (
            <div className="fixed inset-0 z-50 overflow-auto bg-background p-4 md:p-8">
                {recap}
            </div>
        );
    return <div className="pb-16">{recap}</div>;
}
