import { Modal, Money } from "@/components/ui";
import { useCreateAsk } from "@/hooks/useResourceMarket";
import { formatMass } from "@/lib/format-utils";
import { ResourceType, RESOURCE_TYPES } from "@/types/resource-market";
import { useState } from "react";
import { RESOURCE_LABELS } from "../../routes/app/resource-market";

interface CreateAskModalProps {
    isOpen: boolean;
    onClose: () => void;
    resources?: {
        coal: { stock: number; capacity: number; reserves: number };
        gas: { stock: number; capacity: number; reserves: number };
        uranium: { stock: number; capacity: number; reserves: number };
    };
}
export function CreateAskModal({
    isOpen,
    onClose,
    resources,
}: CreateAskModalProps) {
    const [selectedResource, setSelectedResource] =
        useState<ResourceType>("coal");
    const [quantity, setQuantity] = useState("");
    const [price, setPrice] = useState("");

    const createMutation = useCreateAsk();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const quantityKg = parseFloat(quantity) * 1000; // Convert tons to kg
        const pricePerKg = parseFloat(price) / 1000; // Convert price per ton to price per kg

        try {
            await createMutation.mutateAsync({
                resource_type: selectedResource,
                quantity: quantityKg,
                unit_price: pricePerKg,
            });
            onClose();
            setQuantity("");
            setPrice("");
        } catch (error) {
            console.error("Failed to create ask:", error);
        }
    };

    const maxQuantity = resources
        ? resources[selectedResource].stock / 1000
        : undefined;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Put Resources on Sale">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Resource selection */}
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                        Resource Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {RESOURCE_TYPES.map((resource) => (
                            <button
                                key={resource}
                                type="button"
                                onClick={() => setSelectedResource(resource)}
                                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                                    selectedResource === resource
                                        ? "bg-brand-green text-white"
                                        : "bg-tan-green text-gray-900 dark:bg-dark-bg-tertiary dark:text-gray-100 hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary"
                                }`}
                            >
                                <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {RESOURCE_LABELS[resource]}
                                </div>
                                {resources && (
                                    <div className="text-xs mt-1 opacity-80 text-gray-900 dark:text-gray-100">
                                        {formatMass(resources[resource].stock)}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Current stock info */}
                {resources && (
                    <div className="bg-tan-green/20 dark:bg-dark-bg-tertiary/50 p-3 rounded-lg">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                            <span className="font-semibold">
                                Your {RESOURCE_LABELS[selectedResource]} stock:
                            </span>{" "}
                            <span className="font-mono">
                                {formatMass(resources[selectedResource].stock)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Quantity */}
                <div>
                    <label
                        htmlFor="quantity"
                        className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100"
                    >
                        Quantity (in tons)
                    </label>
                    <input
                        type="number"
                        id="quantity"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        min="0.01"
                        max={maxQuantity}
                        step="0.01"
                        required
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white text-gray-900 dark:bg-dark-bg-secondary dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent"
                        placeholder="Enter quantity in tons"
                    />
                    {maxQuantity !== undefined && (
                        <p className="text-xs text-gray-800 dark:text-gray-400 mt-1">
                            Maximum: {maxQuantity.toFixed(2)} tons
                        </p>
                    )}
                </div>

                {/* Price */}
                <div>
                    <label
                        htmlFor="price"
                        className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100"
                    >
                        Price per ton
                    </label>
                    <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        min="0.01"
                        step="0.01"
                        required
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white text-gray-900 dark:bg-dark-bg-secondary dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent"
                        placeholder="Enter price per ton"
                    />
                </div>

                {/* Total preview */}
                {quantity && price && (
                    <div className="bg-tan-green/20 dark:bg-dark-bg-tertiary/50 p-3 rounded-lg">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                            <span className="font-semibold">
                                Total listing value:
                            </span>{" "}
                            <Money
                                amount={
                                    parseFloat(quantity) * parseFloat(price)
                                }
                            />
                        </div>
                    </div>
                )}

                {/* Submit button */}
                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-gray-200 text-gray-900 dark:bg-dark-bg-tertiary dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-dark-bg-secondary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="px-4 py-2 rounded-lg bg-brand-green hover:bg-brand-green/80 disabled:opacity-50 text-white font-semibold transition-colors"
                    >
                        {createMutation.isPending
                            ? "Listing..."
                            : "Put on Sale"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
