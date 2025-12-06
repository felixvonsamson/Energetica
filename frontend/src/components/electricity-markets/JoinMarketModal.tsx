import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
    useJoinElectricityMarket,
    useElectricityMarkets,
    useElectricityMarket,
} from "@/hooks/useElectricityMarkets";
import { useMyId } from "@/hooks/usePlayers";

interface JoinMarketModalProps {
    isOpen: boolean;
    onClose: () => void;
    marketId: number;
}

export function JoinMarketModal({
    isOpen,
    onClose,
    marketId,
}: JoinMarketModalProps) {
    const [error, setError] = useState<string | null>(null);
    const { mutate: joinMarket, isPending } = useJoinElectricityMarket();
    const { data: marketsData } = useElectricityMarkets();
    const myId = useMyId();

    const market = useElectricityMarket(marketId);
    const marketName = market?.name ?? null;

    const currentMarketId =
        marketsData?.electricity_markets.find((m) =>
            m.member_ids.includes(myId ?? -1),
        )?.id ?? null;
    const currentMarket = useElectricityMarket(currentMarketId ?? -1);
    const currentMarketName = currentMarket?.name ?? null;
    const currentMarketMemberCount = currentMarket?.member_ids.length ?? null;

    const isAlreadyInMarket = currentMarketId !== null;
    const willDeleteCurrentNetwork =
        isAlreadyInMarket && currentMarketMemberCount === 1;

    // Reset state when modal closes
    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleConfirm = () => {
        setError(null);
        joinMarket(marketId, {
            onSuccess: () => {
                onClose();
            },
            onError: (error: unknown) => {
                let errorMessage = "Failed to join market. Please try again.";

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
        <Modal isOpen={isOpen} onClose={handleClose} title="Join Market">
            <div className="space-y-4">
                {/* Error message */}
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm animate-in fade-in duration-200">
                        {error}
                    </div>
                )}

                {/* Info about what joining entails - for new players */}
                {!isAlreadyInMarket && (
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-700 rounded-lg flex gap-3 animate-in fade-in duration-200">
                        <Info className="w-5 h-5 text-blue-700 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
                                Joining a market
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                By joining an electricity market, you'll be able
                                to trade electricity with other market members
                                at negotiated prices.
                            </p>
                        </div>
                    </div>
                )}

                {/* Warning about leaving current market */}
                {isAlreadyInMarket && (
                    <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-lg flex gap-3 animate-in fade-in duration-200">
                        <AlertTriangle className="w-5 h-5 text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                                You'll leave your current market
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                Joining{" "}
                                <span className="font-semibold">
                                    {marketName}
                                </span>{" "}
                                will automatically remove you from{" "}
                                <span className="font-semibold">
                                    {currentMarketName}
                                </span>
                                .
                            </p>
                        </div>
                    </div>
                )}

                {/* Warning about deleting current market */}
                {willDeleteCurrentNetwork && (
                    <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg flex gap-3 animate-in fade-in duration-200">
                        <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-700 dark:text-red-400 mb-1">
                                Market will be permanently deleted
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                As you are its last member,{" "}
                                <span className="font-semibold">
                                    {currentMarketName}
                                </span>{" "}
                                will be permanently deleted when you join{" "}
                                <span className="font-semibold">
                                    {marketName}
                                </span>
                                .
                            </p>
                        </div>
                    </div>
                )}

                {/* Confirmation text */}
                <div className="text-white">
                    <p>
                        Are you sure you want to join{" "}
                        <span className="font-semibold">{marketName}</span>?
                    </p>
                </div>

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
                        className="px-4 py-2 rounded-lg bg-pine dark:bg-brand-green hover:bg-pine/80 dark:hover:bg-brand-green/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
                    >
                        {isPending ? "Joining..." : "Join Market"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
