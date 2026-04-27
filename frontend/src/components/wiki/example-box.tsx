import { type ReactNode } from "react";

interface ExampleBoxProps {
    children: ReactNode;
}

export function ExampleBox({ children }: ExampleBoxProps) {
    return (
        <>
            <span className="inline-block text-xs font-bold uppercase tracking-widest px-5">
                Example
            </span>
            <div className="overflow-hidden rounded-xl bg-surface-topbar px-5">{children}</div>
        </>
    );
}
