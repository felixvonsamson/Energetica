import { useState } from "react";

import { Button, Money } from "@/components/ui";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useCreateAsk } from "@/hooks/useResourceMarket";
import { formatMass } from "@/lib/format-utils";
import {
    RESOURCE_LABELS,
    ResourceType,
    RESOURCE_TYPES,
} from "@/types/resource-market";

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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <form onSubmit={handleSubmit} id="create-ask-form">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Put Resources on Sale</DialogTitle>
                        <DialogDescription>
                            List your resources on the market for other players
                            to purchase.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
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
                                        onClick={() =>
                                            setSelectedResource(resource)
                                        }
                                        className="px-4 py-3"
                                    >
                                        <div className="text-sm">
                                            {RESOURCE_LABELS[resource]}
                                        </div>
                                        {resources && (
                                            <div className="text-xs mt-1 opacity-80">
                                                {formatMass(
                                                    resources[resource].stock,
                                                )}
                                            </div>
                                        )}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Current stock info */}
                        {resources && (
                            <div className="bg-muted/50 p-3 rounded-lg">
                                <div className="text-sm">
                                    <span className="font-semibold">
                                        Your {RESOURCE_LABELS[selectedResource]}{" "}
                                        stock:
                                    </span>{" "}
                                    <span className="font-mono">
                                        {formatMass(
                                            resources[selectedResource].stock,
                                        )}
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
                                placeholder="Enter quantity in tons"
                            />
                            {maxQuantity !== undefined && (
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs text-muted-foreground">
                                        Maximum:{" "}
                                        {formatMass(maxQuantity * 1000)}
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
                                <div className="text-sm">
                                    <span className="font-semibold">
                                        Total listing value:
                                    </span>{" "}
                                    <Money
                                        amount={
                                            parseFloat(quantity) *
                                            parseFloat(price)
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={createMutation.isPending}
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            form="create-ask-form"
                            variant={
                                createMutation.isPending ? "outline" : "default"
                            }
                            disabled={createMutation.isPending}
                            className="flex items-center gap-2"
                        >
                            {createMutation.isPending && <Spinner />}
                            Put on Sale
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
}
