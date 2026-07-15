/**
 * In-run switcher: hop between the account's settled runs, or open the lobby.
 *
 * Top-right control next to Logout (docs/architecture/lobby.md § Flows). Fed by
 * the instance's own `my-runs` read, so it lists the same "your runs" the lobby
 * picker shows. Each run is a cross-origin `<a href>` to `{slug}.{apex}/app`;
 * the current run is marked and non-navigating. "Open lobby" always appears — a
 * just-provisioned player with no settled run yet still needs a way out.
 */

import { ArrowLeftRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyRuns } from "@/hooks/use-my-runs";
import { currentRunSlug, lobbyHref, runAppHref } from "@/lib/instances";
import { isSingleOriginHost } from "@/lib/single-origin";

export function RunSwitcher() {
    const { data: runs } = useMyRuns();
    // On a single-origin proxy host (e.g. energetica.ethz.ch) exactly one run is
    // reachable and the lobby is the same origin, so every entry this control
    // offers — lateral run-hops and "Open lobby" — is a no-op that lands back on
    // this same app. Hide it entirely. See lib/single-origin.ts + ADR-0002.
    if (isSingleOriginHost()) return null;
    const here = currentRunSlug();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Switch run">
                    <ArrowLeftRight size={20} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                {runs && runs.length > 0 && (
                    <>
                        <DropdownMenuLabel>Your runs</DropdownMenuLabel>
                        {runs.map((run) => {
                            const isCurrent =
                                here !== null && run.slug === here;
                            if (isCurrent) {
                                return (
                                    <DropdownMenuItem
                                        key={run.slug}
                                        disabled
                                        className="flex items-center justify-between gap-2"
                                    >
                                        <span className="truncate">
                                            {run.name}
                                        </span>
                                        <Check size={16} />
                                    </DropdownMenuItem>
                                );
                            }
                            return (
                                <DropdownMenuItem key={run.slug} asChild>
                                    <a
                                        href={runAppHref(run.slug)}
                                        className="truncate"
                                    >
                                        {run.name}
                                    </a>
                                </DropdownMenuItem>
                            );
                        })}
                        <DropdownMenuSeparator />
                    </>
                )}
                <DropdownMenuItem asChild>
                    <a href={lobbyHref("/")}>Open lobby</a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
