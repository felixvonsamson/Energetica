/**
 * A tooltip that explains a metric (#1400): hovering the metric shows figures
 * worked out from it, each with a short line on how, so players get the result
 * without doing the maths. An info mark beside the metric's label shows which
 * metrics have one. Workshop is played on computers, so the tooltip opens on
 * hover only.
 */

import { Info } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { formatRate } from "@/lib/workshop-balance-sheet";
import { storageMarkup } from "@/lib/workshop-metrics";
import { Money } from "@energetica/ui/components/money";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@energetica/ui/components/tooltip";

/**
 * Shows `content` when `children` is hovered. With no content, `children` shows
 * alone, so a caller need not branch on whether a metric has a tooltip.
 */
export function MetricTooltip({
    content,
    children,
}: {
    content: ReactNode;
    /** The metric to hover. It must take a ref and pass on its props. */
    children: ReactElement;
}) {
    if (content === undefined || content === null || content === false)
        return children;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent
                side="right"
                className="flex max-w-80 flex-col gap-1.5 py-2 text-left text-sm leading-snug text-wrap"
            >
                {content}
            </TooltipContent>
        </Tooltip>
    );
}

/** The mark beside a metric's label that says it has a tooltip. */
export function InfoMark() {
    return <Info className="size-3 shrink-0 opacity-50" aria-hidden />;
}

/** One figure in a tooltip, with an optional line on how it is worked out. */
export function TooltipFigure({
    label,
    value,
    note,
}: {
    label: ReactNode;
    value?: ReactNode;
    note?: ReactNode;
}) {
    return (
        <div>
            <div>
                <span className="font-semibold">{label}</span>
                {value !== undefined && <>: {value}</>}
            </div>
            {note && <div className="opacity-75">{note}</div>}
        </div>
    );
}

/**
 * The reminder that storage loses energy, so it must sell dearer than it buys,
 * shown on a storage facility's card and beside its prices.
 */
export function StorageMarkupNote({ efficiency }: { efficiency: number }) {
    return (
        <TooltipFigure
            label="Storage loses energy"
            note={`Your sell price should be at least ${Math.round(storageMarkup(efficiency) * 100)}% higher than your buy price to make a profit.`}
        />
    );
}

/** An amount per MWh, with one decimal so small rates stay readable. */
export function MoneyPerMWh({ amount }: { amount: number }) {
    return (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
            <Money amount={amount} format={formatRate} />
            /MWh
        </span>
    );
}
