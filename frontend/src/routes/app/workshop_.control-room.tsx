/**
 * The control room (#1289): the dashboard shown on the projector, full screen
 * (F11), at `/app/workshop/control-room`. Anyone in the Run can open it, and
 * players reach it from a small button in the top bar.
 *
 * It renders outside the Workshop shell (the `_` in the file name), since the
 * projector has no use for a top bar. It opens its own socket, so it follows
 * the session and the room's prices live like every other Workshop page.
 *
 * The page is a fixed 1920×1080 canvas, scaled as a whole to fit the window, so
 * its layout never changes. It is always dark: while it is open it puts the
 * document in the dark theme, so the app's facility colours are the dark ones,
 * and puts it back after.
 */

import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { ControlRoom } from "@/components/workshop/control-room/control-room";
import { THEME } from "@/components/workshop/control-room/theme";
import { useWorkshopSocket } from "@/hooks/use-workshop";
import {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    canvasScale,
} from "@/lib/workshop-control-room";

export const Route = createFileRoute("/app/workshop_/control-room")({
    component: ControlRoomPage,
    staticData: { title: "Control room", runMode: "workshop" },
});

function ControlRoomPage() {
    useWorkshopSocket();
    const dark = useDarkDocument();
    return <FixedCanvas>{dark && <ControlRoom />}</FixedCanvas>;
}

/**
 * Puts the document in the dark theme while the page is open, and back after.
 * Returns whether it is dark yet, so the charts read the dark colours.
 */
function useDarkDocument(): boolean {
    const [dark, setDark] = useState(false);
    useLayoutEffect(() => {
        const root = document.documentElement;
        const before = {
            dark: root.classList.contains("dark"),
            light: root.classList.contains("light"),
        };
        root.classList.add("dark");
        root.classList.remove("light");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- render the charts only once the class is on
        setDark(true);
        return () => {
            root.classList.toggle("dark", before.dark);
            root.classList.toggle("light", before.light);
        };
    }, []);
    return dark;
}

/** The canvas, scaled to fit the window and centred in it. */
function FixedCanvas({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
    });
    useLayoutEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry)
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    const scale = canvasScale(size.width, size.height);
    return (
        <div
            ref={ref}
            className="fixed inset-0 overflow-hidden"
            style={{ background: THEME.bg }}
        >
            <div
                className="absolute origin-top-left"
                style={{
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    left: (size.width - CANVAS_WIDTH * scale) / 2,
                    top: (size.height - CANVAS_HEIGHT * scale) / 2,
                    transform: `scale(${scale})`,
                }}
            >
                {children}
            </div>
        </div>
    );
}
