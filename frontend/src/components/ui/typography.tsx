/**
 * Typography components for consistent text styling across the application.
 * Based on shadcn/ui patterns with adaptations for Energetica's design system.
 *
 * Usage:
 *
 * - Semantic components: TypographyH1, TypographyH2, TypographyH3, TypographyP
 * - Visual modifiers: TypographyMuted, TypographyLarge, TypographySmall,
 *   TypographyLead
 * - Brand styling: TypographyBrand (Expletus Sans font)
 * - Data display: DataValue (monospaced numerical values)
 *
 * These components are composable - wrap them as needed:
 * <TypographyMuted><DataValue>123</DataValue></TypographyMuted>
 */

import { cn } from "@/lib/utils";

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    className?: string;
}

interface DataValueProps {
    /** The value to display (will be rendered in monospace) */
    children: React.ReactNode;
    /** Additional CSS classes */
    className?: string;
}

// ============================================
// Semantic Heading Components
// ============================================

export function TypographyH1({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <h1
            className={cn(
                "scroll-m-20 text-4xl font-extrabold tracking-tight",
                className,
            )}
            {...props}
        >
            {children}
        </h1>
    );
}

export function TypographyH2({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <h2
            className={cn(
                "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
                className,
            )}
            {...props}
        >
            {children}
        </h2>
    );
}

export function TypographyH3({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <h3
            className={cn(
                "scroll-m-20 text-2xl font-semibold tracking-tight",
                className,
            )}
            {...props}
        >
            {children}
        </h3>
    );
}

export function TypographyH4({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <h4
            className={cn(
                "scroll-m-20 text-xl font-semibold tracking-tight",
                className,
            )}
            {...props}
        >
            {children}
        </h4>
    );
}

// ============================================
// Text Components
// ============================================

export function TypographyP({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <p className={cn("leading-7 not-first:mt-6", className)} {...props}>
            {children}
        </p>
    );
}

export function TypographyLead({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <p
            className={cn("text-xl text-muted-foreground", className)}
            {...props}
        >
            {children}
        </p>
    );
}

export function TypographyLarge({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <div className={cn("text-lg font-semibold", className)} {...props}>
            {children}
        </div>
    );
}

export function TypographySmall({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <small
            className={cn("text-sm font-medium leading-none", className)}
            {...props}
        >
            {children}
        </small>
    );
}

export function TypographyMuted({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <p
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        >
            {children}
        </p>
    );
}

// ============================================
// Specialty Components
// ============================================

/**
 * Brand typography using Expletus Sans font. Use for logo, major brand moments,
 * and visual emphasis.
 *
 * @example
 *     <TypographyBrand className="text-4xl">Energetica</TypographyBrand>;
 */
export function TypographyBrand({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <span className={cn("font-['Expletus_Sans']", className)} {...props}>
            {children}
        </span>
    );
}

/**
 * Inline code or technical text.
 *
 * @example
 *     <TypographyInlineCode>npm install</TypographyInlineCode>;
 */
export function TypographyInlineCode({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <code
            className={cn(
                "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
                className,
            )}
            {...props}
        >
            {children}
        </code>
    );
}

/** Blockquote for emphasized text or citations. */
export function TypographyBlockquote({
    className,
    children,
    ...props
}: TypographyProps) {
    return (
        <blockquote
            className={cn("mt-6 border-l-2 pl-6 italic", className)}
            {...props}
        >
            {children}
        </blockquote>
    );
}

// ============================================
// Data Display Components
// ============================================

/**
 * Base component for displaying numerical/data values in monospace font. Used
 * as the foundation for domain-specific components like Money, Power, etc.
 *
 * @example
 *     <DataValue>1,500</DataValue>
 *     <DataValue className="text-lg">42.7</DataValue>
 *
 * @example
 *     // Composable with visual modifiers:
 *     <TypographyMuted>
 *         <DataValue>123.45</DataValue>
 *     </TypographyMuted>;
 */
export function DataValue({ className, children, ...props }: DataValueProps) {
    return (
        <span className={cn("font-mono", className)} {...props}>
            {children}
        </span>
    );
}
