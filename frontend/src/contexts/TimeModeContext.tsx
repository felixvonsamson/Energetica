import { createContext, useContext, useState, type ReactNode } from "react";

import { ResolutionOption, resolutions } from "@/types/charts";

export type TimeMode = "wall-clock" | "game-time";

interface TimeModeContextValue {
    mode: TimeMode;
    toggleMode: () => void;
    setMode: (mode: TimeMode) => void;

    selectedResolution: ResolutionOption;
    setResolution: (index: number) => void;
}

const TimeModeContext = createContext<TimeModeContextValue | undefined>(
    undefined,
);

interface TimeModeProviderProps {
    children: ReactNode;
}

export function TimeModeProvider({ children }: TimeModeProviderProps) {
    const [mode, setModeState] = useState<TimeMode>(() => {
        // Check localStorage first
        const stored = localStorage.getItem("timeMode") as TimeMode | null;
        if (stored) return stored;

        // Default to game-time
        return "game-time";
    });

    const toggleMode = () => {
        const newMode: TimeMode =
            mode === "game-time" ? "wall-clock" : "game-time";
        setModeState(newMode);
        localStorage.setItem("timeMode", newMode);
    };

    const setMode = (newMode: TimeMode) => {
        setModeState(newMode);
        localStorage.setItem("timeMode", newMode);
    };

    const [selectedResolutionIndex, setResolution] = useState(0);
    const selectedResolution = resolutions[selectedResolutionIndex];

    const value = {
        mode,
        toggleMode,
        setMode,
        selectedResolution,
        setResolution,
    };

    return (
        <TimeModeContext.Provider value={value}>
            {children}
        </TimeModeContext.Provider>
    );
}

export function useTimeMode() {
    const context = useContext(TimeModeContext);
    if (!context) {
        throw new Error("useTimeMode must be used within TimeModeProvider");
    }
    return context;
}
