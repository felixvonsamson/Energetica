/**
 * Top bar component showing logo, money, resources, workers, and user actions.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayerMoney } from "@/hooks/usePlayerMoney";
import { usePlayerWorkers } from "@/hooks/usePlayerWorkers";
import { usePlayerResources } from "@/hooks/usePlayerResources";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { NotificationPopup } from "./NotificationPopup";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function TopBar() {
    const { user } = useAuth();
    const {
        data: moneyData,
        isLoading: isMoneyLoading,
        isError: isMoneyError,
        error: moneyError,
    } = usePlayerMoney();
    const {
        data: workersData,
        isLoading: isWorkersLoading,
        isError: isWorkersError,
    } = usePlayerWorkers();
    const {
        data: resourcesData,
        isLoading: isResourcesLoading,
        isError: isResourcesError,
    } = usePlayerResources();
    const { isConnected } = useOnlineStatus();
    const [showNotifications, setShowNotifications] = useState(false);

    if (!user) return null;

    return (
        <>
            <div className="bg-game-bg border-b border-pine-darker px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <img
                            src="/static/images/icon.svg"
                            alt="Energetica"
                            className="w-8 h-8 brightness-0 saturate-100 hue-rotate-90 opacity-70 dark:invert dark:brightness-100 dark:saturate-100 dark:hue-rotate-0 dark:opacity-100"
                            style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(18%) saturate(2873%) hue-rotate(88deg) brightness(95%) contrast(88%)' }}
                        />
                        <span className="text-xl font-bold text-primary">Energetica</span>
                    </div>

                    {/* Resources and Actions */}
                    <div className="flex items-start gap-4">
                        {/* Money and Resources */}
                        <div className="bg-content-bg text-primary rounded px-4 py-2">
                            {/* Money */}
                            <div className="text-2xl font-bold mb-2 relative">
                                {isMoneyLoading && !moneyData ? (
                                    <span className="text-gray-500">
                                        Loading...
                                    </span>
                                ) : (
                                    <>
                                        {/* Show offline indicator if error */}
                                        {isMoneyError && !isConnected && (
                                            <span
                                                className="absolute -top-1 -right-1 text-xs text-red-600"
                                                title={
                                                    moneyError?.message ||
                                                    "Connection lost"
                                                }
                                            >
                                                <i className="fa fa-exclamation-circle"></i>
                                            </span>
                                        )}
                                        {/* Show stale data even if error */}
                                        <span
                                            className={
                                                isMoneyError ? "opacity-75" : ""
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
                                            className={`h-full bg-gray-800 ${isResourcesError ? "opacity-75" : ""}`}
                                            style={{
                                                width: isResourcesLoading
                                                    ? "0%"
                                                    : `${Math.min(
                                                          100,
                                                          ((resourcesData?.coal
                                                              .stock ?? 0) /
                                                              (resourcesData
                                                                  ?.coal
                                                                  .capacity ||
                                                                  1)) *
                                                              100
                                                      )}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        Coal stock:{" "}
                                        {isResourcesLoading
                                            ? "..."
                                            : `${(resourcesData?.coal.stock ?? 0).toFixed(0)}kg / ${(resourcesData?.coal.capacity ?? 0).toFixed(0)}kg`}
                                    </div>
                                </div>

                                {/* Gas */}
                                <div className="relative group">
                                    <div className="w-16 h-4 bg-gray-300 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full bg-amber-600 ${isResourcesError ? "opacity-75" : ""}`}
                                            style={{
                                                width: isResourcesLoading
                                                    ? "0%"
                                                    : `${Math.min(
                                                          100,
                                                          ((resourcesData?.gas
                                                              .stock ?? 0) /
                                                              (resourcesData
                                                                  ?.gas
                                                                  .capacity ||
                                                                  1)) *
                                                              100
                                                      )}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        Gas stock:{" "}
                                        {isResourcesLoading
                                            ? "..."
                                            : `${(resourcesData?.gas.stock ?? 0).toFixed(0)}kg / ${(resourcesData?.gas.capacity ?? 0).toFixed(0)}kg`}
                                    </div>
                                </div>

                                {/* Uranium */}
                                <div className="relative group">
                                    <div className="w-16 h-4 bg-gray-300 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full bg-green-600 ${isResourcesError ? "opacity-75" : ""}`}
                                            style={{
                                                width: isResourcesLoading
                                                    ? "0%"
                                                    : `${Math.min(
                                                          100,
                                                          ((resourcesData
                                                              ?.uranium.stock ??
                                                              0) /
                                                              (resourcesData
                                                                  ?.uranium
                                                                  .capacity ||
                                                                  1)) *
                                                              100
                                                      )}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        Uranium stock:{" "}
                                        {isResourcesLoading
                                            ? "..."
                                            : `${(resourcesData?.uranium.stock ?? 0).toFixed(0)}kg / ${(resourcesData?.uranium.capacity ?? 0).toFixed(0)}kg`}
                                    </div>
                                </div>
                            </div>

                            {/* Workers */}
                            <div className="flex gap-3 text-sm">
                                {/* Construction Workers */}
                                <div className="flex items-center gap-1 relative group">
                                    <span
                                        className={
                                            isWorkersError ? "opacity-75" : ""
                                        }
                                    >
                                        {isWorkersLoading && !workersData
                                            ? "..."
                                            : `${workersData?.construction.available ?? 0}/${workersData?.construction.total ?? 0}`}
                                    </span>
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
                                    <span
                                        className={
                                            isWorkersError ? "opacity-75" : ""
                                        }
                                    >
                                        {isWorkersLoading && !workersData
                                            ? "..."
                                            : `${workersData?.laboratory.available ?? 0}/${workersData?.laboratory.total ?? 0}`}
                                    </span>
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

                        {/* Settings, Notifications and Theme Toggle */}
                        <div className="flex flex-col gap-2">
                            <a
                                href="/settings"
                                className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-4 py-2 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors text-center flex items-center justify-center"
                            >
                                <i className="fa fa-cog"></i>
                                <span className="ml-2">Settings</span>
                            </a>

                            <button
                                onClick={() => setShowNotifications(true)}
                                className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-4 py-2 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors text-center relative flex items-center justify-center"
                            >
                                <i className="fa fa-bell"></i>
                                <span className="ml-2">Notifications</span>
                                {/* Unread badge - TODO: Show actual count */}
                                {0 > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-pine dark:bg-brand-green text-pine-text text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {0}
                                    </span>
                                )}
                            </button>

                            {/* Theme toggle placed next to settings/notifications to avoid overlap */}
                            <div className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-3 py-2 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors text-center flex items-center justify-center">
                                <ThemeToggle />
                            </div>

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
