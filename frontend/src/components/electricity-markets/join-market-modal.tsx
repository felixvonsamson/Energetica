import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InfoBanner } from "@/components/ui/info-banner";
import { Modal } from "@/components/ui/modal";
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
                    <InfoBanner variant="error" className="text-sm">
                        {error}
                    </InfoBanner>
                )}

                {/* Info about what joining entails - for new players */}
                {!isAlreadyInMarket && (
                    <InfoBanner variant="info">
                        <div>
                            <p className="font-semibold mb-1">
                                Joining a market
                            </p>
                            <p className="text-sm">
                                By joining an electricity market, you'll be able
                                to trade electricity with other market members
                                at negotiated prices.
                            </p>
                        </div>
                    </InfoBanner>
                )}

                {/* Warning about leaving current market */}
                {isAlreadyInMarket && (
                    <InfoBanner variant="warning">
                        <div>
                            <p className="font-semibold mb-1">
                                You'll leave your current market
                            </p>
                            <p className="text-sm">
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
                    </InfoBanner>
                )}

                {/* Warning about deleting current market */}
                {willDeleteCurrentNetwork && (
                    <InfoBanner variant="error">
                        <div>
                            <p className="font-semibold mb-1">
                                Market will be permanently deleted
                            </p>
                            <p className="text-sm">
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
                    </InfoBanner>
                )}

                {/* Confirmation text */}
                <div className="text-white">
                    <p>
                        Are you sure you want to join{" "}
                        <span className="font-semibold">{marketName}</span>?
                    </p>
                </div>

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
                        variant="primary"
                        onClick={handleConfirm}
                        disabled={isPending}
                    >
                        {isPending ? "Joining..." : "Join Market"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
