/**
 * Notification popup dialog. Shows all notifications with ability to mark as
 * read and delete.
 */

import { Link } from "@tanstack/react-router";
import { Circle, X } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { TypographyH2, TypographySmall } from "@/components/ui/typography";
import {
    useNotifications,
    useDeleteNotification,
    useMarkAllNotificationsRead,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import type { components } from "@/types/api.generated";

type NotificationPayload =
    components["schemas"]["NotificationOut"]["payload"];

function getNotificationTitle(payload: NotificationPayload): string {
    switch (payload.type) {
        case "construction_finished":
            return "Construction finished";
        case "technology_researched":
            return "Research complete";
        case "facility_decommissioned":
            return "Facility decommissioned";
        case "facility_destroyed":
            return "Facility destroyed";
        case "emergency_facility_created":
            return "Emergency facility";
        case "climate_event":
            return "Climate event";
        case "resource_sold":
            return "Resource sold";
        case "shipment_arrived":
            return "Shipment arrived";
        case "credit_limit_exceeded":
            return "Credit limit exceeded";
        case "achievement_unlocked":
            return "Achievement unlocked";
    }
}

function getNotificationContent(payload: NotificationPayload): string {
    switch (payload.type) {
        case "construction_finished":
            return `${payload.project_name} is now operational.`;
        case "technology_researched":
            return `${payload.technology_name} level ${payload.new_level} unlocked.`;
        case "facility_decommissioned":
            return `${payload.facility_name} was decommissioned.`;
        case "facility_destroyed":
            return `${payload.facility_name} was destroyed by ${payload.event_name}.`;
        case "emergency_facility_created":
            return `A ${payload.facility_name} was created automatically.`;
        case "climate_event":
            return `${payload.event_name} is affecting your facilities for ${payload.duration_days} days (${payload.cost_per_hour}/h).`;
        case "resource_sold":
            return `${payload.buyer_username} purchased your ${payload.resource}.`;
        case "shipment_arrived":
            return `Your ${payload.resource} shipment has arrived.`;
        case "credit_limit_exceeded":
            return "Not enough money for market participation.";
        case "achievement_unlocked":
            return `You unlocked: ${payload.achievement_name}`;
    }
}

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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Notifications</DialogTitle>
                    <DialogDescription>
                        View and manage your notifications.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col max-h-[60vh]">
                    {/* Mark all as read button */}
                    {unreadCount > 0 && (
                        <div className="mb-4 flex justify-end">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleMarkAllRead}
                                disabled={isMarkingAllRead}
                                className="flex items-center gap-2"
                            >
                                {isMarkingAllRead && <Spinner />}
                                Mark all as read
                            </Button>
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
                                                <TypographyH2>
                                                    <TypographySmall>
                                                        {getNotificationTitle(notification.payload)}
                                                    </TypographySmall>
                                                </TypographyH2>
                                                {!notification.read && (
                                                    <Circle className="w-2 h-2 fill-current text-primary" />
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleDeleteNotification(
                                                        notification.id,
                                                    )
                                                }
                                                className="h-8 w-8"
                                                aria-label="Delete notification"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-2">
                                            {new Date(
                                                notification.time,
                                            ).toLocaleString()}
                                        </div>
                                        <div className="text-card-foreground text-sm">
                                            {getNotificationContent(notification.payload)}
                                        </div>
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
            </DialogContent>
        </Dialog>
    );
}
