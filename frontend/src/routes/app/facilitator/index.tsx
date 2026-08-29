/**
 * Facilitator settings page (#1020): the join link/QR code for this private
 * instance, and the "allow joining" toggle gating it.
 *
 * Deliberately doesn't use `GameLayout`/`AppSidebar` — those assume a settled
 * player (capability flags, money, workers), none of which an admin account
 * has. This page is a small, self-contained shell instead.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import Logo from "@/assets/simplified_logo.svg?react";
import { JoinQrCode } from "@/components/facilitator/join-qr-code";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    InfoBanner,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TypographyH2, TypographyMuted } from "@/components/ui/typography";
import {
    useFacilitatorAccess,
    useSetJoinOpen,
} from "@/hooks/use-facilitator-access";
import { getUserFriendlyError } from "@/lib/error-utils";
import { buildJoinUrl } from "@/lib/facilitator";

function FacilitatorHelp() {
    return (
        <div className="space-y-3">
            <p>
                Share the join link or QR code below with the people you want to
                let into this instance. While "Allow joining" is off, the link
                shows a "contact the administrator" message instead of letting
                anyone in.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilitator/")({
    component: FacilitatorPage,
    staticData: {
        title: "Facilitator",
        routeConfig: { requiredRole: "admin" },
        infoDialog: { contents: <FacilitatorHelp /> },
    },
});

function FacilitatorHeader() {
    return (
        <header className="shrink-0 flex h-(--topbar-height) items-center justify-between border-b border-border-brand bg-topbar px-4">
            <Link to="/app" className="flex items-center gap-1.5">
                <Logo className="size-10 fill-foreground" />
                <span className="font-titles text-lg">
                    Energetica — Facilitator
                </span>
            </Link>
            <div className="flex items-center gap-2">
                <ThemeToggle variant="icon-only" />
                <Button variant="outline" asChild>
                    <Link to="/app/logout">Log out</Link>
                </Button>
            </div>
        </header>
    );
}

function FacilitatorPage() {
    return (
        <div className="flex min-h-svh flex-col">
            <FacilitatorHeader />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-xl mx-auto">
                    <JoinLinkCard />
                </div>
            </main>
        </div>
    );
}

function JoinLinkCard() {
    const { data, isLoading, isError, error } = useFacilitatorAccess();
    const {
        mutate: setJoinOpen,
        isPending,
        error: setJoinOpenError,
    } = useSetJoinOpen();
    const [copied, setCopied] = useState(false);

    // Reset the "Copied!" confirmation a couple seconds after each copy, and on unmount.
    useEffect(() => {
        if (!copied) return;
        const timeout = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timeout);
    }, [copied]);

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <InfoBanner variant="error">
                {getUserFriendlyError(error)}
            </InfoBanner>
        );
    }

    const joinUrl = buildJoinUrl(window.location.origin, data.join_token);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(joinUrl);
            setCopied(true);
        } catch {
            // Clipboard access can be denied (permissions, insecure context); the link is still
            // selectable text in the input below, so this is a silent no-op rather than an error.
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>Join link</TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    Anyone with this link (or who scans the QR code) can join
                    this instance while joining is allowed below.
                </TypographyMuted>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <Label htmlFor="join-open-switch">Allow joining</Label>
                        <TypographyMuted>
                            Turn off to stop the link from admitting new
                            accounts.
                        </TypographyMuted>
                    </div>
                    <Switch
                        id="join-open-switch"
                        checked={data.join_open}
                        disabled={isPending}
                        onCheckedChange={(checked) => setJoinOpen(checked)}
                    />
                </div>
                {setJoinOpenError && (
                    <InfoBanner variant="error">
                        {getUserFriendlyError(setJoinOpenError)}
                    </InfoBanner>
                )}

                <Separator />

                <div className="space-y-2">
                    <Label htmlFor="join-url">Link</Label>
                    <div className="flex gap-2">
                        <Input id="join-url" readOnly value={joinUrl} />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Copy join link"
                            onClick={handleCopy}
                        >
                            {copied ? (
                                <Check className="text-success" />
                            ) : (
                                <Copy />
                            )}
                        </Button>
                    </div>
                </div>

                <div className="flex justify-center">
                    <JoinQrCode value={joinUrl} />
                </div>
            </CardContent>
        </Card>
    );
}
