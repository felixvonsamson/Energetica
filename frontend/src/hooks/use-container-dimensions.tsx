import { useState, useEffect, useCallback } from "react";

export function useContainerDimensions(
    containerRef: React.RefObject<HTMLDivElement | null>,
): { width: number; height: number } {
    // https://gist.github.com/morajabi/523d7a642d8c0a2f71fcfa0d8b3d2846
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const updateDimensions = useCallback(() => {
        if (containerRef.current) {
            const { width, height } =
                containerRef.current.getBoundingClientRect();
            setDimensions({ width, height });
        }
    }, [containerRef]);
    const useEffectInEvent = (
        event: "resize" | "scroll",
        useCapture?: boolean,
    ) => {
        useEffect(() => {
            // Initial measurement
            updateDimensions();
            // Update on window resize
            window.addEventListener(event, updateDimensions, useCapture);
            return () =>
                window.removeEventListener(event, updateDimensions, useCapture);
        }, [event, useCapture]);
    };

    useEffectInEvent("resize");
    useEffectInEvent("scroll", true);

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
