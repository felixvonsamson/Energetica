/**
 * Notification popup dialog. Shows all notifications with ability to filter by
 * category, flag, delete, and mark all as read.
 * Notifications are selectable via click or arrow keys; selection marks as read.
 * Delete key removes the selected notification.
 */

import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { TypographySmall } from "@/components/ui/typography";
import {
    useNotifications,
    useDeleteNotification,
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
    useFlagNotification,
} from "@/hooks/use-notifications";
import { getNotificationCategory, getNotificationContent } from "@/lib/notification-config";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type NotificationCategory } from "@/types/notifications";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as NotificationCategory[];

interface NotificationPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationPopup({ isOpen, onClose }: NotificationPopupProps) {
    const { data, isLoading, error } = useNotifications();
    const { mutate: deleteNotification } = useDeleteNotification();
    const { mutate: markAllRead, isPending: isMarkingAllRead } =
        useMarkAllNotificationsRead();
    const { mutate: markRead } = useMarkNotificationRead();
    const { mutate: flagNotification } = useFlagNotification();

    const [activeCategory, setActiveCategory] = useState<
        NotificationCategory | "all"
    >("all");
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const notifications = useMemo(() => {
        const notifs = data?.notifications ?? [];
        return [...notifs]
            .filter((n) => !n.archived)
            .sort(
                (a, b) =>
                    new Date(b.time).getTime() - new Date(a.time).getTime(),
            );
    }, [data]);

    const filteredNotifications = useMemo(() => {
        if (activeCategory === "all") return notifications;
        return notifications.filter(
            (n) => getNotificationCategory(n.payload.type) === activeCategory,
        );
    }, [notifications, activeCategory]);

    const unreadCount = useMemo(
        () => filteredNotifications.filter((n) => !n.read).length,
        [filteredNotifications],
    );

    // Derive the active selection — null if the selected notification is no longer in the list
    const activeSelectedId = useMemo(
        () =>
            selectedId !== null &&
            filteredNotifications.some((n) => n.id === selectedId)
                ? selectedId
                : null,
        [filteredNotifications, selectedId],
    );

    const selectNotification = useCallback(
        (id: number) => {
            setSelectedId(id);
            const notif = filteredNotifications.find((n) => n.id === id);
            if (notif && !notif.read) {
                markRead(id);
            }
        },
        [filteredNotifications, markRead],
    );

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture if focus is inside an interactive text element
            if (
                e.target instanceof HTMLButtonElement ||
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            )
                return;

            const idx = filteredNotifications.findIndex(
                (n) => n.id === activeSelectedId,
            );

            if (e.key === "ArrowDown") {
                e.preventDefault();
                const next =
                    idx === -1
                        ? filteredNotifications[0]
                        : filteredNotifications[idx + 1];
                if (next) selectNotification(next.id);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const prev =
                    idx <= 0
                        ? filteredNotifications[0]
                        : filteredNotifications[idx - 1];
                if (prev) selectNotification(prev.id);
            } else if (
                (e.key === "Delete" || e.key === "Backspace") &&
                activeSelectedId !== null
            ) {
                e.preventDefault();
                // Move selection to next item before deleting
                const next =
                    filteredNotifications[idx + 1] ??
                    filteredNotifications[idx - 1];
                deleteNotification(activeSelectedId);
                setSelectedId(next?.id ?? null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        isOpen,
        filteredNotifications,
        activeSelectedId,
        selectNotification,
        deleteNotification,
    ]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Notifications</DialogTitle>
                    <DialogDescription>
                        View and manage your notifications.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col max-h-[60vh]">
                    {/* Category filter tabs + actions row */}
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="flex gap-1 flex-wrap">
                            <button
                                onClick={() => setActiveCategory("all")}
                                className={cn(
                                    "px-3 py-1 rounded text-sm transition-colors",
                                    activeCategory === "all"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                                )}
                            >
                                All
                            </button>
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={cn(
                                        "px-3 py-1 rounded text-sm transition-colors",
                                        activeCategory === cat
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                                    )}
                                >
                                    {CATEGORY_LABELS[cat]}
                                </button>
                            ))}
                        </div>
                        {unreadCount > 0 && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => markAllRead()}
                                disabled={isMarkingAllRead}
                                className="flex items-center gap-2 shrink-0"
                            >
                                {isMarkingAllRead && <Spinner />}
                                Mark all as read
                            </Button>
                        )}
                    </div>

                    {/* Notifications list */}
                    <div
                        className="flex-1 overflow-y-auto -mx-6 px-6"
                    >
                        {isLoading ? (
                            <div className="text-center text-muted-foreground py-8">
                                Loading notifications...
                            </div>
                        ) : error ? (
                            <div className="text-center text-destructive py-8">
                                Failed to load notifications
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                {activeCategory === "all"
                                    ? "No notifications"
                                    : "No notifications in this category"}
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {filteredNotifications.map((notification) => {
                                    const { title, body } =
                                        getNotificationContent(
                                            notification.payload,
                                        );
                                    const isSelected =
                                        notification.id === activeSelectedId;
                                    return (
                                        <motion.div
                                            key={notification.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{
                                                opacity: 0,
                                                height: 0,
                                                marginBottom: 0,
                                            }}
                                            transition={{ duration: 0.2 }}
                                            onClick={() =>
                                                selectNotification(
                                                    notification.id,
                                                )
                                            }
                                            className={cn(
                                                "p-4 rounded border mb-3 cursor-pointer transition-colors",
                                                isSelected
                                                    ? "border-primary bg-secondary/60"
                                                    : notification.read
                                                      ? "bg-secondary/20 border-border hover:border-border/80 hover:bg-secondary/30"
                                                      : "bg-secondary/60 border-border hover:border-border/80",
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {!notification.read && (
                                                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                                    )}
                                                    <TypographySmall
                                                        className={cn(
                                                            "truncate",
                                                            !notification.read &&
                                                                "font-bold",
                                                        )}
                                                    >
                                                        {title}
                                                    </TypographySmall>
                                                </div>
                                                <div className="flex items-center gap-1 ml-2 shrink-0">
                                                    {/* Flag button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            flagNotification({
                                                                id: notification.id,
                                                                flagged:
                                                                    !notification.flagged,
                                                            });
                                                        }}
                                                        className="h-8 w-8"
                                                        aria-label={
                                                            notification.flagged
                                                                ? "Unflag notification"
                                                                : "Flag notification"
                                                        }
                                                    >
                                                        <Bookmark
                                                            className={cn(
                                                                "w-4 h-4",
                                                                notification.flagged &&
                                                                    "fill-current text-primary",
                                                            )}
                                                        />
                                                    </Button>
                                                    {/* Delete button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotification(
                                                                notification.id,
                                                            );
                                                        }}
                                                        className="h-8 w-8"
                                                        aria-label="Delete notification"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground mb-1">
                                                {new Date(
                                                    notification.time,
                                                ).toLocaleString()}
                                            </div>
                                            <div className="text-card-foreground text-sm">
                                                {body}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-border">
                        <Link
                            to="/app/settings"
                            onClick={onClose}
                            className="text-muted-foreground hover:text-card-foreground transition-colors text-sm"
                        >
                            Browser notifications settings
                        </Link>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
