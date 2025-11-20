/**
 * Top bar component showing logo, money, resources, workers, and user actions.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayerMoney } from "@/hooks/usePlayerMoney";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { NotificationPopup } from "./NotificationPopup";

export function TopBar() {
    const { user } = useAuth();
    const {
        data: moneyData,
        isLoading: isMoneyLoading,
        isError,
        error,
    } = usePlayerMoney();
    const { isConnected } = useOnlineStatus();
    const [showNotifications, setShowNotifications] = useState(false);

    if (!user) return null;

    return (
        <>
            <div className="bg-[#2d5016] border-b border-[#1a2f0d] px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <img
                            src="/static/images/icon.svg"
                            alt="Energetica"
                            className="w-8 h-8"
                        />
                        <span className="text-xl font-bold">Energetica</span>
                    </div>

                    {/* Resources and Actions */}
                    <div className="flex items-start gap-4">
                        {/* Money and Resources */}
                        <div className="bg-[#c9d4b5] text-black rounded px-4 py-2">
                            {/* Money */}
                            <div className="text-2xl font-bold mb-2 relative">
                                {isMoneyLoading && !moneyData ? (
                                    <span className="text-gray-500">
                                        Loading...
                                    </span>
                                ) : (
                                    <>
                                        {/* Show offline indicator if error */}
                                        {isError && !isConnected && (
                                            <span
                                                className="absolute -top-1 -right-1 text-xs text-red-600"
                                                title={
                                                    error?.message ||
                                                    "Connection lost"
                                                }
                                            >
                                                <i className="fa fa-exclamation-circle"></i>
                                            </span>
                                        )}
                                        {/* Show stale data even if error */}
                                        <span
                                            className={
                                                isError ? "opacity-75" : ""
                                            }
                                        >
                                            $
                                            {(
                                                moneyData?.money ?? 0
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Resource Gauges - TODO: Only show if warehouse unlocked */}
                            <div className="flex gap-2 mb-2">
                                {/* Coal */}
                                <div className="relative group">
                                    <div className="w-16 h-4 bg-gray-300 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gray-800"
                                            style={{ width: "0%" }}
                                        ></div>
                                    </div>
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        Coal stock
                                    </div>
                                </div>

                                {/* Gas */}
                                <div className="relative group">
                                    <div className="w-16 h-4 bg-gray-300 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-600"
                                            style={{ width: "0%" }}
                                        ></div>
                                    </div>
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        Gas stock
                                    </div>
                                </div>

                                {/* Uranium */}
                                <div className="relative group">
                                    <div className="w-16 h-4 bg-gray-300 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-600"
                                            style={{ width: "0%" }}
                                        ></div>
                                    </div>
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        Uranium stock
                                    </div>
                                </div>
                            </div>

                            {/* Workers */}
                            <div className="flex gap-3 text-sm">
                                {/* Construction Workers */}
                                <div className="flex items-center gap-1 relative group">
                                    <span>0/0</span>
                                    <img
                                        src="/static/images/icons/construction.png"
                                        alt="Construction"
                                        className="w-4 h-4"
                                    />
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        Construction workers
                                    </div>
                                </div>

                                {/* Lab Workers */}
                                <div className="flex items-center gap-1 relative group">
                                    <span>0/0</span>
                                    <img
                                        src="/static/images/icons/technology.png"
                                        alt="Technology"
                                        className="w-4 h-4"
                                    />
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        Lab workers
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Settings and Notifications */}
                        <div className="flex flex-col gap-2">
                            <a
                                href="/settings"
                                className="bg-[#e8dcc0] text-black px-4 py-2 rounded hover:bg-[#d4c8ac] transition-colors text-center"
                            >
                                <i className="fa fa-cog"></i>
                                <span className="ml-2">Settings</span>
                            </a>

                            <button
                                onClick={() => setShowNotifications(true)}
                                className="bg-[#e8dcc0] text-black px-4 py-2 rounded hover:bg-[#d4c8ac] transition-colors text-center relative"
                            >
                                <i className="fa fa-bell"></i>
                                <span className="ml-2">Notifications</span>
                                {/* Unread badge - TODO: Show actual count */}
                                {0 > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-[#2d5016] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {0}
                                    </span>
                                )}
                            </button>

                            {/* Small notification list - shows on button hover/click */}
                            {/* TODO: Implement small dropdown notification list */}
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Popup Modal */}
            <NotificationPopup
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
            />
        </>
    );
}
