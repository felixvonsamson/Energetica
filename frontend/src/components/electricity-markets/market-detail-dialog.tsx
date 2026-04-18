import { Users, Check } from "lucide-react";

import { CardContent, Button, Money } from "@/components/ui";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Duration } from "@/components/ui/duration";
import { PlayerName } from "@/components/ui/player-name";
import { TypographyH2, TypographyH3 } from "@/components/ui/typography";
import { useLatestChartDataSlice } from "@/hooks/use-charts";
import { useMyMarket } from "@/hooks/use-electricity-markets";
import { useGameTick } from "@/hooks/use-game-tick";
import { usePlayerMap } from "@/hooks/use-players";
import { formatPower } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { ElectricityMarket } from "@/types/electricity-markets";

interface MarketDetailDialogProps {
    isOpen: boolean;
    market: ElectricityMarket | null;
    onClose: () => void;
    onJoin: (market: ElectricityMarket) => void;
    onLeave: (market: ElectricityMarket) => void;
}

/**
 * Dialog displaying detailed market information. Shows members, price, volume,
 * and action buttons.
 */
export function MarketDetailDialog({
    isOpen,
    market,
    onClose,
    onJoin,
    onLeave,
}: MarketDetailDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                {market !== null && MarketContent(market, onLeave, onJoin)}
            </DialogContent>
        </Dialog>
    );
}

// Content for MarketDetailDialog
function MarketContent(
    market: ElectricityMarket,
    onLeave: (market: ElectricityMarket) => void,
    onJoin: (market: ElectricityMarket) => void,
) {
    const currentMarket = useMyMarket();
    const { currentTick } = useGameTick();
    const { data: marketData } = useLatestChartDataSlice({
        chartType: "market-clearing",
        marketId: market.id,
    });
    const playerMap = usePlayerMap();

    const marketAge =
        currentTick !== undefined
            ? currentTick - market.created_tick
            : undefined;
    const isCurrentMarket = currentMarket?.id === market.id;

    if (playerMap === undefined) return "Loading...";

    return (
        <>
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
                            isCurrentMarket ? "bg-brand/20" : "bg-muted/50",
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
                            <div className="absolute top-2 right-2 bg-brand text-white rounded-full p-2">
                                <Check className="w-5 h-5" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Header */}
                <div className="text-center">
                    <TypographyH2 className="mb-2">{market.name}</TypographyH2>
                    {isCurrentMarket && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand-green text-sm font-medium">
                            <Check className="w-4 h-4" />
                            Current Market
                        </div>
                    )}
                </div>

                {/* Market Stats */}
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
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
                                {marketData.price !== undefined ? (
                                    <Money amount={marketData.price} />
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
                                {marketData.volume !== undefined ? (
                                    formatPower(marketData.volume)
                                ) : (
                                    <span className="text-muted-foreground">
                                        N/A
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground mb-1">
                                Age
                            </div>
                            <div className="text-xl font-semibold">
                                {marketAge !== undefined ? (
                                    <Duration
                                        ticks={marketAge}
                                        compact
                                    />
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
                    <TypographyH3 className="text-lg mb-3">
                        Market Members
                    </TypographyH3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {market.member_ids.map((memberId) => (
                            <div
                                key={memberId}
                                className="px-3 py-2 bg-muted/30 rounded text-sm"
                            >
                                {playerMap[memberId] ? (
                                    <PlayerName player={playerMap[memberId]} />
                                ) : (
                                    `Player ${memberId}`
                                )}
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
                            onClick={() => onLeave(market)}
                        >
                            Leave Market
                        </Button>
                    ) : (
                        <Button
                            variant="default"
                            size="lg"
                            onClick={() => onJoin(market)}
                        >
                            Join Market
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}
