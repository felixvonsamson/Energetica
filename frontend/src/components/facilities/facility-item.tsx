import { Lock } from "lucide-react";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    FacilityIcon,
    FacilityName,
    Money,
} from "@/components/ui";
import { CardDescription } from "@/components/ui/card";
import { imageExtensionMap } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { ProjectType } from "@/types/projects";

interface FacilityItemProps {
    facilityName: ProjectType;
    facilityType: "power" | "storage" | "extraction" | "functional";
    price: number;
    isLocked: boolean;
    // imageExtension?: "png" | "jpg";
    onClick: () => void;
}

/**
 * Compact facility card for grid display. Shows minimal info: image, icon,
 * name, price, and lock status. Opens detail dialog on click.
 */
export function FacilityItem({
    facilityName,
    facilityType,
    price,
    isLocked,
    // imageExtension = "jpg",
    onClick,
}: FacilityItemProps) {
    //  as keyof typeof imageExtensionMap
    const imageExtension = imageExtensionMap[facilityName] ?? "jpg";
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
            <CardHeader>
                <CardTitle className="flex items-center gap-2 min-w-0 justify-between">
                    <FacilityIcon facility={facilityName} size={20} />
                    <FacilityName facility={facilityName} mode="long" />
                    <div className="grow" />
                </CardTitle>
                <CardDescription>
                    <Money amount={price} long />
                </CardDescription>
            </CardHeader>
            {/* Image with lock overlay */}
            <CardContent>
                <div className="relative aspect-3/2">
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
            </CardContent>
        </Card>
    );
}
