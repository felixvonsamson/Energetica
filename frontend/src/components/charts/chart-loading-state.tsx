/** Reusable loading state component for charts. */

import { RefreshCw } from "lucide-react";

export function ChartLoadingState() {
    return (
        <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading data...
        </div>
    );
}
