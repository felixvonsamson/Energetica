/**
 * The picker's run cards — the lobby's signature element. Two tiers sharing one
 * frame (the landing's `RunCard` idiom, so returning players recognise it):
 * "your runs" carry a pine icon tile and a "Continue" affordance; "open runs"
 * stay quieter with a "Join" affordance.
 *
 * Both render as plain `<a href>`: run links are cross-origin
 * (`{slug}.{apex}/app`), and the logged-out variant's `/login?return={slug}` is
 * an internal path where a full page load is harmless.
 */

import { ChevronRight, Zap } from "lucide-react";

import { TypographyMuted } from "@/components/ui/typography";
import type { MyRun } from "@/lib/api/lobby";
import { derivePhase, type InstanceFragment } from "@/lib/instances";
import { runAppHref } from "@/lib/lobby";

/** "March 2026" from an ISO timestamp, or null when unparseable. */
function formatMonthYear(iso: string): string | null {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
    }).format(date);
}

function RunCardFrame({
    href,
    cta,
    children,
}: {
    href: string;
    cta: string;
    children: React.ReactNode;
}) {
    return (
        <a
            href={href}
            className="bg-card text-foreground border border-border p-5 rounded-4xl flex flex-row justify-between items-center gap-4 shadow-md hover:bg-muted hover:shadow-lg active:scale-[0.99] transition-all"
        >
            {children}
            <div className="flex flex-row items-center gap-1 text-primary shrink-0">
                <p className="font-semibold">{cta}</p>
                <ChevronRight />
            </div>
        </a>
    );
}

/** An emphasized card for a run the account has settled in. */
export function MyRunCard({ run }: { run: MyRun }) {
    const joined = formatMonthYear(run.settled_at);
    return (
        <RunCardFrame href={runAppHref(run.slug)} cta="Continue">
            <div className="flex flex-row items-center gap-4 min-w-0">
                <div className="bg-primary/10 text-primary rounded-2xl p-3 shrink-0">
                    <Zap className="w-6 h-6" />
                </div>
                <div className="flex flex-col min-w-0">
                    <p className="text-lg font-semibold truncate">{run.name}</p>
                    {joined && (
                        <TypographyMuted>Joined {joined}</TypographyMuted>
                    )}
                </div>
            </div>
        </RunCardFrame>
    );
}

/**
 * A quieter card for an advertised run the account has not joined. Logged in it
 * links straight into the run; logged out it routes through the lobby login,
 * carrying the run as the validated `?return=` slug.
 */
export function OpenRunCard({
    instance,
    loggedIn,
}: {
    instance: InstanceFragment;
    loggedIn: boolean;
}) {
    const when = formatMonthYear(instance.starts_at);
    // An announced run advertises before it's playable (#862, T4): the fragment is published at
    // creation with a future `starts_at`, so the card must say "Starts …", not "Running since …".
    const label =
        derivePhase(instance) === "announced" ? "Starts" : "Running since";
    const href = loggedIn
        ? runAppHref(instance.slug)
        : `/login?return=${encodeURIComponent(instance.slug)}`;
    return (
        <RunCardFrame href={href} cta="Join">
            <div className="flex flex-col min-w-0">
                <p className="text-lg font-semibold truncate">
                    {instance.name}
                </p>
                {when && (
                    <TypographyMuted>
                        {label} {when}
                    </TypographyMuted>
                )}
            </div>
        </RunCardFrame>
    );
}
