/**
 * A Round's overview page. PROTOTYPE (#1008): three layouts for the Round's
 * balance sheet, switchable with `?variant=A|B|C`, on sample data picked with
 * `?scenario=partial|full|blackout`. `?future=1` shows the rows for features
 * that don't exist yet (revenue tax, fuel, carbon tax).
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PrototypeSwitcher } from "@/components/prototype/prototype-switcher";
import {
    SCENARIOS,
    type Scenario,
    sampleRound,
} from "@/components/workshop/round-overview-prototype/data";
import { LedgerVariant } from "@/components/workshop/round-overview-prototype/variant-ledger";
import { TimelineVariant } from "@/components/workshop/round-overview-prototype/variant-timeline";
import { WaterfallVariant } from "@/components/workshop/round-overview-prototype/variant-waterfall";

const VARIANTS = [
    { key: "A", name: "Ledger" },
    { key: "B", name: "Waterfall, one period at a time" },
    { key: "C", name: "Timeline cards" },
] as const;
type VariantKey = (typeof VARIANTS)[number]["key"];

interface Search {
    variant?: VariantKey;
    scenario?: Scenario;
    future?: 1;
}

export const Route = createFileRoute("/app/workshop/round/$round/")({
    component: RoundOverviewPage,
    staticData: { title: "Round overview", runMode: "workshop" },
    validateSearch: (search: Record<string, unknown>): Search => ({
        variant: VARIANTS.find((v) => v.key === search.variant)?.key,
        scenario: SCENARIOS.find((s) => s === search.scenario),
        future: search.future === 1 || search.future === "1" ? 1 : undefined,
    }),
});

function RoundOverviewPage() {
    const { round } = Route.useParams();
    const { variant = "A", scenario = "partial", future } = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });
    const set = (patch: Partial<Search>) =>
        void navigate({
            search: (prev) => ({ ...prev, ...patch }),
            replace: true,
        });

    const data = sampleRound(scenario, Number(round) || 1);
    const props = { round: data, futureRows: future === 1 };

    return (
        <div className="pb-24">
            {variant === "A" && <LedgerVariant {...props} />}
            {variant === "B" && <WaterfallVariant {...props} />}
            {variant === "C" && <TimelineVariant {...props} />}
            <PrototypeSwitcher
                variants={[...VARIANTS]}
                current={variant}
                onChange={(key) => set({ variant: key })}
            >
                <select
                    value={scenario}
                    onChange={(e) =>
                        set({ scenario: e.target.value as Scenario })
                    }
                    className="rounded bg-white/10 px-1.5 py-0.5 text-xs"
                >
                    {SCENARIOS.map((s) => (
                        <option key={s} value={s} className="text-black">
                            {s}
                        </option>
                    ))}
                </select>
                <label className="flex items-center gap-1 text-xs">
                    <input
                        type="checkbox"
                        checked={future === 1}
                        onChange={(e) =>
                            set({ future: e.target.checked ? 1 : undefined })
                        }
                    />
                    future rows
                </label>
            </PrototypeSwitcher>
        </div>
    );
}
