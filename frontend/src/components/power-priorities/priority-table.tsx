/**
 * Priority table component - fetches the ordered priority list, handles
 * loading/error states, and renders PriorityItem rows and the RenewablesSection.
 * All per-item data fetching and display logic lives in the child components.
 */

import { AnimatePresence } from "framer-motion";
import { Plug, Zap } from "lucide-react";

import { PriorityItem } from "@/components/power-priorities/priority-item";
import { RenewablesSection } from "@/components/power-priorities/renewables-section";
import { CardContent, PageCard } from "@/components/ui";
import { usePowerPriorities } from "@/hooks/use-power-priorities";
import { getPriorityItemKey } from "@/lib/power-priorities-utils";

export function PriorityTable() {
    const { data: prioritiesData, isLoading, error } = usePowerPriorities();

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 text-center">
                <p className="text-lg">Loading power priorities...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 md:p-8 text-center text-alert-red">
                <p className="text-lg">Error loading power priorities</p>
                <p className="text-sm mt-2">
                    {error instanceof Error ? error.message : "Unknown error"}
                </p>
            </div>
        );
    }

    if (!prioritiesData) {
        return null;
    }

    const { renewables, power_priorities } = prioritiesData;

    return (
        <PageCard className="pt-0 pb-4">
            <CardContent className="overflow-x-auto">
                {power_priorities.length === 0 ? (
                    <p className="text-center py-8">
                        No facilities available
                    </p>
                ) : (
                    <table className="w-full min-w-170 border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-sm font-normal text-muted-foreground border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-center py-2 px-2 w-px">
                                        <Plug className="size-4 inline-block" />
                                    </th>
                                    <th className="text-left py-2 px-3 w-px">
                                        Facility
                                    </th>
                                    <th className="text-center py-2 px-3 w-px">
                                        Status
                                    </th>
                                    <th className="text-center py-2 px-3 w-px hidden lg:table-cell">
                                        Usage
                                    </th>
                                    <th className="text-right py-2 px-3 w-px">
                                        Power
                                    </th>
                                    <th className="text-center py-2 px-3 w-px">
                                        Price
                                    </th>
                                    <th className="text-center py-2 px-2 w-px">
                                        <Zap className="size-4 inline-block" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {power_priorities
                                        .map((item, originalIndex) => (
                                            <PriorityItem
                                                key={getPriorityItemKey(item)}
                                                item={item}
                                                canBumpUp={
                                                    originalIndex <
                                                    power_priorities.length - 1
                                                }
                                                canBumpDown={originalIndex > 0}
                                            />
                                        ))
                                        .reverse()}
                                </AnimatePresence>
                            </tbody>
                            {renewables.length > 0 && (
                                <RenewablesSection renewables={renewables} />
                            )}
                        </table>
                )}
            </CardContent>
        </PageCard>
    );
}
