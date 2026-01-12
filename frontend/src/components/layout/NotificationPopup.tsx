/**
 * Notification popup modal. Shows all notifications with ability to mark as
 * read and delete.
 */

import { Link } from "@tanstack/react-router";
import { Circle, X } from "lucide-react";
import { useMemo } from "react";

import { Modal } from "@/components/ui/Modal";
import {
    useNotifications,
    useDeleteNotification,
    useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import { cn } from "@/lib/classname-utils";

interface NotificationPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationPopup({ isOpen, onClose }: NotificationPopupProps) {
    const { data, isLoading, error } = useNotifications();
    const { mutate: deleteNotification } = useDeleteNotification();
    const { mutate: markAllRead, isPending: isMarkingAllRead } =
        useMarkAllNotificationsRead();

    const notifications = useMemo(() => {
        const notifs = data?.notifications || [];
        return [...notifs].sort((a, b) => {
            return new Date(b.time).getTime() - new Date(a.time).getTime();
        });
    }, [data]);

    const unreadCount = useMemo(() => {
        return notifications.filter((n) => !n.read).length;
    }, [notifications]);

    const handleMarkAllRead = () => {
        markAllRead();
    };

    const handleDeleteNotification = (id: number) => {
        deleteNotification(id);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Notifications">
            <div className="flex flex-col max-h-[60vh]">
                {/* Mark all as read button */}
                {unreadCount > 0 && (
                    <div className="mb-4 flex justify-end">
                        <button
                            onClick={handleMarkAllRead}
                            disabled={isMarkingAllRead}
                            className={cn(
                                "px-4 py-2 bg-secondary/50 hover:bg-secondary rounded transition-colors",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                            )}
                        >
                            {isMarkingAllRead
                                ? "Marking all read..."
                                : "Mark all as read"}
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto -mx-6 px-6">
                    {isLoading ? (
                        <div className="text-center text-muted-foreground py-8">
                            Loading notifications...
                        </div>
                    ) : error ? (
                        <div className="text-center text-destructive py-8">
                            Failed to load notifications
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            No notifications
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "p-4 rounded border",
                                        notification.read
                                            ? "bg-secondary/20 border-border"
                                            : "bg-secondary/60 border-border",
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-card-foreground">
                                                {notification.title}
                                            </h3>
                                            {!notification.read && (
                                                <Circle className="w-2 h-2 fill-current text-primary" />
                                            )}
                                        </div>
                                        <button
                                            onClick={() =>
                                                handleDeleteNotification(
                                                    notification.id,
                                                )
                                            }
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                            aria-label="Delete notification"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">
                                        {new Date(
                                            notification.time,
                                        ).toLocaleString()}
                                    </div>
                                    <div
                                        className="text-card-foreground text-sm"
                                        dangerouslySetInnerHTML={{
                                            __html: notification.content,
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-border">
                    <Link
                        to="/app/settings"
                        className="text-muted-foreground hover:text-card-foreground transition-colors text-sm"
                    >
                        Browser notifications settings
                    </Link>
                </div>
            </div>
        </Modal>
    );
}
