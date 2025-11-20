/**
 * Notification popup modal.
 * Shows all notifications with ability to mark as read and delete.
 */

import { X } from "lucide-react";

interface NotificationPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NotificationPopup({ isOpen, onClose }: NotificationPopupProps) {
    if (!isOpen) return null;

    // TODO: Fetch actual notifications
    const notifications: any[] = [];

    const handleMarkAllRead = () => {
        // TODO: Implement mark all as read
        onClose();
    };

    const handleDeleteNotification = (id: number) => {
        // TODO: Implement delete notification
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-[#2d5016] rounded-lg shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#1a2f0d]">
                    <h2 className="text-xl font-bold text-white">
                        Notifications
                    </h2>
                    <button
                        onClick={handleMarkAllRead}
                        className="text-white hover:text-gray-300 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {notifications.length === 0 ? (
                        <div className="text-center text-gray-300 py-8">
                            No notifications
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 rounded ${
                                        notification.read
                                            ? "bg-[#3d6020] opacity-70"
                                            : "bg-[#3d6020]"
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white">
                                                {notification.title}
                                            </h3>
                                            {!notification.read && (
                                                <i className="fa fa-circle text-xs text-white"></i>
                                            )}
                                        </div>
                                        <button
                                            onClick={() =>
                                                handleDeleteNotification(
                                                    notification.id
                                                )
                                            }
                                            className="text-white hover:text-red-300 text-xl leading-none"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-300 mb-2">
                                        {new Date(
                                            notification.time
                                        ).toLocaleString()}
                                    </div>
                                    <div
                                        className="text-white"
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
                <div className="p-4 border-t border-[#1a2f0d]">
                    <a
                        href="/settings"
                        className="text-white hover:text-gray-300 transition-colors"
                    >
                        Browser notifications settings
                    </a>
                </div>
            </div>
        </>
    );
}
