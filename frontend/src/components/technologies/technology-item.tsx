import { Lock } from "lucide-react";

import { Card, TechnologyIcon, TechnologyName, Money } from "@/components/ui";
import { cn } from "@/lib/classname-utils";
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
 * name, price, discount, and lock status. Opens detail modal on click.
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
            {/* Image with lock overlay */}
            <div className="relative mb-3 aspect-3/2">
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

            {/* Technology info */}
            <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <TechnologyIcon technology={technologyName} size={20} />
                        <h3 className="font-semibold text-sm leading-tight truncate">
                            <TechnologyName
                                technology={technologyName}
                                level={level}
                                mode="long"
                            />
                        </h3>
                    </div>
                    <div className="shrink-0">
                        <Money amount={price} iconSize="sm" long />
                    </div>
                </div>

                {discount && (
                    <div className="text-green-500 text-xs">
                        <em>(-{Math.round((1 - discount) * 100)}%)</em>
                    </div>
                )}
            </div>
        </Card>
    );
}
