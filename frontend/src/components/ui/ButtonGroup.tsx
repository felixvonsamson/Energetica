/** Generic button group picker component */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/classname-utils";

export interface ButtonGroupOption<T extends string | number> {
    value: T;
    label: string;
}

export interface ButtonGroupProps<T extends string | number> {
    label?: string;
    value: T;
    options: ButtonGroupOption<T>[];
    onChange: (value: T) => void;
    className?: string;
}

/**
 * A group of toggle buttons for selecting between multiple options. Uses
 * semantic colors and the Button component for consistency.
 *
 * @example
 *     ```tsx
 *     const [viewMode, setViewMode] = useState<"normal" | "percent">("normal");
 *
 *     <ButtonGroup
 *       label="View Mode"
 *       value={viewMode}
 *       options={[
 *         { value: "normal", label: "Normal" },
 *         { value: "percent", label: "Percent" }
 *       ]}
 *       onChange={setViewMode}
 *     />
 *     ```;
 */
export function ButtonGroup<T extends string | number>({
    label,
    value,
    options,
    onChange,
    className,
}: ButtonGroupProps<T>) {
    return (
        <div className={cn(className)}>
            {label && <Label className="mb-2">{label}</Label>}
            <div className="flex gap-2">
                {options.map((option) => (
                    <Button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        variant={value === option.value ? "default" : "outline"}
                        size="sm"
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
