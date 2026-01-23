import { Users, Check } from "lucide-react";

import { CardContent, Button, Money } from "@/components/ui";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatPower } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface MarketDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    market: {
        id: number;
        name: string;
        member_ids: number[];
    };
    playerMap: Record<number, { username: string }>;
    price?: number;
    volume?: number;
    isCurrentMarket: boolean;
    onJoin: () => void;
    onLeave: () => void;
}

/**
 * Modal displaying detailed market information. Shows members, price, volume,
 * and action buttons.
 */
export function MarketDetailModal({
    isOpen,
    onClose,
    market,
    playerMap,
    price,
    volume,
    isCurrentMarket,
    onJoin,
    onLeave,
}: MarketDetailModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="sr-only">
                    <DialogTitle>{market.name}</DialogTitle>
                    <DialogDescription>
                        Market details, statistics, and members.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div
                            className={cn(
                                "w-32 h-32 rounded-full flex items-center justify-center relative",
                                isCurrentMarket
                                    ? "bg-brand-green/20"
                                    : "bg-muted/50",
                            )}
                        >
                            <Users
                                className={cn(
                                    "w-16 h-16",
                                    isCurrentMarket
                                        ? "text-brand-green"
                                        : "text-muted-foreground",
                                )}
                            />
                            {isCurrentMarket && (
                                <div className="absolute top-2 right-2 bg-brand-green text-white rounded-full p-2">
                                    <Check className="w-5 h-5" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Header */}
                    <div className="text-center">
                        <h2 className="text-3xl font-bold mb-2">
                            {market.name}
                        </h2>
                        {isCurrentMarket && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-green/10 text-brand-green text-sm font-medium">
                                <Check className="w-4 h-4" />
                                Current Market
                            </div>
                        )}
                    </div>

                    {/* Market Stats */}
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">
                                    Members
                                </div>
                                <div className="text-xl font-semibold">
                                    {market.member_ids.length}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">
                                    Last Price
                                </div>
                                <div className="text-xl font-semibold">
                                    {price !== undefined ? (
                                        <Money amount={price} />
                                    ) : (
                                        <span className="text-muted-foreground">
                                            N/A
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">
                                    Volume
                                </div>
                                <div className="text-xl font-semibold font-mono">
                                    {volume !== undefined && volume > 0 ? (
                                        formatPower(volume)
                                    ) : (
                                        <span className="text-muted-foreground">
                                            N/A
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>

                    {/* Members List */}
                    <CardContent>
                        <h3 className="text-lg font-semibold mb-3">
                            Market Members
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {market.member_ids.map((memberId) => (
                                <div
                                    key={memberId}
                                    className="px-3 py-2 bg-muted/30 rounded text-sm"
                                >
                                    {playerMap[memberId]?.username ||
                                        `Player ${memberId}`}
                                </div>
                            ))}
                        </div>
                    </CardContent>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-3 pt-4 border-t border-border/50">
                        {isCurrentMarket ? (
                            <Button
                                variant="destructive"
                                size="lg"
                                onClick={onLeave}
                            >
                                Leave Market
                            </Button>
                        ) : (
                            <Button
                                variant="default"
                                size="lg"
                                onClick={onJoin}
                            >
                                Join Market
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
