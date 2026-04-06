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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
    useCreateElectricityMarket,
    useElectricityMarketForPlayer,
} from "@/hooks/use-electricity-markets";
import { usePlayerMoney } from "@/hooks/use-player-money";
import { useMe } from "@/hooks/use-players";

interface CreateMarketDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateMarketDialog({
    isOpen,
    onClose,
}: CreateMarketDialogProps) {
    const [marketName, setMarketName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { mutate: createMarket, isPending } = useCreateElectricityMarket();
    const me = useMe();
    const currentMarket = useElectricityMarketForPlayer(me?.id);
    const { data: moneyData } = usePlayerMoney();
    const hasInsufficientFunds = (moneyData?.money ?? 1) <= 0;

    // Reset state when dialog closes
    const handleClose = () => {
        setMarketName("");
        setError(null);
        onClose();
    };

    const isNameMissing = !marketName.trim();
    const isNameTooShort =
        marketName.trim().length > 0 && marketName.length < 3;
    const isNameTooLong = marketName.length > 40;
    const hasNameError = isNameTooShort || isNameTooLong;
    const willDeleteCurrentMarket =
        currentMarket && currentMarket.member_ids.length === 1;

    const handleCreateMarket = (e: React.FormEvent) => {
        e.preventDefault();
        if (isNameMissing || hasNameError) return;

        setError(null);
        createMarket(
            { name: marketName },
            {
                onSuccess: () => {
                    handleClose();
                },
                onError: (error: unknown) => {
                    let errorMessage =
                        "Failed to create market. Please try again.";

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
            },
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <form onSubmit={handleCreateMarket} id="create-market-form">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Electricity Market</DialogTitle>
                        <DialogDescription>
                            Create a new market to trade electricity with other
                            players.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {error && (
                            <InfoBanner variant="error">{error}</InfoBanner>
                        )}

                        {hasInsufficientFunds && (
                            <InfoBanner variant="error">
                                <div>
                                    <p className="font-semibold mb-1">
                                        Insufficient funds
                                    </p>
                                    <p className="text-sm">
                                        Your balance must be positive to create
                                        or join a network. Recover your finances
                                        first.
                                    </p>
                                </div>
                            </InfoBanner>
                        )}

                        <div className="grid gap-3">
                            <Label htmlFor="market-name">
                                Market name
                                <span className="text-destructive"> *</span>
                            </Label>
                            <Input
                                id="market-name"
                                type="text"
                                value={marketName}
                                onChange={(e) => {
                                    setMarketName(e.target.value);
                                    setError(null);
                                }}
                                placeholder="Enter market name"
                                aria-invalid={hasNameError}
                            />
                            {isNameTooShort && (
                                <p className="text-sm text-destructive">
                                    Market name must be at least 3 characters
                                </p>
                            )}
                            {isNameTooLong && (
                                <p className="text-sm text-destructive">
                                    Market name must be at most 40 characters
                                </p>
                            )}
                        </div>

                        {currentMarket && !willDeleteCurrentMarket && (
                            <InfoBanner variant="warning">
                                <div>
                                    <p className="font-semibold mb-1">
                                        You'll leave your current market
                                    </p>
                                    <p className="text-sm">
                                        Creating a new market will automatically
                                        remove you from{" "}
                                        <span className="font-semibold">
                                            {currentMarket.name}
                                        </span>
                                        .
                                    </p>
                                </div>
                            </InfoBanner>
                        )}

                        {willDeleteCurrentMarket && (
                            <InfoBanner variant="error">
                                <div>
                                    <p className="font-semibold mb-1">
                                        Market will be permanently deleted
                                    </p>
                                    <p className="text-sm">
                                        As you are the last member of{" "}
                                        <span className="font-semibold">
                                            {currentMarket.name}
                                        </span>
                                        , it will be permanently deleted when
                                        you create a new market.
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
                            form="create-market-form"
                            variant={isPending ? "outline" : "default"}
                            disabled={
                                isPending || isNameMissing || hasNameError || hasInsufficientFunds
                            }
                            className="flex items-center gap-2"
                        >
                            {isPending && <Spinner />}
                            Create Market
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
}
