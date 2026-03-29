import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { InfoBanner } from "@/components/ui/info-banner";
import { Spinner } from "@/components/ui/spinner";
import {
    useLeaveElectricityMarket,
    useElectricityMarketForPlayer,
} from "@/hooks/use-electricity-markets";
import { useMe } from "@/hooks/use-players";

interface LeaveMarketDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LeaveMarketDialog({ isOpen, onClose }: LeaveMarketDialogProps) {
    const [error, setError] = useState<string | null>(null);
    const { mutate: leaveMarket, isPending } = useLeaveElectricityMarket();

    const player = useMe();
    const market = useElectricityMarketForPlayer(player?.id);

    const isLastMember = market?.member_ids.length === 1;

    // Reset state when dialog closes
    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!market) return;
        setError(null);
        leaveMarket(market.id, {
            onSuccess: () => {
                onClose();
            },
            onError: (error: unknown) => {
                let errorMessage = "Failed to leave market. Please try again.";

                if (typeof error === "object" && error !== null) {
                    const err = error as Record<string, unknown>;
                    if (
                        typeof err.response === "object" &&
                        err.response !== null
                    ) {
                        const response = err.response as Record<
                            string,
                            unknown
                        >;
                        if (
                            typeof response.data === "object" &&
                            response.data !== null
                        ) {
                            const data = response.data as Record<
                                string,
                                unknown
                            >;
                            if (typeof data.detail === "string") {
                                errorMessage = data.detail;
                            }
                        }
                    } else if (typeof err.message === "string") {
                        errorMessage = err.message;
                    }
                }

                setError(errorMessage);
            },
        });
    };

    return (
        market && (
            <Dialog
                open={isOpen}
                onOpenChange={(open) => !open && handleClose()}
            >
                <form onSubmit={handleConfirm} id="leave-market-form">
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Leave Market</DialogTitle>
                            <DialogDescription>
                                Leave {market.name} and stop trading with its
                                members.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Error message */}
                            {error && (
                                <InfoBanner variant="error" className="text-sm">
                                    {error}
                                </InfoBanner>
                            )}

                            {/* Confirmation text */}
                            <p>
                                Are you sure you want to leave{" "}
                                <span className="font-semibold">
                                    {market.name}
                                </span>
                                ?
                            </p>

                            {/* Last member warning */}
                            {isLastMember && (
                                <InfoBanner variant="warning">
                                    <div>
                                        <p className="font-semibold mb-1">
                                            Market will be permanently deleted
                                        </p>
                                        <p className="text-sm">
                                            You are the last member of{" "}
                                            <span className="font-semibold">
                                                {market.name}
                                            </span>
                                            .
                                        </p>
                                        <p className="text-sm">
                                            <span className="font-semibold">
                                                {market.name}
                                            </span>{" "}
                                            will be permanently deleted when you
                                            leave.
                                        </p>
                                    </div>
                                </InfoBanner>
                            )}
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" disabled={isPending}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                form="leave-market-form"
                                variant={isPending ? "outline" : "destructive"}
                                disabled={isPending}
                                className="flex items-center gap-2"
                            >
                                {isPending && <Spinner />}
                                Leave Market
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </form>
            </Dialog>
        )
    );
}
