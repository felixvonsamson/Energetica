import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    className?: string;
}

/**
 * Modal component with backdrop and close button.
 */
export function Modal({
    isOpen,
    onClose,
    title,
    children,
    className,
}: ModalProps) {
    useEffect(() => {
        if (!isOpen) return;

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscapeKey);
        return () => {
            document.removeEventListener("keydown", handleEscapeKey);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={handleBackdropClick}
        >
            <div
                className={cn(
                    "bg-brand-green dark:bg-dark-bg-tertiary rounded-lg max-w-2xl w-full p-6",
                    "text-white",
                    className,
                )}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-center flex-grow text-white">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-white/80 transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="text-base text-white">{children}</div>
            </div>
        </div>
    );
}
