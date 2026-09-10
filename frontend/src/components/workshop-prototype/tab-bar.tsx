/**
 * PROTOTYPE — Workshop Mode UI mockup (issue #992). Tiny pill tab bar shared by
 * the investment page (Build / Your Fleet) and the trading-period review page
 * (Chart / My Prices) — kept as one component so both read identically.
 */
import { cn } from "@/lib/utils";

export function TabBar<T extends string>({
    tabs,
    value,
    onChange,
}: {
    tabs: Array<{ key: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted text-sm shrink-0">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    className={cn(
                        "px-3 py-1.5 rounded-md transition-colors",
                        value === tab.key
                            ? "bg-background shadow-sm font-medium"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
