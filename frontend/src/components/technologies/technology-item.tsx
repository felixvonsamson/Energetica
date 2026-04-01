import { Lock } from "lucide-react";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    TechnologyIcon,
    AssetName,
    Money,
} from "@/components/ui";
import { CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ProjectType } from "@/types/projects";

interface TechnologyItemProps {
    technologyName: ProjectType;
    price: number;
    isLocked: boolean;
    discount?: number | null;
    level: number;
    onClick: () => void;
}

/**
 * Compact technology card for grid display. Shows minimal info: image, icon,
 * name, price, discount, and lock status. Opens detail dialog on click.
 */
export function TechnologyItem({
    technologyName,
    price,
    isLocked,
    discount,
    level,
    onClick,
}: TechnologyItemProps) {
    const imageUrl = `/static/images/technologies/${technologyName}.jpg`;

    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200",
                "hover:border-brand-green hover:scale-105",
                "flex flex-col h-full",
                isLocked && "opacity-75",
            )}
            onClick={onClick}
        >
            <CardHeader>
                <CardTitle className="flex items-center gap-2 min-w-0">
                    <TechnologyIcon technology={technologyName} size={20} />
                    <AssetName assetId={technologyName} mode="long" />
                </CardTitle>
                <CardDescription className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Money amount={price} long />
                        {discount && (
                            <div className="text-success text-xs">
                                <em>(-{Math.round((1 - discount) * 100)}%)</em>
                            </div>
                        )}
                    </div>
                    <span>Level {level}</span>
                </CardDescription>
            </CardHeader>

            {/* Image with lock overlay */}
            <CardContent>
                <div className="relative aspect-3/2">
                    <img
                        src={imageUrl}
                        alt={`${technologyName} technology`}
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                    {isLocked && (
                        <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
                            <Lock className="w-12 h-12 text-white" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
