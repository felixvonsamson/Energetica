import { AlertTriangle } from "lucide-react";
import { useState } from "react";

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
                        <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm animate-in fade-in duration-200">
                            {error}
                        </div>
                    )}

                    {/* Confirmation text */}
                    <div className="text-white">
                        <p>
                            Are you sure you want to leave{" "}
                            <span className="font-semibold">{market.name}</span>
                            ?
                        </p>
                    </div>

                    {/* Last member warning - two separate divs */}
                    {isLastMember && (
                        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg flex gap-3 animate-in fade-in duration-200">
                            <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-red-700 dark:text-red-400 mb-1">
                                    Market will be permanently deleted
                                </p>
                                <p className="text-sm text-red-700 dark:text-red-400">
                                    You are the last member of{" "}
                                    <span className="font-semibold">
                                        {market.name}
                                    </span>
                                    .
                                </p>
                                <p className="text-sm text-red-700 dark:text-red-400">
                                    <span className="font-semibold">
                                        {market.name}
                                    </span>{" "}
                                    will be permanently deleted when you leave.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 justify-end pt-4 border-t border-white/20">
                        <button
                            onClick={onClose}
                            disabled={isPending}
                            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-900 dark:bg-dark-bg-tertiary dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-dark-bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isPending}
                            className="px-4 py-2 rounded-lg bg-alert-red hover:bg-alert-red/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
                        >
                            {isPending ? "Leaving..." : "Leave Market"}
                        </button>
                    </div>
                </div>
            </Modal>
        )
    );
}
