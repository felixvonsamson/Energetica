/**
 * Facilitator settings page (#1020): the join link/QR code for this private
 * instance, and the "allow joining" toggle gating it. A Workshop Run with teams
 * shows its credentials instead (#1385).
 *
 * Deliberately doesn't use `GameLayout`/`AppSidebar` — those assume a settled
 * player (capability flags, money, workers), none of which a facilitator
 * account has. This page is a small, self-contained shell instead.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Download, Printer } from "lucide-react";
import { useEffect, useState } from "react";

import { FacilitatorHeader } from "@/components/facilitator/facilitator-header";
import { JoinQrCode } from "@/components/facilitator/join-qr-code";
import {
    useFacilitatorAccess,
    useSetJoinOpen,
} from "@/hooks/use-facilitator-access";
import { useRunMode } from "@/hooks/use-run-mode";
import {
    useWorkshopCredentials,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import { getUserFriendlyError } from "@/lib/error-utils";
import { buildJoinUrl } from "@/lib/facilitator";
import { credentialsCsv } from "@/lib/workshop-credentials";
import type { ApiSchema } from "@/types/api-helpers";
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
            <p>
                A Workshop Run that plays in teams has no join link: its players
                log in with the accounts made for their team. Print a slip per
                team, with each account's username and password, or download
                them all as a CSV.
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
    return (
        <div className="flex min-h-svh flex-col">
            <FacilitatorHeader />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-xl mx-auto">
                    <AccessCard />
                </div>
            </main>
        </div>
    );
}

/**
 * The join link card, or in a Workshop Run with teams (#1384) the credentials
 * card in its place (#1385): the join link could only add accounts on no team,
 * which cannot enter. Nothing is shown until the page knows whether the Run has
 * teams, so a Run with teams never offers the link, even briefly.
 */
function AccessCard() {
    const runMode = useRunMode();
    const isWorkshop = runMode.data === "workshop";
    const session = useWorkshopSession({ enabled: isWorkshop });

    if (runMode.isPending || (isWorkshop && session.isPending)) {
        return (
            <div className="flex justify-center py-12">
                <Spinner />
            </div>
        );
    }
    const error = runMode.error ?? (isWorkshop ? session.error : null);
    if (error) {
        return (
            <InfoBanner variant="error">
                {getUserFriendlyError(error)}
            </InfoBanner>
        );
    }
    return isWorkshop && session.data?.teams ? (
        <CredentialsCard />
    ) : (
        <JoinLinkCard />
    );
}

/**
 * The credentials card of a Run with teams (#1385), in place of the join link:
 * print a slip per team, or download every account as a CSV. The setup script
 * writes the credentials, so a Run whose accounts were made by hand, or whose
 * accounts have expired, has none.
 */
function CredentialsCard() {
    const { data, isPending, error } = useWorkshopCredentials();

    let content;
    if (isPending) {
        content = (
            <div className="flex justify-center py-6">
                <Spinner />
            </div>
        );
    } else if (error) {
        content = (
            <InfoBanner variant="error">
                {getUserFriendlyError(error)}
            </InfoBanner>
        );
    } else if (!data) {
        content = (
            <TypographyMuted>
                This Run has no credentials to print. Either its accounts were
                set up by hand, or they have expired and the file holding their
                passwords was deleted.
            </TypographyMuted>
        );
    } else {
        content = (
            <div className="space-y-4">
                <TypographyMuted>
                    {data.accounts.length} accounts, which expire on{" "}
                    {new Date(data.expires_at).toLocaleString()}. After that,
                    their passwords are deleted from the server.
                </TypographyMuted>
                <div className="flex flex-wrap gap-2">
                    <Button asChild>
                        <Link to="/app/facilitator/slips">
                            <Printer />
                            Print slips
                        </Link>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => downloadCsv(data.accounts)}
                    >
                        <Download />
                        Download CSV
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <TypographyH2>Credentials</TypographyH2>
                </CardTitle>
                <TypographyMuted>
                    This Run plays in teams, so only the accounts on its team
                    list can play. There is no join link: players log in with
                    the accounts made for their team.
                </TypographyMuted>
            </CardHeader>
            <CardContent>{content}</CardContent>
        </Card>
    );
}

/** Save the accounts as `team,username,password`. */
function downloadCsv(accounts: ApiSchema<"CredentialLine">[]) {
    const blob = new Blob([credentialsCsv(accounts)], {
        type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "workshop-credentials.csv";
    link.click();
    // Once the click has started the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
