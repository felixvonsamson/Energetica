import { useState, useEffect, useCallback, useLayoutEffect } from "react";

/**
 * The size of the element `containerRef` is attached to, kept up to date as it
 * resizes. It is measured before the first paint, so it is only 0 while the
 * element is not mounted.
 */
export function useContainerDimensions(
    containerRef: React.RefObject<HTMLElement | null>,
): { width: number; height: number } {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const updateDimensions = useCallback(() => {
        if (containerRef.current) {
            const { width, height } =
                containerRef.current.getBoundingClientRect();
            setDimensions((previous) =>
                previous.width === width && previous.height === height
                    ? previous
                    : { width, height },
            );
        }
    }, [containerRef]);

    // A ResizeObserver reports any change to the element's size, whether the
    // window resized or the layout around the element changed.
    useLayoutEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        updateDimensions();
        const observer = new ResizeObserver(updateDimensions);
        observer.observe(element);
        return () => observer.disconnect();
    }, [containerRef, updateDimensions]);

    // HMR: Update dimensions when this module hot-reloads during development
    // Use double requestAnimationFrame to ensure CSS changes are fully applied
    useEffect(() => {
        const handleInvalidation = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    updateDimensions();
                });
            });
        };
        window.addEventListener("map-canvas-invalidated", handleInvalidation);
        return () => {
            window.removeEventListener(
                "map-canvas-invalidated",
                handleInvalidation,
            );
        };
    }, [updateDimensions]);

    return { width: dimensions.width, height: dimensions.height };
}
