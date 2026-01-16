import { useMemo } from "react";

import { FacilityName, FacilityIcon, Button } from "@/components/ui";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/classname-utils";
import { ProjectType } from "@/types/projects";

interface ComparisonSlot {
    selected: string | null;
    available: string[];
}

interface FacilityComparisonModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
    facilities: T[];
    facilityType: "power" | "storage";
    selectedFacilityNames: string[];
    onSelectionChange: (facilityNames: string[]) => void;
    onFacilityClick: (facilityName: string) => void;
    getFacilityName: (facility: T) => ProjectType;
    renderComparisonRows: (facilities: T[]) => React.ReactNode;
}

/**
 * Modal for comparing 2-3 facilities side-by-side. Displays comparable data
 * aligned horizontally across columns.
 */
export function FacilityComparisonModal<T>({
    isOpen,
    onClose,
    facilities,
    facilityType,
    selectedFacilityNames,
    onSelectionChange,
    onFacilityClick,
    getFacilityName,
    renderComparisonRows,
}: FacilityComparisonModalProps<T>) {
    // Ensure we have exactly 3 slots (can be empty)
    const slots: ComparisonSlot[] = useMemo(() => {
        const result: ComparisonSlot[] = [];
        for (let i = 0; i < 3; i++) {
            const selected = selectedFacilityNames[i] || null;
            // For available options, exclude already selected facilities
            const available = facilities
                .map(getFacilityName)
                .filter(
                    (name) =>
                        name === selected ||
                        !selectedFacilityNames.includes(name),
                );
            result.push({ selected, available });
        }
        return result;
    }, [facilities, selectedFacilityNames, getFacilityName]);

    const selectedFacilities = useMemo(() => {
        return selectedFacilityNames
            .map((name) => facilities.find((f) => getFacilityName(f) === name))
            .filter((f): f is T => f !== undefined);
    }, [facilities, selectedFacilityNames, getFacilityName]);

    const handleSlotChange = (slotIndex: number, facilityName: string) => {
        const newSelection = [...selectedFacilityNames];
        if (facilityName === "") {
            // Remove this slot and all slots after it
            newSelection.splice(slotIndex);
        } else {
            newSelection[slotIndex] = facilityName;
        }
        onSelectionChange(newSelection);
    };

    const facilityTitle =
        facilityType === "power" ? "Power Facilities" : "Storage Facilities";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-scroll">
                <DialogHeader>
                    <DialogTitle>Compare {facilityTitle}</DialogTitle>
                    <DialogDescription>
                        Select facilities to compare their properties
                        side-by-side.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Selection Dropdowns */}
                    <div className="grid grid-cols-3 gap-4">
                        {slots.map((slot, index) => (
                            <div
                                key={slot.selected || `empty-slot-${index}`}
                                className="space-y-2"
                            >
                                <Label>
                                    Facility {index + 1}
                                    {index >= 2 && " (Optional)"}
                                </Label>
                                <select
                                    value={slot.selected || ""}
                                    onChange={(e) =>
                                        handleSlotChange(index, e.target.value)
                                    }
                                    disabled={
                                        index > 0 &&
                                        !selectedFacilityNames[index - 1]
                                    }
                                    className={cn(
                                        "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground",
                                        "focus:outline-none focus:ring-2 focus:ring-brand-green/50",
                                        "disabled:opacity-50 disabled:cursor-not-allowed",
                                    )}
                                >
                                    <option value="">
                                        {index === 0
                                            ? "Select a facility..."
                                            : "None"}
                                    </option>
                                    {slot.available.map((name) => (
                                        <option key={name} value={name}>
                                            {name.replace(/_/g, " ")}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    {/* Comparison Table */}
                    {selectedFacilities.length >= 2 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm border-collapse">
                                {/* Headers with facility names */}
                                <thead>
                                    <tr className="border-b-2 border-border">
                                        <th className="py-3 px-4 text-left font-semibold bg-muted/30 sticky left-0 z-10">
                                            Property
                                        </th>
                                        {selectedFacilities.map((facility) => {
                                            const name =
                                                getFacilityName(facility);
                                            return (
                                                <th
                                                    key={name}
                                                    className="py-3 px-4 font-semibold bg-muted/30"
                                                >
                                                    <Button
                                                        variant="link"
                                                        onClick={() =>
                                                            onFacilityClick(
                                                                name,
                                                            )
                                                        }
                                                        className="flex flex-col items-center gap-2 mx-auto hover:opacity-80 transition-opacity cursor-pointer"
                                                    >
                                                        <FacilityIcon
                                                            facility={name}
                                                            size={32}
                                                        />
                                                        <FacilityName
                                                            facility={name}
                                                            mode="long"
                                                            className="underline"
                                                        />
                                                    </Button>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderComparisonRows(selectedFacilities)}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Instructions when less than 2 selected */}
                    {selectedFacilities.length < 2 && (
                        <div className="text-center py-8 text-muted-foreground">
                            Select at least 2 facilities to compare
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
