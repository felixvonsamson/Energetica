import { useState } from "react";

import { Button, Modal, Money } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAsk } from "@/hooks/useResourceMarket";
import { formatMass } from "@/lib/format-utils";
import { RESOURCE_LABELS } from "@/types/resource-market";
import { ResourceType, RESOURCE_TYPES } from "@/types/resource-market";

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
                    <Label>Resource Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {RESOURCE_TYPES.map((resource) => (
                            <Button
                                key={resource}
                                type="button"
                                variant={
                                    selectedResource === resource
                                        ? "default"
                                        : "outline"
                                }
                                onClick={() => setSelectedResource(resource)}
                                className="px-4 py-3"
                            >
                                <div className="text-sm">
                                    {RESOURCE_LABELS[resource]}
                                </div>
                                {resources && (
                                    <div className="text-xs mt-1 opacity-80">
                                        {formatMass(resources[resource].stock)}
                                    </div>
                                )}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Current stock info */}
                {resources && (
                    <div className="bg-muted/50 p-3 rounded-lg">
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
                    <Label htmlFor="quantity" className="mb-2">
                        Quantity (in tons)
                    </Label>
                    <Input
                        type="number"
                        id="quantity"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        min="0.01"
                        max={maxQuantity}
                        step="0.01"
                        required
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-card text-card-foreground focus:ring-2 focus:ring-brand-green focus:border-transparent"
                        placeholder="Enter quantity in tons"
                    />
                    {maxQuantity !== undefined && (
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-800 dark:text-gray-400">
                                Maximum: {formatMass(maxQuantity * 1000)}
                            </p>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    setQuantity(maxQuantity.toFixed(2))
                                }
                                className="text-xs h-6 px-2"
                            >
                                Sell All
                            </Button>
                        </div>
                    )}
                </div>

                {/* Price */}
                <div>
                    <Label htmlFor="price" className="mb-2">
                        Price per ton
                    </Label>
                    <Input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        min="0.01"
                        step="0.01"
                        required
                        placeholder="Enter price per ton"
                    />
                </div>

                {/* Total preview */}
                {quantity && price && (
                    <div className="bg-muted/50 p-3 rounded-lg">
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
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="default"
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending
                            ? "Listing..."
                            : "Put on Sale"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
