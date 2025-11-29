import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with proper precedence. Combines clsx for conditional
 * classes and tailwind-merge for deduplication.
 *
 * @example
 *     cn("px-4 py-2", isActive && "bg-brand-green", className);
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
