import { createContext, useContext, type ReactNode } from "react";

import { ResolutionOption, resolutions } from "@/types/charts";
import { useLocalStorage } from "@energetica/ui/hooks/use-local-storage";

interface ResolutionContextValue {
    selectedResolution: ResolutionOption;
    setResolution: (index: number) => void;
}

const ResolutionContext = createContext<ResolutionContextValue | undefined>(
    undefined,
);

export function ResolutionProvider({ children }: { children: ReactNode }) {
    const [selectedResolutionIndex, setResolution] = useLocalStorage(
        "energetica:chart:resolutionIndex",
        0,
    );
    const selectedResolution =
        resolutions[selectedResolutionIndex] ?? resolutions[0]!;

    return (
        <ResolutionContext.Provider
            value={{ selectedResolution, setResolution }}
        >
            {children}
        </ResolutionContext.Provider>
    );
}

export function useResolution() {
    const context = useContext(ResolutionContext);
    if (!context) {
        throw new Error("useResolution must be used within ResolutionProvider");
    }
    return context;
}
