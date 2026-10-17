/** Segmented picker component - a radio group styled as a segmented control. */

import * as React from "react";

import { cn } from "../lib/utils";

import { Tabs, TabsList, TabsTrigger } from "./tabs";

interface SegmentedPickerProps<T extends string = string> {
    value: T;
    onValueChange: (value: T) => void;
    children: React.ReactNode;
    className?: string;
    /**
     * `"automatic"` (the default) also picks an option when it gains focus, so
     * a click reports the same pick twice. Pass `"manual"` when each pick sends
     * a request.
     */
    activationMode?: "automatic" | "manual";
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
    activationMode,
}: SegmentedPickerProps<T>) {
    return (
        <Tabs
            value={value}
            activationMode={activationMode}
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
