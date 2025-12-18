/**
 * Top bar component showing logo, money, resources, workers, user actions, and
 * navigation.
 */

import {
    Link,
    useLocation,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import {
    AlertCircle,
    Bell,
    FlaskConical,
    Hammer,
    HelpCircle,
    Menu,
    Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Navigation } from "./Navigation";
import { NotificationPopup } from "./NotificationPopup";

import { Modal } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "@/hooks/useAuth";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePlayerMoney } from "@/hooks/usePlayerMoney";
import { usePlayerResources } from "@/hooks/usePlayerResources";
import { usePlayerWorkers } from "@/hooks/usePlayerWorkers";
import { useRouteStaticData } from "@/hooks/useRouteStaticData";
import { Money } from "@/types/money";
import { Resources } from "@/types/resources";
import { Workers } from "@/types/workers";

export function TopBar() {
    const { user } = useAuth();
    const capabilities = useCapabilities();
    const { isMenuOpen, setIsMenuOpen } = useNavigation();
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

    const location = useLocation();
    const staticData = useRouteStaticData(location as never);
    const search = useSearch({
        strict: false,
    });
    const isShowingHelp = search.help === "";
    const navigate = useNavigate();
    const handleCloseHelp = useCallback(() => {
        navigate({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search: { ...search, help: undefined } as any,
            replace: true,
        });
    }, [navigate, search]);
    const handleShowHelp = useCallback(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({ search: { ...search, help: "" } as any, replace: true });
    }, [navigate, search]);
    // If
    useEffect(() => {
        if (!staticData) return;
        if (!staticData.infoModal) handleCloseHelp();
    }, [staticData, handleCloseHelp]);

    if (!user) return null;
    if (!capabilities) return null;

    return (
        <>
            {/* Navigation - both bar for desktop and side window for mobile */}
            <Navigation />

            <div className="bg-game-bg border-b border-pine-darker px-4 py-1">
                <div className="flex items-center justify-between gap-4">
                    {/* Logo */}
                    {Logo()}

                    {/* Resources and Actions */}
                    <div className="flex items-center gap-4">
                        {/* Money and Resources */}
                        <div className="bg-content-bg text-primary rounded px-3 py-0 md:px-4">
                            <div className="flex gap-3 md:gap-3 items-center">
                                {/* Money */}
                                {MoneyDisplay(
                                    isMoneyLoading,
                                    moneyData,
                                    isMoneyError,
                                    isConnected,
                                    moneyError,
                                )}

                                {/* Resource Gauges - only show if warehouse unlocked */}
                                {capabilities?.has_warehouse &&
                                    ResourceGauges(
                                        isResourcesError,
                                        isResourcesLoading,
                                        resourcesData,
                                    )}

                                {/* Workers */}
                                {WorkersDisplay(
                                    isWorkersError,
                                    isWorkersLoading,
                                    workersData,
                                    capabilities,
                                )}
                            </div>
                        </div>

                        {/* Help Button, Settings, Notifications, Theme Toggle, and Mobile Menu */}
                        <div className="flex gap-2 flex-shrink-0">
                            {staticData?.infoModal && (
                                <button
                                    onClick={() => handleShowHelp()}
                                    className="px-2 py-2 text-bone-text dark:text-dark-text-primary rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors h-9 aspect-square"
                                    aria-label="Show help"
                                >
                                    <HelpCircle size={20} />
                                </button>
                            )}

                            <Link
                                to="/app/settings"
                                className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-2 py-2 lg:px-4 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors flex items-center justify-center aspect-square lg:aspect-auto h-9"
                            >
                                <Settings size={20} />
                                <span className="ml-2 hidden lg:inline">
                                    Settings
                                </span>
                            </Link>

                            <button
                                onClick={() => setShowNotifications(true)}
                                className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-2 py-2 lg:px-4 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors relative flex items-center justify-center aspect-square lg:aspect-auto h-9"
                            >
                                <Bell size={20} />
                                <span className="ml-2 hidden lg:inline">
                                    Notifications
                                </span>
                                {/* Unread badge - TODO: Show actual count */}
                                {0 > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-pine dark:bg-brand-green text-pine-text text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {0}
                                    </span>
                                )}
                            </button>

                            {/* Theme toggle */}
                            <ThemeToggle className="px-2 py-2 bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors h-9 aspect-square" />

                            {/* Mobile menu button */}
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="md:hidden bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-2 py-2 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors flex items-center justify-center aspect-square h-9"
                                aria-label="Toggle navigation menu"
                            >
                                <Menu size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Popup Modal */}
            <NotificationPopup
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
            />

            {/* Help / info modal */}
            {staticData?.infoModal && (
                <Modal
                    isOpen={isShowingHelp}
                    onClose={handleCloseHelp}
                    title={
                        staticData.infoModal.title ??
                        "Help: " + staticData.title
                    }
                >
                    {staticData.infoModal.contents}
                </Modal>
            )}
        </>
    );
}

function WorkersDisplay(
    isWorkersError: boolean,
    isWorkersLoading: boolean,
    workersData: Workers | undefined,
    capabilities: {
        has_laboratory: boolean;
        has_warehouse: boolean;
        has_storage: boolean;
        has_network: boolean;
        has_greenhouse_gas_effect: boolean;
    } | null,
) {
    return (
        <div className="flex flex-col text-sm justify-around">
            {/* Construction Workers */}
            <div className="flex items-center gap-1 relative group">
                <span className={isWorkersError ? "opacity-75" : ""}>
                    {isWorkersLoading && !workersData
                        ? "..."
                        : `${workersData?.construction.available ?? 0}/${workersData?.construction.total ?? 0}`}
                </span>
                <Hammer size={16} />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Construction workers
                </div>
            </div>

            {/* Lab Workers - only show if laboratory unlocked */}
            {capabilities?.has_laboratory && (
                <div className="flex items-center gap-1 relative group">
                    <span className={isWorkersError ? "opacity-75" : ""}>
                        {isWorkersLoading && !workersData
                            ? "..."
                            : `${workersData?.laboratory.available ?? 0}/${workersData?.laboratory.total ?? 0}`}
                    </span>
                    <FlaskConical size={16} />
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Lab workers
                    </div>
                </div>
            )}
        </div>
    );
}

function ResourceGauges(
    isResourcesError: boolean,
    isResourcesLoading: boolean,
    resourcesData: Resources | undefined,
) {
    return (
        <div className="flex flex-col gap-1">
            {/* Coal */}
            <div className="relative group">
                <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isResourcesError ? "opacity-75" : ""}`}
                        style={{
                            width: isResourcesLoading
                                ? "0%"
                                : `${Math.min(
                                      100,
                                      ((resourcesData?.coal.stock ?? 0) /
                                          (resourcesData?.coal.capacity || 1)) *
                                          100,
                                  )}%`,
                            backgroundColor: "var(--asset-color-coal)",
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
                <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isResourcesError ? "opacity-75" : ""}`}
                        style={{
                            width: isResourcesLoading
                                ? "0%"
                                : `${Math.min(
                                      100,
                                      ((resourcesData?.gas.stock ?? 0) /
                                          (resourcesData?.gas.capacity || 1)) *
                                          100,
                                  )}%`,
                            backgroundColor: "var(--asset-color-gas)",
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
                <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isResourcesError ? "opacity-75" : ""}`}
                        style={{
                            width: isResourcesLoading
                                ? "0%"
                                : `${Math.min(
                                      100,
                                      ((resourcesData?.uranium.stock ?? 0) /
                                          (resourcesData?.uranium.capacity ||
                                              1)) *
                                          100,
                                  )}%`,
                            backgroundColor: "var(--asset-color-uranium)",
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
    );
}

function MoneyDisplay(
    isMoneyLoading: boolean,
    moneyData: undefined | Money,
    isMoneyError: boolean,
    isConnected: boolean,
    moneyError: Error | null,
) {
    return (
        <div className="text-base md:text-xl lg:text-2xl font-bold relative whitespace-nowrap">
            {isMoneyLoading && !moneyData ? (
                <span className="text-gray-500">Loading...</span>
            ) : (
                <>
                    {/* Show offline indicator if error */}
                    {isMoneyError && !isConnected && (
                        <span
                            className="absolute -top-1 -right-1 text-xs text-red-600"
                            title={moneyError?.message || "Connection lost"}
                        >
                            <AlertCircle size={16} />
                        </span>
                    )}
                    {/* Show stale data even if error */}
                    <span className={isMoneyError ? "opacity-75" : ""}>
                        $
                        {(moneyData?.money ?? 0).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                        })}
                    </span>
                </>
            )}
        </div>
    );
}

function Logo() {
    return (
        <div className="flex items-center gap-2">
            <img
                src="/static/images/icon.svg"
                alt="Energetica"
                className="w-8 h-8 brightness-0 saturate-100 hue-rotate-90 opacity-70 dark:invert dark:brightness-100 dark:saturate-100 dark:hue-rotate-0 dark:opacity-100"
                style={{
                    filter: "brightness(0) saturate(100%) invert(18%) sepia(18%) saturate(2873%) hue-rotate(88deg) brightness(95%) contrast(88%)",
                }}
            />
            <span className="text-xl font-bold text-primary">Energetica</span>
        </div>
    );
}
