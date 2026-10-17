/**
 * Where the Recap (#1013) is shown. Players read it on its own page, which the
 * timeline opens when the Round ends. The facilitator also gets a Recap button
 * in the top bar, which opens the latest Recap in a large dialog over whatever
 * page they are on, so the rest of the UI stays within reach. The dialog can
 * open the Recap in a new window, for a projector.
 */

import { useRouter } from "@tanstack/react-router";
import { ExternalLink, Newspaper } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { TypographyMuted } from "@/components/ui/typography";
import { RecapNewspaper } from "@/components/workshop/recap-newspaper";
import { useWorkshopRecap } from "@/hooks/use-workshop";
import { ApiClientError, isGameError } from "@/lib/api-client";
import { recapPage } from "@/lib/workshop-timeline";

/** The Recap that closes `round`, or why it cannot be shown yet. */
export function RecapForRound({ round }: { round: number }) {
    const recap = useWorkshopRecap(round);

    if (recap.isError) {
        const error =
            recap.error instanceof ApiClientError ? recap.error : null;
        const notOpen =
            isGameError(error?.detail) &&
            error.detail.game_exception_type === "WORKSHOP_RECAP_NOT_OPEN";
        return (
            <TypographyMuted>
                {error?.status === 404
                    ? `The session has no Round ${round}.`
                    : notOpen
                      ? `The Recap of Round ${round} opens once the Round is over.`
                      : "The Recap could not be loaded."}
            </TypographyMuted>
        );
    }
    if (recap.isPending)
        return (
            <div className="flex justify-center py-12">
                <Spinner />
            </div>
        );
    return <RecapNewspaper recap={recap.data} />;
}

/**
 * The facilitator's Recap button: opens Round `round`'s Recap over the current
 * page.
 */
export function RecapButton({ round }: { round: number }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    // The Recap's page in a window of its own, without the Workshop's chrome.
    const windowUrl = router.buildLocation({
        ...recapPage(round),
        search: { window: 1 },
    }).href;

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                aria-label="Recap"
                onClick={() => setOpen(true)}
            >
                <Newspaper className="size-4" />
                {/* On a phone, the icon alone, so the top bar fits. */}
                <span className="hidden md:inline">Recap</span>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[96vw] flex-col sm:max-w-[96vw] md:max-w-[96vw] xl:max-w-[96vw]">
                    <div className="flex flex-wrap items-center gap-2 pr-8">
                        <DialogTitle>Round {round} recap</DialogTitle>
                        <DialogDescription>
                            Players see the same page.
                        </DialogDescription>
                        <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto"
                            onClick={() => {
                                window.open(
                                    windowUrl,
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
                    <div className="min-h-0 flex-1 overflow-auto bg-background p-2 md:p-6">
                        <RecapForRound round={round} />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
