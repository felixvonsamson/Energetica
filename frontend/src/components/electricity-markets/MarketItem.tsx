import { Users, Check } from "lucide-react";

import { Card } from "@/components/ui";
import { cn } from "@/lib/classname-utils";

interface MarketItemProps {
    marketName: string;
    memberCount: number;
    isCurrentMarket: boolean;
    onClick: () => void;
}

/**
 * Compact market card for grid display. Shows minimal info: name, member count,
 * and current market indicator. Opens detail modal on click.
 */
export function MarketItem({
    marketName,
    memberCount,
    isCurrentMarket,
    onClick,
}: MarketItemProps) {
    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200",
                "hover:border-brand-green hover:scale-105",
                "flex flex-col h-full p-4 relative",
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
            <div className="mb-4 flex justify-center">
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
            </div>

            {/* Market info */}
            <div className="flex flex-col items-center gap-2 text-center">
                <h3 className="font-semibold text-base leading-tight">
                    {marketName}
                </h3>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                        {memberCount} {memberCount === 1 ? "member" : "members"}
                    </span>
                </div>
            </div>
        </Card>
    );
}
