/**
 * PROTOTYPE — throwaway. Answers #998: what should Workshop's facility catalog
 * look like as playing cards, and how should a fleet stack open to show each
 * copy's remaining lifetime? See `.claude/skills/prototype/UI.md`.
 *
 * Four variants, switchable via `?variant=A|B|C|D` or the floating bottom bar.
 * D is the default: Felix's mix of the other three after the first review.
 *
 * - A — Top Trumps: uniform grid, stat table, dashed "cost to buy" ticket; the
 *   stack slides open in place and pushes the page down.
 * - B — Pokémon on a shop shelf: category shelves, gradient frames, holo
 *   upgrades, shelf-edge price label; the stack opens in an overlay.
 * - C — Collector's binder: dark cards with comparison stat bars, a hanging price
 *   tag; the stack fans out over the grid without moving it.
 *
 * Workshop has no catalog page yet, and its real pages need a running Workshop
 * Run, so this lives under `/app/internal/` (prototype sub-shape B). All data
 * is mock (`-prototype-facility-cards/mock.ts`). Nothing calls the backend.
 *
 * Delete this route, its folder and `components/dev/prototype-switcher.tsx`
 * once a variant is picked and folded into the real page.
 */

import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSwitcher } from "@/components/dev/prototype-switcher";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";

import { type Reveal, visibleCatalog } from "./-prototype-facility-cards/mock";
import { VariantA } from "./-prototype-facility-cards/variant-a";
import { VariantB } from "./-prototype-facility-cards/variant-b";
import { VariantC } from "./-prototype-facility-cards/variant-c";
import { VariantD } from "./-prototype-facility-cards/variant-d";

type Tab = "catalog" | "fleet";

export const Route = createFileRoute("/app/internal/prototype-facility-cards")({
    component: PrototypeFacilityCards,
    staticData: {
        title: "Prototype — facility cards",
        routeConfig: { requiredRole: null },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): { variant?: string; tab?: Tab; reveal?: Reveal } => ({
        variant:
            typeof search.variant === "string" ? search.variant : undefined,
        tab: search.tab === "fleet" ? "fleet" : undefined,
        reveal:
            search.reveal === "upgrades" || search.reveal === "everything"
                ? search.reveal
                : undefined,
    }),
});

const VARIANTS = {
    D: VariantD,
    A: VariantA,
    B: VariantB,
    C: VariantC,
} as const;
const NAMES = {
    A: "Top Trumps",
    B: "Pokémon shelf",
    C: "Collector's binder",
    D: "Mix after review",
};

function PrototypeFacilityCards() {
    const navigate = Route.useNavigate();
    const search = Route.useSearch();
    const variant = (
        search.variant && search.variant in VARIANTS ? search.variant : "D"
    ) as keyof typeof VARIANTS;
    const tab = search.tab ?? "catalog";
    const reveal = search.reveal ?? "base";
    const Variant = VARIANTS[variant];

    const set = (patch: Partial<typeof search>) =>
        navigate({ search: { ...search, ...patch }, replace: true });

    return (
        <div className="min-h-svh bg-background pb-24">
            <style>{`
                @keyframes proto-holo {
                    0% { background-position: 0% 0%; }
                    100% { background-position: 250% 250%; }
                }
            `}</style>
            {/* Stand-in for the Workshop top bar, which needs a live Run. */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2 text-sm">
                <span className="font-semibold">
                    Workshop · Round 3 · Investment
                </span>
                <span className="text-muted-foreground">
                    Mock data — prototype for #998
                </span>
            </div>
            <div className="mx-auto max-w-[1400px] p-4 md:p-8">
                <div className="mb-6 flex flex-wrap items-center gap-4">
                    <SegmentedPicker<Tab>
                        value={tab}
                        onValueChange={(t) =>
                            set({ tab: t === "fleet" ? "fleet" : undefined })
                        }
                    >
                        <SegmentedPickerOption value="catalog">
                            Catalog
                        </SegmentedPickerOption>
                        <SegmentedPickerOption value="fleet">
                            Your fleet
                        </SegmentedPickerOption>
                    </SegmentedPicker>
                    {tab === "catalog" && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            Mock unlocks:
                            <SegmentedPicker<Reveal>
                                value={reveal}
                                onValueChange={(r) =>
                                    set({
                                        reveal: r === "base" ? undefined : r,
                                    })
                                }
                            >
                                <SegmentedPickerOption value="base">
                                    Base tier only
                                </SegmentedPickerOption>
                                <SegmentedPickerOption value="upgrades">
                                    + upgrades
                                </SegmentedPickerOption>
                                <SegmentedPickerOption value="everything">
                                    + CSP &amp; full season
                                </SegmentedPickerOption>
                            </SegmentedPicker>
                        </div>
                    )}
                    {tab === "fleet" && (
                        <span className="text-xs text-muted-foreground">
                            Click a stack to see each copy&apos;s remaining
                            lifetime.
                        </span>
                    )}
                </div>
                <Variant tab={tab} catalog={visibleCatalog(reveal)} />
            </div>
            <PrototypeSwitcher
                variants={Object.keys(VARIANTS)}
                current={variant}
                names={NAMES}
                onChange={(v) => set({ variant: v })}
            />
        </div>
    );
}
