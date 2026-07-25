/**
 * The picker's run cards — the lobby's signature element. Two tiers sharing one
 * frame (the landing's `RunCard` idiom, so returning players recognise it):
 * "your runs" carry a pine icon tile and a "Continue" affordance; "open runs"
 * stay quieter with a "Join" affordance.
 *
 * Both render as plain `<a href>`: run links are cross-origin
 * (`{slug}.{apex}/app`), and the logged-out variant's `/login?return={slug}` is
 * an internal path where a full page load is harmless.
 *
 * Once a run reaches `freeze` (its recap is minted and published, T5/G1), both
 * cards grow a secondary "View recap" row — a same-origin, in-lobby route, so
 * it uses TanStack Router's `Link` rather than the frame's cross-origin `<a>`.
 * It sits alongside, not instead of, the primary action: freeze keeps the live
 * instance up and readable (G2), so "Continue"/"Join" into the live run is
 * still meaningful even after the recap exists.
 */

import { Link } from "@tanstack/react-router";
import { ChevronRight, FileClock, Zap } from "lucide-react";

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

/** The "View recap" row, shown once a run's recap can exist (`freeze`/`ended`). */
function ViewRecapRow({ slug }: { slug: string }) {
    return (
        <Link
            to="/runs/$slug/recap"
            params={{ slug }}
            className="flex flex-row items-center gap-1.5 px-5 py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors border-t border-border"
        >
            <FileClock className="w-4 h-4" />
            View recap
        </Link>
    );
}

function RunCardFrame({
    href,
    cta,
    slug,
    phase,
    children,
}: {
    href: string;
    cta: string;
    slug: string;
    phase: ReturnType<typeof derivePhase>;
    children: React.ReactNode;
}) {
    const recapAvailable = phase === "freeze" || phase === "ended";
    return (
        <div className="bg-card text-foreground border border-border rounded-4xl shadow-md overflow-hidden">
            <a
                href={href}
                className="p-5 flex flex-row justify-between items-center gap-4 hover:bg-muted transition-all"
            >
                {children}
                <div className="flex flex-row items-center gap-1 text-primary shrink-0">
                    <p className="font-semibold">{cta}</p>
                    <ChevronRight />
                </div>
            </a>
            {recapAvailable && <ViewRecapRow slug={slug} />}
        </div>
    );
}

/** An emphasized card for a run the account has settled in. */
export function MyRunCard({ run }: { run: MyRun }) {
    const joined = formatMonthYear(run.settled_at);
    return (
        <RunCardFrame
            href={runAppHref(run.slug)}
            cta="Continue"
            slug={run.slug}
            phase={derivePhase(run)}
        >
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
    const phase = derivePhase(instance);
    // An announced run advertises before it's playable (#862, T4): the fragment is published at
    // creation with a future `starts_at`, so the card must say "Starts …", not "Running since …".
    const label = phase === "announced" ? "Starts" : "Running since";
    const href = loggedIn
        ? runAppHref(instance.slug)
        : `/login?return=${encodeURIComponent(instance.slug)}`;
    return (
        <RunCardFrame href={href} cta="Join" slug={instance.slug} phase={phase}>
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
