import * as React from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/** Full-width card that collapses borders on mobile and becomes a rounded card on md+. */
function PageCard({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <Card
            className={cn("rounded-none border-x-0 md:rounded-xl md:border-x", className)}
            {...props}
        />
    );
}

export { PageCard };
