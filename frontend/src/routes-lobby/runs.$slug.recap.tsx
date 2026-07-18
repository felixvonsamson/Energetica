/**
 * The v1 baseline recap page — renders a run's published recap (the frozen
 * leaderboard tombstone minted at `active → freeze`, G1/T5) once it exists.
 *
 * Deliberately baseline, not the full spec: identity header, income-ranked
 * leaderboard, totals footer. No map/tile snapshot — the minted recap payload
 * (`energetica/schemas/recap.py`) carries no tile data, so that's deferred to a
 * future amendment rather than guessed at here (see #864 discussion).
 *
 * PROTOTYPE (#864, T6): the actual rendering below the loading/error/empty
 * states is currently a `?variant=A|B|C` switch between three UI variants
 * (`components/lobby/recap-variants/`) — see `.agents/skills/prototype/UI.md`.
 * Once a variant is picked, delete the losing variants, the switcher, this
 * search param, and fold the winner in as the only rendering.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Trophy } from "lucide-react";

import {
    PrototypeSwitcher,
    type VariantKey,
} from "@/components/lobby/recap-variants/prototype-switcher";
import { VariantACards } from "@/components/lobby/recap-variants/variant-a-cards";
import { VariantBPodium } from "@/components/lobby/recap-variants/variant-b-podium";
import { VariantCDenseTable } from "@/components/lobby/recap-variants/variant-c-dense-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoBanner } from "@/components/ui/info-banner";
import { Spinner } from "@/components/ui/spinner";
import { useRecap } from "@/hooks/use-lobby";

function validateVariantSearch(search: Record<string, unknown>): {
    variant: VariantKey;
} {
    const v = search.variant;
    return { variant: v === "B" || v === "C" ? v : "A" };
}

export const Route = createFileRoute("/runs/$slug/recap")({
    validateSearch: validateVariantSearch,
    component: RecapPage,
    staticData: { title: "Run recap" },
});

function RecapPage() {
    const { slug } = Route.useParams();
    const { variant } = Route.useSearch();
    const recap = useRecap(slug);

    if (recap.isPending) {
        return (
            <div className="flex justify-center py-24">
                <Spinner />
            </div>
        );
    }

    if (recap.isError) {
        return (
            <div className="py-12 max-w-md mx-auto">
                <InfoBanner variant="error">
                    Couldn&apos;t load the recap for this run. Try again in a
                    moment.
                </InfoBanner>
            </div>
        );
    }

    if (recap.data === null) {
        return (
            <div className="py-12">
                <BackLink />
                <EmptyState
                    icon={Trophy}
                    title="No recap yet"
                    description="This run hasn't frozen yet — its recap will appear here once play ends."
                />
            </div>
        );
    }

    const data = recap.data;
    // Only "A" is used in a production build — see the module docstring.
    const shown = import.meta.env.PROD ? "A" : variant;

    return (
        <div className="flex flex-col gap-8 py-8">
            <BackLink />

            {shown === "A" && <VariantACards data={data} />}
            {shown === "B" && <VariantBPodium data={data} />}
            {shown === "C" && <VariantCDenseTable data={data} />}

            {!import.meta.env.PROD && <PrototypeSwitcher current={variant} />}
        </div>
    );
}

function BackLink() {
    return (
        <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
        >
            <ArrowLeft className="w-4 h-4" />
            Back to lobby
        </Link>
    );
}
