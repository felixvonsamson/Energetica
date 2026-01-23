/** Segmented picker component - a radio group styled as a segmented control. */

import * as React from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SegmentedPickerProps<T extends string = string> {
    value: T;
    onValueChange: (value: T) => void;
    children: React.ReactNode;
    className?: string;
}

/**
 * A segmented picker component that provides radio group functionality with a
 * segmented control UI (similar to SwiftUI's `.pickerStyle(.segmented)`).
 *
 * @example
 *     <SegmentedPicker value={value} onValueChange={onChange}>
 *         <SegmentedPickerOption value="1">Option 1</SegmentedPickerOption>
 *         <SegmentedPickerOption value="2">Option 2</SegmentedPickerOption>
 *     </SegmentedPicker>;
 */
export function SegmentedPicker<T extends string = string>({
    value,
    onValueChange,
    children,
    className,
}: SegmentedPickerProps<T>) {
    return (
        <Tabs
            value={value}
            onValueChange={onValueChange as (value: string) => void}
        >
            <TabsList className={className}>{children}</TabsList>
        </Tabs>
    );
}

/**
 * Option component for rendering within SegmentedPicker. Provides the same
 * props as TabsTrigger.
 */
export function SegmentedPickerOption({
    className,
    ...props
}: React.ComponentProps<typeof TabsTrigger>) {
    return <TabsTrigger className={cn(className)} {...props} />;
}
