import { Modal, Money } from "@components/ui";
import { usePurchaseAsk } from "@hooks/useResourceMarket";
import { formatMass } from "@lib/format-utils";
import { useState } from "react";
import { RESOURCE_LABELS, ResourceType } from "@app-types/resource-market";

export interface PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    ask: {
        id: number;
        resource_type: string;
        quantity: number;
        unit_price: number;
    };
}

export function PurchaseModal({ isOpen, onClose, ask }: PurchaseModalProps) {
    const [buyAll, setBuyAll] = useState(true);
    const [quantity, setQuantity] = useState((ask.quantity / 1000).toString());

    const purchaseMutation = usePurchaseAsk();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await purchaseMutation.mutateAsync({
                askId: ask.id,
                quantity: buyAll ? undefined : parseFloat(quantity) * 1000,
            });
            onClose();
        } catch (error) {
            console.error("Failed to purchase:", error);
        }
    };

    const maxQuantityTons = ask.quantity / 1000;
    const purchaseQuantityTons = buyAll
        ? maxQuantityTons
        : parseFloat(quantity || "0");
    const totalCost = purchaseQuantityTons * ask.unit_price * 1000;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Purchase Resources">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Ask details */}
                <div className="bg-tan-green/20 dark:bg-dark-bg-tertiary/50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                        <span className="font-semibold">Resource:</span>
                        <span className="capitalize">
                            {RESOURCE_LABELS[ask.resource_type as ResourceType]}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-semibold">Available:</span>
                        <span className="font-mono">
                            {formatMass(ask.quantity)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-semibold">Price per ton:</span>
                        <Money amount={ask.unit_price * 1000} />
                    </div>
                </div>

                {/* Purchase amount selection */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium">
                        Purchase Amount
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setBuyAll(true)}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                                buyAll
                                    ? "bg-brand-green text-white"
                                    : "bg-gray-200 dark:bg-dark-bg-tertiary text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-bg-secondary"
                            }`}
                        >
                            Buy All
                        </button>
                        <button
                            type="button"
                            onClick={() => setBuyAll(false)}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                                !buyAll
                                    ? "bg-brand-green text-white"
                                    : "bg-gray-200 dark:bg-dark-bg-tertiary text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-bg-secondary"
                            }`}
                        >
                            Custom Amount
                        </button>
                    </div>

                    {/* Custom amount input */}
                    {!buyAll && (
                        <div className="space-y-2">
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                min="0.01"
                                max={maxQuantityTons}
                                step="0.01"
                                placeholder="Enter quantity in tons"
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg-secondary focus:ring-2 focus:ring-brand-green focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500">
                                Max: {maxQuantityTons.toFixed(2)} tons
                            </p>
                        </div>
                    )}
                </div>

                {/* Purchase summary */}
                <div className="bg-tan-green/20 dark:bg-dark-bg-tertiary/50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Purchasing:
                        </span>
                        <span className="font-mono font-semibold">
                            {formatMass(purchaseQuantityTons * 1000)}
                        </span>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-2 flex justify-between items-center">
                        <span className="font-semibold text-lg">
                            Total Cost:
                        </span>
                        <span className="text-lg font-bold">
                            <Money amount={totalCost} />
                        </span>
                    </div>
                </div>

                {/* Submit button */}
                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-dark-bg-tertiary hover:bg-gray-300 dark:hover:bg-dark-bg-secondary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={
                            purchaseMutation.isPending || (!buyAll && !quantity)
                        }
                        className="px-4 py-2 rounded-lg bg-brand-green hover:bg-brand-green/80 disabled:opacity-50 text-white font-semibold transition-colors"
                    >
                        {purchaseMutation.isPending
                            ? "Purchasing..."
                            : "Purchase"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
