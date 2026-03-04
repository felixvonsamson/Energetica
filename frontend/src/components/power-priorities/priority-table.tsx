/**
 * Priority table component - fetches the ordered priority list, handles
 * loading/error states, and renders PriorityItem rows and the RenewablesSection.
 * All per-item data fetching and display logic lives in the child components.
 */

import { PriorityItem } from "@/components/power-priorities/priority-item";
import { RenewablesSection } from "@/components/power-priorities/renewables-section";
import { Card, CardContent } from "@/components/ui";
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
        <Card>
            <CardContent>
                {power_priorities.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                        No facilities available
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-170 border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-xs font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-center py-2 px-2 w-16">
                                        Cons
                                    </th>
                                    <th className="text-left py-2 px-3">
                                        Facility
                                    </th>
                                    <th className="text-right py-2 px-3 w-30">
                                        Power
                                    </th>
                                    <th className="py-2 px-3 w-40 hidden lg:table-cell">
                                        Usage
                                    </th>
                                    <th className="py-2 px-3 w-36">Price</th>
                                    <th className="text-right py-2 px-3 w-10">
                                        Status
                                    </th>
                                    <th className="text-center py-2 px-2 w-16">
                                        Prod
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
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
                            </tbody>
                            {renewables.length > 0 && (
                                <RenewablesSection renewables={renewables} />
                            )}
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
