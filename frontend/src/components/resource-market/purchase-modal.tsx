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
import { usePurchaseAsk } from "@/hooks/useResourceMarket";
import { formatMass } from "@/lib/format-utils";
import { RESOURCE_LABELS, ResourceType } from "@/types/resource-market";

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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <form onSubmit={handleSubmit} id="purchase-form">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Purchase Resources</DialogTitle>
                        <DialogDescription>
                            Buy resources from another player's listing.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Ask details */}
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between">
                                <span className="font-semibold">Resource:</span>
                                <span className="capitalize">
                                    {
                                        RESOURCE_LABELS[
                                            ask.resource_type as ResourceType
                                        ]
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold">
                                    Available:
                                </span>
                                <span className="font-mono">
                                    {formatMass(ask.quantity)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold">
                                    Price per ton:
                                </span>
                                <Money amount={ask.unit_price * 1000} />
                            </div>
                        </div>

                        {/* Purchase amount selection */}
                        <div className="space-y-3">
                            <Label>Purchase Amount</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={buyAll ? "default" : "outline"}
                                    onClick={() => setBuyAll(true)}
                                    className="flex-1"
                                >
                                    Buy All
                                </Button>
                                <Button
                                    type="button"
                                    variant={!buyAll ? "default" : "outline"}
                                    onClick={() => setBuyAll(false)}
                                    className="flex-1"
                                >
                                    Custom Amount
                                </Button>
                            </div>

                            {/* Custom amount input */}
                            {!buyAll && (
                                <div className="space-y-2">
                                    <Input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) =>
                                            setQuantity(e.target.value)
                                        }
                                        min="0.01"
                                        max={maxQuantityTons}
                                        step="0.01"
                                        placeholder="Enter quantity in tons"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Max: {maxQuantityTons.toFixed(2)} tons
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Purchase summary */}
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                    Purchasing:
                                </span>
                                <span className="font-mono font-semibold">
                                    {formatMass(purchaseQuantityTons * 1000)}
                                </span>
                            </div>
                            <div className="border-t border-border pt-2 flex justify-between items-center">
                                <span className="font-semibold text-lg">
                                    Total Cost:
                                </span>
                                <span className="text-lg font-bold">
                                    <Money amount={totalCost} />
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={purchaseMutation.isPending}
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            form="purchase-form"
                            variant={
                                purchaseMutation.isPending
                                    ? "outline"
                                    : "default"
                            }
                            disabled={
                                purchaseMutation.isPending ||
                                (!buyAll && !quantity)
                            }
                            className="flex items-center gap-2"
                        >
                            {purchaseMutation.isPending && <Spinner />}
                            Purchase
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
}
