/**
 * Facilitator settings page (#1020): the join link/QR code for this private
 * instance, and the "allow joining" toggle gating it.
 *
 * Deliberately doesn't use `GameLayout`/`AppSidebar` — those assume a settled
 * player (capability flags, money, workers), none of which a facilitator
 * account has. This page is a small, self-contained shell instead.
 */

import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { FacilitatorHeader } from "@/components/facilitator/facilitator-header";
import { JoinQrCode } from "@/components/facilitator/join-qr-code";
import {
    useFacilitatorAccess,
    useSetJoinOpen,
} from "@/hooks/use-facilitator-access";
import { useRunMode } from "@/hooks/use-run-mode";
import { useWorkshopSession } from "@/hooks/use-workshop";
import { getUserFriendlyError } from "@/lib/error-utils";
import { buildJoinUrl } from "@/lib/facilitator";
import { Button } from "@energetica/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@energetica/ui/components/card";
import { InfoBanner } from "@energetica/ui/components/info-banner";
import { Input } from "@energetica/ui/components/input";
import { Label } from "@energetica/ui/components/label";
import { Separator } from "@energetica/ui/components/separator";
import { Spinner } from "@energetica/ui/components/spinner";
import { Switch } from "@energetica/ui/components/switch";
import {
    TypographyH2,
    TypographyMuted,
} from "@energetica/ui/components/typography";

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
        // Shown in a Workshop Run too, where the console links here (#1018). Without it, the
        // Workshop's route guard sends every page that is not a Workshop page back to the Workshop
        // home. The backend refuses anyone but the facilitator.
        runMode: "any",
        routeConfig: { requiredRole: "facilitator" },
        infoDialog: { contents: <FacilitatorHelp /> },
    },
});

function FacilitatorPage() {
    const { data: runMode } = useRunMode();
    const { data: session } = useWorkshopSession({
        enabled: runMode === "workshop",
    });
    // With teams (#1384), the join link could only add accounts on no team, which
    // cannot enter, so the page does not offer it.
    const hasTeams = !!session?.teams;
    return (
        <div className="flex min-h-svh flex-col">
            <FacilitatorHeader />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-xl mx-auto">
                    {hasTeams ? <TeamsInsteadOfJoinLink /> : <JoinLinkCard />}
                </div>
            </main>
        </div>
    );
}

function TeamsInsteadOfJoinLink() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>Join link</TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    This Run plays in teams, so only the accounts on its team
                    list can play. There is no join link: players log in with
                    the accounts made for their team.
                </TypographyMuted>
            </CardHeader>
        </Card>
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
