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
    useJoinElectricityMarket,
    useElectricityMarkets,
    useElectricityMarket,
} from "@/hooks/use-electricity-markets";
import { usePlayerMoney } from "@/hooks/use-player-money";
import { useMyId } from "@/hooks/use-players";

interface JoinMarketDialogProps {
    isOpen: boolean;
    onClose: () => void;
    marketId: number | null;
}

export function JoinMarketDialog({
    isOpen,
    onClose,
    marketId,
}: JoinMarketDialogProps) {
    const [error, setError] = useState<string | null>(null);
    const { mutate: joinMarket, isPending } = useJoinElectricityMarket();
    const { data: marketsData } = useElectricityMarkets();
    const myId = useMyId();
    const { data: moneyData } = usePlayerMoney();
    const hasInsufficientFunds = (moneyData?.money ?? 1) <= 0;

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

    // Reset state when dialog closes
    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (marketId === null) return;
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <form onSubmit={handleConfirm} id="join-market-form">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Join Market</DialogTitle>
                        <DialogDescription>
                            Join {marketName} and start trading electricity with
                            other members.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Error message */}
                        {error && (
                            <InfoBanner variant="error" className="text-sm">
                                {error}
                            </InfoBanner>
                        )}

                        {/* Insufficient funds warning */}
                        {hasInsufficientFunds && (
                            <InfoBanner variant="error">
                                <div>
                                    <p className="font-semibold mb-1">
                                        Insufficient funds
                                    </p>
                                    <p className="text-sm">
                                        Your balance must be positive to join a
                                        network. Recover your finances before
                                        rejoining.
                                    </p>
                                </div>
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
                                        By joining an electricity market, you'll
                                        be able to trade electricity with other
                                        market members at negotiated prices.
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
                                        will be permanently deleted when you
                                        join{" "}
                                        <span className="font-semibold">
                                            {marketName}
                                        </span>
                                        .
                                    </p>
                                </div>
                            </InfoBanner>
                        )}

                        {/* Confirmation text */}
                        <p>
                            Are you sure you want to join{" "}
                            <span className="font-semibold">{marketName}</span>?
                        </p>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={isPending}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            form="join-market-form"
                            variant={isPending ? "outline" : "default"}
                            disabled={isPending || hasInsufficientFunds}
                            className="flex items-center gap-2"
                        >
                            {isPending && <Spinner />}
                            Join Market
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
}
