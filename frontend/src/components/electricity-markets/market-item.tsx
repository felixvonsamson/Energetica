import { Users, Check } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useMyMarket } from "@/hooks/useElectricityMarkets";
import { cn } from "@/lib/utils";
import { ElectricityMarket } from "@/types/electricity-markets";

interface MarketItemProps {
    market: ElectricityMarket;
    onClick: () => void;
}

/**
 * Compact market card for grid display. Shows minimal info: name, member count,
 * and current market indicator. Opens detail modal on click.
 */
export function MarketItem({ market, onClick }: MarketItemProps) {
    const currentMarket = useMyMarket();
    const isCurrentMarket = currentMarket?.id === market.id;

    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200",
                "hover:border-brand-green hover:scale-105",
                "flex flex-col h-full relative",
                isCurrentMarket && "border-brand-green bg-brand-green/5",
            )}
            onClick={onClick}
        >
            {/* Current market badge */}
            {isCurrentMarket && (
                <div className="absolute top-2 right-2 bg-brand-green text-white rounded-full p-1">
                    <Check className="w-4 h-4" />
                </div>
            )}

            {/* Icon */}
            <CardContent className="flex justify-center">
                <div
                    className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center",
                        isCurrentMarket ? "bg-brand-green/20" : "bg-muted/50",
                    )}
                >
                    <Users
                        className={cn(
                            "w-10 h-10",
                            isCurrentMarket
                                ? "text-brand-green"
                                : "text-muted-foreground",
                        )}
                    />
                </div>
            </CardContent>

            {/* Market info */}
            <CardHeader className="text-center">
                <CardTitle className="text-base">{market.name}</CardTitle>
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                        {market.member_ids.length}{" "}
                        {market.member_ids.length === 1 ? "member" : "members"}
                    </span>
                </div>
            </CardHeader>
        </Card>
    );
}
