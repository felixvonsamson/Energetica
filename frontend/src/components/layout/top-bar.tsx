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
    MoreVertical,
    Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import Logo from "@/assets/icon.svg?react";
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
import { TypographyBrand } from "@/components/ui/typography";
import { useAuth } from "@/hooks/use-auth";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useUnreadNotificationsCount } from "@/hooks/use-notifications";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { usePlayerMoney } from "@/hooks/use-player-money";
import { usePlayerWorkers } from "@/hooks/use-player-workers";
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
        if (!staticData.infoDialog) handleCloseHelp();
    }, [staticData, handleCloseHelp]);

    if (!user) return null;
    if (!capabilities) return null;

    return (
        <>
            <header className="shrink-0 flex h-14 items-center border-b bg-topbar px-4 gap-2">
                {/* Left: Sidebar trigger + Logo + Breadcrumbs */}
                <div className="flex items-center gap-2 shrink-0">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="data-[orientation=vertical]:h-4"
                    />
                    <Link
                        to="/app"
                        className="flex items-center gap-1.5 shrink-0"
                    >
                        <Logo className="size-10 fill-foreground" />
                        <TypographyBrand className="hidden sm:block text-2xl mr-1">
                            Energetica
                        </TypographyBrand>
                    </Link>

                    {/* Breadcrumb navigation — hidden on mobile */}
                    <div className="hidden md:flex items-center gap-2">
                        <Separator
                            orientation="vertical"
                            className="data-[orientation=vertical]:h-4"
                        />
                        <Breadcrumbs />
                    </div>
                </div>

                {/* Center: Money */}
                <div className="flex-1 flex justify-center items-center">
                    {MoneyDisplay(
                        isMoneyLoading,
                        moneyData,
                        isMoneyError,
                        isConnected,
                        moneyError,
                    )}
                </div>

                {/* Right: Workers + actions */}
                <div className="flex items-center gap-4 shrink-0">
                    {/* Workers — stacked vertically on mobile, horizontal on desktop */}
                    <div className="flex flex-col md:flex-row items-end md:items-center gap-1 md:gap-3">
                        {WorkersDisplay(
                            isWorkersError,
                            isWorkersLoading,
                            workersData,
                            capabilities,
                        )}
                    </div>

                    {/* Help Button */}
                    {staticData?.infoDialog && (
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

                    {/* Notifications, Theme Toggle and User Menu — desktop only */}
                    <ButtonGroup className="hidden md:flex">
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

                    {/* Three-dots menu — mobile only */}
                    <div className="md:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="relative"
                                    aria-label="Menu"
                                >
                                    <MoreVertical size={20} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center z-20">
                                            {unreadCount}
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                    onSelect={() => setShowNotifications(true)}
                                >
                                    <Bell size={20} />
                                    Notifications
                                    {unreadCount > 0 && (
                                        <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            {unreadCount}
                                        </span>
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <ThemeToggle variant="menu-item" />
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
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
                    </div>
                </div>
            </header>

            {/* Notification Popup Dialog */}
            <NotificationPopup
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
            />

            {/* Help / info dialog */}
            {staticData?.infoDialog && (
                <Dialog
                    open={isShowingHelp}
                    onOpenChange={(open) => !open && handleCloseHelp()}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {staticData.infoDialog.title ??
                                    "Help: " + staticData.title}
                            </DialogTitle>
                            <DialogDescription>
                                Information and help for this page.
                            </DialogDescription>
                        </DialogHeader>
                        {staticData.infoDialog.contents}
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
                        className={cn(isMoneyError && "opacity-75")}
                    />
                </>
            )}
        </div>
    );
}
