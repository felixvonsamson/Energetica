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
    FlagTriangleRight,
    FlaskConical,
    Hammer,
    HelpCircle,
    LogOut,
    Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NotificationPopup } from "@/components/layout/notification-popup";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Money as MoneyComponent } from "@/components/ui/money";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePlayerMoney } from "@/hooks/usePlayerMoney";
import { usePlayerWorkers } from "@/hooks/usePlayerWorkers";
import { cn } from "@/lib/utils";
import { Money } from "@/types/money";
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
    const { isConnected } = useOnlineStatus();
    const unreadCount = useUnreadNotificationsCount();
    const [showNotifications, setShowNotifications] = useState(false);
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

                <div className="grow" />

                <div className="flex items-center justify-between gap-4">
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

                        {/* Workers */}
                        {WorkersDisplay(
                            isWorkersError,
                            isWorkersLoading,
                            workersData,
                            capabilities,
                        )}
                    </div>

                    {/* Help Button */}
                    {staticData?.infoModal && (
                        <ButtonGroup>
                            <Button
                                onClick={() => handleShowHelp()}
                                variant="outline"
                                size="icon"
                                aria-label="Show help"
                            >
                                <HelpCircle size={20} />
                            </Button>
                        </ButtonGroup>
                    )}

                    {/* Notifications, Theme Toggle and User Menu */}
                    <ButtonGroup>
                        <Button
                            onClick={() => setShowNotifications(true)}
                            variant="outline"
                            className="relative lg:px-4 aspect-square lg:aspect-auto"
                        >
                            <Bell size={20} />
                            {/* Unread badge */}
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center z-20">
                                    {unreadCount}
                                </span>
                            )}
                        </Button>

                        <ThemeToggle variant="icon-only" />

                        {/* User dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="User menu"
                                >
                                    <CircleUser size={20} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel asChild>
                                    <p>{user.username}</p>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <a
                                        href={
                                            "https://github.com/felixvonsamson/Energetica/issues/new"
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <FlagTriangleRight size={20} />
                                        Report an issue
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link
                                        to="/app/settings"
                                        className="flex items-center gap-2"
                                    >
                                        <Settings size={20} />
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link
                                        to="/app/logout"
                                        className="flex items-center gap-2"
                                    >
                                        <LogOut size={20} />
                                        Logout
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </ButtonGroup>
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
        <>
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
        </>
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
                    <MoneyComponent
                        amount={moneyData?.money ?? 0}
                        long
                        iconSize="lg"
                        className={cn(isMoneyError && "opacity-75")}
                    />
                </>
            )}
        </div>
    );
}
