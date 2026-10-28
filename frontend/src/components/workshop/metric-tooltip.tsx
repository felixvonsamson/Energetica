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
import { Money } from "@energetica/ui/components/money";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@energetica/ui/components/tooltip";

export function MetricTooltip({
    content,
    children,
}: {
    content: ReactNode;
    /** The metric to hover. It must take a ref and pass on its props. */
    children: ReactElement;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent
                side="right"
                className="flex max-w-72 flex-col gap-1.5 py-2 text-left leading-snug text-balance"
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

/** An amount per MWh, with one decimal so small rates stay readable. */
export function MoneyPerMWh({ amount }: { amount: number }) {
    return (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
            <Money amount={amount} format={formatRate} />
            /MWh
        </span>
    );
}
