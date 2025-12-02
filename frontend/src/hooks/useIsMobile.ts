import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 1024; // lg breakpoint

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => {
        // Check if window is defined (SSR safety)
        if (typeof window === "undefined") return false;
        return window.innerWidth < MOBILE_BREAKPOINT;
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return isMobile;
}
