import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { Modal } from "@/components/ui/Modal";
import {
    useLeaveElectricityMarket,
    useElectricityMarketForPlayer,
} from "@/hooks/useElectricityMarkets";
import { useMe } from "@/hooks/usePlayers";

interface LeaveMarketModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LeaveMarketModal({ isOpen, onClose }: LeaveMarketModalProps) {
    const [error, setError] = useState<string | null>(null);
    const { mutate: leaveMarket, isPending } = useLeaveElectricityMarket();

    const player = useMe();
    const market = useElectricityMarketForPlayer(player?.id);

    const isLastMember = market?.member_ids.length === 1;

    // Reset state when modal closes
    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleConfirm = () => {
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
            <Modal isOpen={isOpen} onClose={handleClose} title="Leave Market">
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
                        <span className="font-semibold">{market.name}</span>?
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
                                    will be permanently deleted when you leave.
                                </p>
                            </div>
                        </InfoBanner>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 justify-end pt-4 border-t border-border">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirm}
                            disabled={isPending}
                        >
                            {isPending ? "Leaving..." : "Leave Market"}
                        </Button>
                    </div>
                </div>
            </Modal>
        )
    );
}
