/**
 * Chart cards that a player can minimize into a dock, so a long review page
 * shows only the charts they want (#1399).
 *
 * Each card has a minimize button. A sticky bar holds a thin row with one
 * button per card. Minimizing a card shrinks it into its button, so the player
 * sees where it went. Clicking a button opens its card if it is minimized,
 * growing it out of the button, or scrolls to it if it is open. Which cards are
 * minimized is remembered in the browser.
 */

import type { LucideIcon } from "lucide-react";
import { Minimize2 } from "lucide-react";
import {
    type ReactNode,
    type RefObject,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { flushSync } from "react-dom";

import { Button } from "@energetica/ui/components/button";

export interface DockItem {
    id: string;
    label: string;
    icon: LucideIcon;
}

const DURATION_MS = 450;

interface Dock {
    minimized: ReadonlySet<string>;
    minimize: (id: string) => void;
    press: (id: string) => void;
    registerCard: (id: string, element: HTMLDivElement | null) => void;
    registerButton: (id: string, element: HTMLButtonElement | null) => void;
}

const DockContext = createContext<Dock | null>(null);
const CardIdContext = createContext<string | null>(null);

/** The transform that puts `from`'s box onto `to`'s, scaled from its top left. */
function onto(from: DOMRect, to: DOMRect): string {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const sx = Math.max(0.02, to.width / from.width);
    const sy = Math.max(0.02, to.height / from.height);
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

function readMinimized(key: string): string[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
        return Array.isArray(value) ? value.map(String) : [];
    } catch {
        return [];
    }
}

export function useCardDock(
    storageKey: string,
    sticky: RefObject<HTMLElement | null>,
): Dock {
    const [list, setList] = useState(() => readMinimized(storageKey));
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(list));
        } catch {
            // The cards just open again next time.
        }
    }, [storageKey, list]);
    const minimized = useMemo(() => new Set(list), [list]);
    const [cards] = useState(() => new Map<string, HTMLDivElement>());
    const [buttons] = useState(() => new Map<string, HTMLButtonElement>());

    const scrollTo = useCallback(
        (card: HTMLElement, behavior: ScrollBehavior) => {
            const offset = (sticky.current?.offsetHeight ?? 0) + 16;
            card.style.scrollMarginTop = `${offset}px`;
            card.scrollIntoView({ behavior, block: "start" });
        },
        [sticky],
    );

    const minimize = useCallback(
        (id: string) => {
            const card = cards.get(id);
            const button = buttons.get(id);
            const inner = card?.firstElementChild as HTMLElement | null;
            const hide = () =>
                setList((ids) => (ids.includes(id) ? ids : [...ids, id]));
            if (!card || !button || !inner) return hide();
            const from = card.getBoundingClientRect();
            const to = button.getBoundingClientRect();
            inner.style.transformOrigin = "top left";
            inner.style.position = "relative";
            inner.style.zIndex = "20";
            inner.animate(
                [
                    { transform: "none", opacity: 1 },
                    { transform: onto(from, to), opacity: 0.4 },
                ],
                { duration: DURATION_MS, easing: "cubic-bezier(.5,0,.75,0)" },
            );
            // The cards below close the gap as it leaves.
            card.animate([{ height: `${from.height}px` }, { height: "0px" }], {
                duration: DURATION_MS,
                easing: "ease-in-out",
            }).onfinish = () => {
                inner.style.zIndex = "";
                hide();
            };
        },
        [cards, buttons],
    );

    /** Grows a card that was just shown out of its button. */
    const grow = useCallback(
        (id: string) => {
            const card = cards.get(id);
            const button = buttons.get(id);
            const inner = card?.firstElementChild as HTMLElement | null;
            if (!card || !button || !inner) return;
            scrollTo(card, "instant");
            const to = card.getBoundingClientRect();
            const from = button.getBoundingClientRect();
            inner.style.transformOrigin = "top left";
            inner.style.position = "relative";
            inner.style.zIndex = "20";
            inner.animate(
                [
                    { transform: onto(to, from), opacity: 0.4 },
                    { transform: "none", opacity: 1 },
                ],
                { duration: DURATION_MS, easing: "cubic-bezier(.25,1,.5,1)" },
            ).onfinish = () => {
                inner.style.zIndex = "";
            };
        },
        [cards, buttons, scrollTo],
    );

    const press = useCallback(
        (id: string) => {
            if (minimized.has(id)) {
                // Shown at once, so it can be measured and grown.
                flushSync(() =>
                    setList((ids) => ids.filter((other) => other !== id)),
                );
                grow(id);
                return;
            }
            const card = cards.get(id);
            if (card) scrollTo(card, "smooth");
        },
        [minimized, cards, grow, scrollTo],
    );

    const registerCard = useCallback(
        (id: string, element: HTMLDivElement | null) => {
            if (element) cards.set(id, element);
            else cards.delete(id);
        },
        [cards],
    );
    const registerButton = useCallback(
        (id: string, element: HTMLButtonElement | null) => {
            if (element) buttons.set(id, element);
            else buttons.delete(id);
        },
        [buttons],
    );

    return useMemo(
        () => ({ minimized, minimize, press, registerCard, registerButton }),
        [minimized, minimize, press, registerCard, registerButton],
    );
}

export function CardDockProvider({
    dock,
    children,
}: {
    dock: Dock;
    children: ReactNode;
}) {
    return <DockContext.Provider value={dock}>{children}</DockContext.Provider>;
}

function useDock(): Dock {
    const dock = useContext(DockContext);
    if (!dock) throw new Error("A docked card needs a CardDockProvider");
    return dock;
}

/** A card that can be minimized into its dock button. */
export function DockedCard({
    id,
    children,
}: {
    id: string;
    children: ReactNode;
}) {
    const dock = useDock();
    const hidden = dock.minimized.has(id);

    return (
        <CardIdContext.Provider value={id}>
            <div
                ref={(element) => dock.registerCard(id, element)}
                className={hidden ? "hidden" : undefined}
            >
                {children}
            </div>
        </CardIdContext.Provider>
    );
}

/** The minimize button in a docked card's header. */
export function MinimizeButton() {
    const dock = useContext(DockContext);
    const id = useContext(CardIdContext);
    if (!dock || id === null) return null;
    return (
        <Button
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0"
            aria-label="Minimize"
            title="Minimize"
            onClick={() => dock.minimize(id)}
        >
            <Minimize2 />
        </Button>
    );
}

/** The row of dock buttons, one per card, in the sticky bar. */
export function CardDockBar({ items }: { items: readonly DockItem[] }) {
    const dock = useDock();
    return (
        <div className="flex flex-wrap gap-1.5 py-0.5">
            {items.map(({ id, label, icon: Icon }) => {
                const minimized = dock.minimized.has(id);
                return (
                    <button
                        key={id}
                        type="button"
                        ref={(element) => dock.registerButton(id, element)}
                        onClick={() => dock.press(id)}
                        title={minimized ? `Open ${label}` : `Go to ${label}`}
                        className={`flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors ${
                            minimized
                                ? "border-dashed border-border text-muted-foreground hover:bg-secondary"
                                : "border-transparent bg-secondary text-foreground hover:bg-secondary/70"
                        }`}
                    >
                        <Icon className="size-3.5" />
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
