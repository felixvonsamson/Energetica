/**
 * THROWAWAY PROTOTYPE ROUTE — recap page look, issue #864 (T6).
 *
 * Three structurally different takes on the retrospective recap page (ADR-0005:
 * a retrospective, not a scoreboard), switchable via `?variant=A|B|C` and the
 * floating bar (or ←/→). Mock data (see `../components/lobby/recap-prototype/
 * mock.ts`) — no fetch, no backend. `bun run dev:lobby`, then
 * `/recap-prototype`.
 *
 * Delete this route + `components/lobby/recap-prototype/` once a variant wins.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { makeMockRecap } from "@/components/lobby/recap-prototype/mock";
import {
    PrototypeSwitcher,
    VariantKey,
} from "@/components/lobby/recap-prototype/prototype-switcher";
import { VariantA } from "@/components/lobby/recap-prototype/variant-a-ledger";
import { VariantB } from "@/components/lobby/recap-prototype/variant-b-facets";
import { VariantC } from "@/components/lobby/recap-prototype/variant-c-atlas";

type Search = { variant: VariantKey };

export const Route = createFileRoute("/recap-prototype")({
    validateSearch: (search: Record<string, unknown>): Search => {
        const v = search.variant;
        return { variant: v === "B" || v === "C" ? v : "A" };
    },
    component: RecapPrototypePage,
    staticData: { title: "Recap prototype" },
});

function RecapPrototypePage() {
    const { variant } = Route.useSearch();
    const recap = useMemo(() => makeMockRecap(), []);

    return (
        <>
            {variant === "A" && <VariantA recap={recap} />}
            {variant === "B" && <VariantB recap={recap} />}
            {variant === "C" && <VariantC recap={recap} />}
            {import.meta.env.DEV && <PrototypeSwitcher current={variant} />}
        </>
    );
}
