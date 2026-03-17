/**
 * Notification popup dialog. Shows all notifications with ability to filter by
 * category, flag, archive, delete, and mark all as read.
 */

import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArchiveIcon, Bookmark, X } from "lucide-react";
import { useMemo, useState } from "react";

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
    useFlagNotification,
    useArchiveNotification,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import {
    NOTIFICATION_CATEGORIES,
    CATEGORY_LABELS,
    type NotificationCategory,
    type NotificationPayload,
} from "@/types/notifications";

function getNotificationText(payload: NotificationPayload): {
    title: string;
    body: string;
} {
    switch (payload.type) {
        case "construction_finished":
            return {
                title: "Construction finished",
                body: `${payload.project_name}${payload.level != null ? ` (level ${payload.level})` : ""} is now operational.`,
            };
        case "technology_researched":
            return {
                title: "Research complete",
                body: `${payload.technology_name} level ${payload.new_level} unlocked.`,
            };
        case "facility_decommissioned":
            return {
                title: "Facility decommissioned",
                body: `${payload.facility_name} has been decommissioned.`,
            };
        case "facility_destroyed":
            return {
                title: "Facility destroyed",
                body: `${payload.facility_name} was destroyed by ${payload.event_name}.`,
            };
        case "emergency_facility_created":
            return {
                title: "Emergency facility",
                body: `A ${payload.facility_name} was created automatically.`,
            };
        case "climate_event":
            return {
                title: "Climate event",
                body: `${payload.event_name} · ${payload.duration_days}d · ${payload.cost_per_hour}`,
            };
        case "resource_sold":
            return {
                title: "Resource sold",
                body: `${payload.buyer_username} purchased your ${payload.resource}.`,
            };
        case "shipment_arrived":
            return {
                title: "Shipment arrived",
                body: `${payload.resource}${payload.warehouse_full ? " (warehouse full)" : ""}`,
            };
        case "credit_limit_exceeded":
            return {
                title: "Credit limit exceeded",
                body: "Not enough money for market participation.",
            };
        case "achievement_unlocked":
            return {
                title: "Achievement unlocked",
                body: payload.achievement_name,
            };
    }
}

const CATEGORIES: NotificationCategory[] = [
    "projects",
    "market",
    "events",
    "achievements",
];

interface NotificationPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationPopup({ isOpen, onClose }: NotificationPopupProps) {
    const { data, isLoading, error } = useNotifications();
    const { mutate: deleteNotification } = useDeleteNotification();
    const { mutate: markAllRead, isPending: isMarkingAllRead } =
        useMarkAllNotificationsRead();
    const { mutate: flagNotification } = useFlagNotification();
    const { mutate: archiveNotification } = useArchiveNotification();

    const [activeCategory, setActiveCategory] = useState<
        NotificationCategory | "all"
    >("all");

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
            (n) => NOTIFICATION_CATEGORIES[n.payload.type] === activeCategory,
        );
    }, [notifications, activeCategory]);

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.read).length,
        [notifications],
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Notifications</DialogTitle>
                        {unreadCount > 0 && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => markAllRead()}
                                disabled={isMarkingAllRead}
                                className="flex items-center gap-2"
                            >
                                {isMarkingAllRead && <Spinner />}
                                Mark all as read
                            </Button>
                        )}
                    </div>
                    <DialogDescription>
                        View and manage your notifications.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col max-h-[60vh]">
                    {/* Category filter tabs */}
                    <div className="flex gap-1 mb-3 flex-wrap">
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

                    {/* Notifications list */}
                    <div className="flex-1 overflow-y-auto -mx-6 px-6">
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
                                        getNotificationText(
                                            notification.payload,
                                        );
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
                                            className={cn(
                                                "p-4 rounded border mb-3",
                                                notification.read
                                                    ? "bg-secondary/20 border-border"
                                                    : "bg-secondary/60 border-border",
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
                                                        onClick={() =>
                                                            flagNotification({
                                                                id: notification.id,
                                                                flagged:
                                                                    !notification.flagged,
                                                            })
                                                        }
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
                                                    {/* Archive button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            archiveNotification(
                                                                {
                                                                    id: notification.id,
                                                                    archived:
                                                                        true,
                                                                },
                                                            )
                                                        }
                                                        className="h-8 w-8"
                                                        aria-label="Archive notification"
                                                    >
                                                        <ArchiveIcon className="w-4 h-4" />
                                                    </Button>
                                                    {/* Delete button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            deleteNotification(
                                                                notification.id,
                                                            )
                                                        }
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
