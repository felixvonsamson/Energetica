/**
 * PROTOTYPE — wipe me. Hosts the Recap page variants (#1013).
 *
 * Three variants of the Recap, switchable via `?variant=` on the existing
 * `/app/workshop/recap/$round` route, with mock data picked by `?scenario=`.
 * The facilitator can also open the same Recap over any page from the top bar,
 * and pop it out to its own window (`?popout=1`) for a projector.
 */

import { ExternalLink, Newspaper } from "lucide-react";
import { useState } from "react";

import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import {
    isScenarioKey,
    type RecapScenario,
    SCENARIOS,
    type ScenarioKey,
} from "./prototype-data";
import { VariantGazette } from "./variant-a-gazette";
import { VariantStage } from "./variant-b-stage";
import { VariantBriefing } from "./variant-c-briefing";

export const RECAP_VARIANTS = [
    { key: "A", name: "Gazette" },
    { key: "B", name: "Stage" },
    { key: "C", name: "Briefing" },
];

const VARIANT_COMPONENTS: Record<
    string,
    (props: { scenario: RecapScenario }) => React.ReactNode
> = {
    A: VariantGazette,
    B: VariantStage,
    C: VariantBriefing,
};

export interface RecapChoice {
    variant: string;
    scenario: ScenarioKey;
}

const STORAGE_KEY = "recap-prototype-choice";

/** The last variant and scenario picked on the route, for the dialog. */
export function rememberChoice(choice: RecapChoice) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
        // ignore
    }
}

function recalledChoice(): RecapChoice {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
        return {
            variant:
                parsed.variant in VARIANT_COMPONENTS ? parsed.variant : "A",
            scenario: isScenarioKey(parsed.scenario) ? parsed.scenario : "busy",
        };
    } catch {
        return { variant: "A", scenario: "busy" };
    }
}

export function RecapVariant({ choice }: { choice: RecapChoice }) {
    const Component = VARIANT_COMPONENTS[choice.variant] ?? VariantGazette;
    // Keyed so a new scenario starts the Stage variant from its first slide.
    return (
        <Component
            key={choice.scenario}
            scenario={SCENARIOS[choice.scenario]}
        />
    );
}

/** The floating switcher, with a scenario picker for the mock data. */
export function RecapSwitcher({
    choice,
    onChange,
}: {
    choice: RecapChoice;
    onChange: (choice: RecapChoice) => void;
}) {
    return (
        <PrototypeSwitcher
            variants={RECAP_VARIANTS}
            current={choice.variant}
            onChange={(variant) => onChange({ ...choice, variant })}
        >
            {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange({ ...choice, scenario: key })}
                    className={
                        key === choice.scenario
                            ? "rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs"
                            : "rounded-full px-2 py-0.5 text-xs hover:bg-white/15"
                    }
                >
                    {SCENARIOS[key].label}
                </button>
            ))}
        </PrototypeSwitcher>
    );
}

export function popoutUrl(round: number, choice: RecapChoice) {
    const params = new URLSearchParams({
        variant: choice.variant,
        scenario: choice.scenario,
        popout: "1",
    });
    return `/app/workshop/recap/${round}?${params}`;
}

/**
 * The facilitator's Recap button: opens the Recap over whatever page they are
 * on, so the console stays one click away, and pops it out to its own window.
 */
export function RecapPrototypeToggle({ round }: { round: number }) {
    const [open, setOpen] = useState(false);
    const [choice, setChoice] = useState(recalledChoice);

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    setChoice(recalledChoice());
                    setOpen(true);
                }}
            >
                <Newspaper className="size-4" />
                Recap
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="h-[92vh] max-h-[92vh] w-[96vw] max-w-[96vw] content-start sm:max-w-[96vw] md:max-w-[96vw] xl:max-w-[96vw]">
                    <div className="flex items-center gap-2 pr-8">
                        <DialogTitle>Round {round} recap</DialogTitle>
                        <span className="text-xs text-muted-foreground">
                            Players see the same page. Variant and scenario
                            follow the last pick on the recap route.
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto"
                            onClick={() => {
                                window.open(
                                    popoutUrl(round, choice),
                                    "energetica-recap",
                                    "popup,width=1280,height=800",
                                );
                                setOpen(false);
                            }}
                        >
                            <ExternalLink className="size-4" />
                            Open in new window
                        </Button>
                    </div>
                    <RecapVariant choice={choice} />
                </DialogContent>
            </Dialog>
        </>
    );
}
