import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui";
import {
    useCreateElectricityMarket,
    useElectricityMarketForPlayer,
} from "@/hooks/useElectricityMarkets";
import { useMe } from "@/hooks/usePlayers";

interface CreateMarketModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateMarketModal({ isOpen, onClose }: CreateMarketModalProps) {
    const [marketName, setMarketName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { mutate: createMarket, isPending } = useCreateElectricityMarket();
    const me = useMe();
    const currentMarket = useElectricityMarketForPlayer(me?.id);

    // Reset state when modal closes
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
        currentMarket &&
        currentMarket !== null &&
        currentMarket.member_ids.length === 1;

    const handleCreateMarket = () => {
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
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Create Electricity Market"
        >
            <div className="space-y-0 flex flex-col">
                {/* Error message */}
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm mb-4 animate-in fade-in duration-200">
                        {error}
                    </div>
                )}

                {/* Market name input */}
                <div className="pb-4">
                    <label htmlFor="market-name" className="block mb-2">
                        Market name
                        <span className="text-red-600 dark:text-red-400">
                            {" "}
                            *
                        </span>
                    </label>
                    <input
                        id="market-name"
                        type="text"
                        value={marketName}
                        onChange={(e) => {
                            setMarketName(e.target.value);
                            setError(null);
                        }}
                        placeholder="Enter market name"
                        className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition ${
                            hasNameError
                                ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20 focus:ring-red-500 dark:focus:ring-red-500"
                                : "border-gray-300 dark:border-dark-border dark:bg-dark-bg-tertiary focus:ring-pine dark:focus:ring-brand-green"
                        }`}
                    />
                    <div className="h-6 mt-1">
                        {isNameTooShort && (
                            <p className="text-sm text-red-600 dark:text-red-400 animate-in fade-in duration-200">
                                Market name must be at least 3 characters
                            </p>
                        )}
                        {isNameTooLong && (
                            <p className="text-sm text-red-600 dark:text-red-400 animate-in fade-in duration-200">
                                Market name must be at most 40 characters
                            </p>
                        )}
                    </div>
                </div>

                {/* Warning: Already in market */}
                {currentMarket && !willDeleteCurrentMarket && (
                    <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-lg flex gap-3 mb-4 animate-in fade-in duration-200">
                        <AlertTriangle className="w-5 h-5 text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                                You'll leave your current market
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                Creating a new market will automatically remove
                                you from{" "}
                                <span className="font-semibold">
                                    {currentMarket.name}
                                </span>
                                .
                            </p>
                        </div>
                    </div>
                )}

                {/* Warning: Will delete current market */}
                {willDeleteCurrentMarket && (
                    <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg flex gap-3 mb-4 animate-in fade-in duration-200">
                        <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-700 dark:text-red-400 mb-1">
                                Market will be permanently deleted
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                As you are the last member of{" "}
                                <span className="font-semibold">
                                    {currentMarket.name}
                                </span>
                                , it will be permanently deleted when you create
                                a new market.
                            </p>
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="border-t border-gray-200 dark:border-dark-border pt-4">
                    <Button
                        onClick={handleCreateMarket}
                        disabled={isPending || isNameMissing || hasNameError}
                        className="w-full transition-opacity"
                    >
                        {isPending ? "Creating..." : "Create Market"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
