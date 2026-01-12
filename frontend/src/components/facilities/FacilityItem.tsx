import { Lock } from "lucide-react";

import { Card, FacilityIcon, FacilityName, Money } from "@/components/ui";
import { cn } from "@/lib/classname-utils";
import { ProjectType } from "@/types/projects";

interface FacilityItemProps {
    facilityName: ProjectType;
    facilityType: "power" | "storage" | "extraction" | "functional";
    price: number;
    isLocked: boolean;
    imageExtension?: "png" | "jpg";
    onClick: () => void;
}

/**
 * Compact facility card for grid display. Shows minimal info: image, icon,
 * name, price, and lock status. Opens detail modal on click.
 */
export function FacilityItem({
    facilityName,
    facilityType,
    price,
    isLocked,
    imageExtension = "jpg",
    onClick,
}: FacilityItemProps) {
    const imageUrl = `/static/images/${facilityType}_facilities/${facilityName}.${imageExtension}`;

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
            <div className="relative mb-3 aspect-[3/2]">
                <img
                    src={imageUrl}
                    alt={`${facilityName} ${facilityType} facility`}
                    className="w-full h-full object-cover rounded"
                />
                {isLocked && (
                    <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
                        <Lock className="w-12 h-12 text-white" />
                    </div>
                )}
            </div>

            {/* Facility info */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <FacilityIcon facility={facilityName} size={20} />
                    <h3 className="font-semibold text-sm leading-tight truncate">
                        <FacilityName facility={facilityName} mode="long" />
                    </h3>
                </div>
                <div className="flex-shrink-0">
                    <Money amount={price} iconSize="sm" long />
                </div>
            </div>
        </Card>
    );
}
