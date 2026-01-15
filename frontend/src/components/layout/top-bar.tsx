/** Top bar component showing money, resources, workers, and user actions. */

import {
    Link,
    useMatches,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import {
    AlertCircle,
    Bell,
    CircleUser,
    FlaskConical,
    Hammer,
    HelpCircle,
    LogOut,
    Settings,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NotificationPopup } from "@/components/layout/notification-popup";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePlayerMoney } from "@/hooks/usePlayerMoney";
import { usePlayerResources } from "@/hooks/usePlayerResources";
import { usePlayerWorkers } from "@/hooks/usePlayerWorkers";
import { cn } from "@/lib/classname-utils";
import { Money } from "@/types/money";
import { Resources } from "@/types/resources";
import { Workers } from "@/types/workers";

export function TopBar() {
    const { user } = useAuth();
    const capabilities = useCapabilities();
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
    const unreadCount = useUnreadNotificationsCount();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const matches = useMatches();
    const currentMatch = matches[matches.length - 1];
    const staticData = currentMatch?.staticData;
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
    useEffect(() => {
        if (!staticData) return;
        if (!staticData.infoModal) handleCloseHelp();
    }, [staticData, handleCloseHelp]);

    // Close user dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                userDropdownRef.current &&
                !userDropdownRef.current.contains(event.target as Node)
            ) {
                setShowUserDropdown(false);
            }
        }

        if (showUserDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [showUserDropdown]);

    if (!user) return null;
    if (!capabilities) return null;

    return (
        <>
            <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
                {/* Sidebar trigger */}
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4"
                />

                <Breadcrumbs />

                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />

                <div className="flex flex-1 items-center justify-between gap-4">
                    {/* Money and Resources */}
                    <div className="flex gap-3 items-center">
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

                    {/* Help Button, Notifications, and User Menu */}
                    <div className="flex gap-2 shrink-0">
                        {staticData?.infoModal && (
                            <Button
                                onClick={() => handleShowHelp()}
                                variant="ghost"
                                size="icon"
                                aria-label="Show help"
                            >
                                <HelpCircle size={20} />
                            </Button>
                        )}

                        <Button
                            onClick={() => setShowNotifications(true)}
                            variant="ghost"
                            className="relative lg:px-4 aspect-square lg:aspect-auto"
                        >
                            <Bell size={20} />
                            <span className="ml-2 hidden lg:inline">
                                Notifications
                            </span>
                            {/* Unread badge */}
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {unreadCount}
                                </span>
                            )}
                        </Button>

                        {/* User dropdown */}
                        <div className="relative" ref={userDropdownRef}>
                            <Button
                                onClick={() =>
                                    setShowUserDropdown(!showUserDropdown)
                                }
                                variant="ghost"
                                size="icon"
                                aria-label="User menu"
                            >
                                <CircleUser size={20} />
                            </Button>

                            {/* Dropdown menu */}
                            {showUserDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded shadow-lg z-50">
                                    <ThemeToggle variant="menu-item" />

                                    <Link
                                        to="/app/settings"
                                        onClick={() =>
                                            setShowUserDropdown(false)
                                        }
                                        className="flex items-center gap-2 px-4 py-3 text-foreground hover:bg-accent transition-colors border-b border-border/50"
                                    >
                                        <Settings size={20} />
                                        <span>Settings</span>
                                    </Link>
                                    <Link
                                        to="/app/logout"
                                        onClick={() =>
                                            setShowUserDropdown(false)
                                        }
                                        className="flex items-center gap-2 px-4 py-3 text-foreground hover:bg-accent transition-colors"
                                    >
                                        <LogOut size={20} />
                                        <span>Logout</span>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Notification Popup Modal */}
            <NotificationPopup
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
            />

            {/* Help / info modal */}
            {staticData?.infoModal && (
                <Dialog
                    open={isShowingHelp}
                    onOpenChange={(open) => !open && handleCloseHelp()}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {staticData.infoModal.title ??
                                    "Help: " + staticData.title}
                            </DialogTitle>
                            <DialogDescription>
                                Information and help for this page.
                            </DialogDescription>
                        </DialogHeader>
                        {staticData.infoModal.contents}
                    </DialogContent>
                </Dialog>
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
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-5 border">
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
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-5 border">
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
                <div className="w-16 h-3 bg-muted rounded-full overflow-hidden">
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
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-5 border">
                    Coal stock:{" "}
                    {isResourcesLoading
                        ? "..."
                        : `${(resourcesData?.coal.stock ?? 0).toFixed(0)}kg / ${(resourcesData?.coal.capacity ?? 0).toFixed(0)}kg`}
                </div>
            </div>

            {/* Gas */}
            <div className="relative group">
                <div className="w-16 h-3 bg-muted rounded-full overflow-hidden">
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
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-5 border">
                    Gas stock:{" "}
                    {isResourcesLoading
                        ? "..."
                        : `${(resourcesData?.gas.stock ?? 0).toFixed(0)}kg / ${(resourcesData?.gas.capacity ?? 0).toFixed(0)}kg`}
                </div>
            </div>

            {/* Uranium */}
            <div className="relative group">
                <div className="w-16 h-3 bg-muted rounded-full overflow-hidden">
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
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-5 border">
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
                <span className="text-muted-foreground">Loading...</span>
            ) : (
                <>
                    {/* Show offline indicator if error */}
                    {isMoneyError && !isConnected && (
                        <span
                            className="absolute -top-1 -right-1 text-xs text-destructive"
                            title={moneyError?.message || "Connection lost"}
                        >
                            <AlertCircle size={16} />
                        </span>
                    )}
                    {/* Show stale data even if error */}
                    <span className={cn(isMoneyError && "opacity-75")}>
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
