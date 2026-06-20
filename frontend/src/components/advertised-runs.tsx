import { ChevronRight } from "lucide-react";

import { TypographyH2, TypographyMuted } from "@/components/ui/typography";
import { useAdvertisedInstances } from "@/hooks/use-instances";
import { instanceSignupHref, type InstanceFragment } from "@/lib/instances";

function runningSince(startsAt: string): string | null {
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
    }).format(date);
}

function RunCard({ instance }: { instance: InstanceFragment }) {
    const since = runningSince(instance.starts_at);
    return (
        <a
            href={instanceSignupHref(instance)}
            className="bg-card text-foreground border border-border p-5 rounded-4xl flex flex-row justify-between items-center gap-4 shadow-md hover:bg-muted hover:shadow-lg active:scale-[0.99] transition-all"
        >
            <div className="flex flex-col">
                <p className="text-lg font-semibold">{instance.name}</p>
                {since && (
                    <TypographyMuted>Running since {since}</TypographyMuted>
                )}
            </div>
            <div className="flex flex-row items-center gap-1 text-primary shrink-0">
                <p className="font-semibold">Sign up</p>
                <ChevronRight />
            </div>
        </a>
    );
}

/**
 * Lists the advertised instances ("runs") a new player can join, each linking
 * to that instance's signup. Renders nothing when no manifest is available
 * (interim, before Apache serves `/instances.json`) or when no instance is
 * advertised — the static "Play now" CTA still covers returning players in that
 * case.
 */
export function AdvertisedRuns() {
    const { instances } = useAdvertisedInstances();
    if (instances.length === 0) return null;

    return (
        <section className="max-w-6xl mx-auto w-full flex flex-col gap-6">
            <TypographyH2 className="text-primary text-center">
                Join a Run
            </TypographyH2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {instances.map((instance) => (
                    <RunCard key={instance.slug} instance={instance} />
                ))}
            </div>
        </section>
    );
}
