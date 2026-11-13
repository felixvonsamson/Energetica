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
    FlaskConical,
    Hammer,
    HelpCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AccountMenu } from "@/components/layout/account-menu";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NotificationPopup } from "@/components/layout/notification-popup";
import { useAuth } from "@/hooks/use-auth";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useUnreadNotificationsCount } from "@/hooks/use-notifications";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { usePlayerMoney } from "@/hooks/use-player-money";
import { usePlayerWorkers } from "@/hooks/use-player-workers";
import { Money } from "@/types/money";
import { Capabilities } from "@/types/players";
import { Workers } from "@/types/workers";
import Logo from "@energetica/ui/assets/simplified_logo.svg?react";
import { Button } from "@energetica/ui/components/button";
import { ButtonGroup } from "@energetica/ui/components/button-group";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@energetica/ui/components/dialog";
import { Money as MoneyComponent } from "@energetica/ui/components/money";
import { Separator } from "@energetica/ui/components/separator";
import { SidebarTrigger } from "@energetica/ui/components/sidebar";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";
import { TypographyBrand } from "@energetica/ui/components/typography";
import { cn } from "@energetica/ui/lib/utils";

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
            <header className="shrink-0 z-10 flex h-(--topbar-height) items-center border-b border-border-brand bg-topbar px-4 gap-2">
                {/* Left: Sidebar trigger + Logo + Breadcrumbs */}
                <div className="flex items-center gap-2 shrink-0">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="bg-border-brand data-[orientation=vertical]:h-4"
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
                            className="bg-border-brand data-[orientation=vertical]:h-4"
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

                    {/* Notifications and theme toggle — desktop only; on mobile they are in the account menu */}
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
                    </ButtonGroup>

                    {/* Account menu — switch run, open lobby, account items (all sizes) */}
                    <AccountMenu
                        username={user.username}
                        unreadCount={unreadCount}
                        onShowNotifications={() => setShowNotifications(true)}
                    />
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
    capabilities: Capabilities | null,
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
