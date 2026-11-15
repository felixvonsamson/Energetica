/**
 * Facilitator settings page (#1020): the join link/QR code for this private
 * Run, and the "allow joining" toggle gating it, from `@energetica/instance`. A
 * Run with teams shows its credentials instead (#1385). The console links here
 * (#1018), and so does the lobby's facilitator link.
 *
 * It renders outside the Workshop shell and its gate: the backend refuses its
 * calls to anyone but the facilitator.
 */

import { JoinLinkCard } from "@energetica/instance/components/join-link-card";
import { Button } from "@energetica/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@energetica/ui/components/card";
import { InfoBanner } from "@energetica/ui/components/info-banner";
import { Spinner } from "@energetica/ui/components/spinner";
import {
    TypographyH2,
    TypographyMuted,
} from "@energetica/ui/components/typography";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";

import { FacilitatorHeader } from "@/components/facilitator-header";
import {
    useWorkshopCredentials,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import { getUserFriendlyError } from "@/lib/error-messages";
import { credentialsCsv } from "@/lib/workshop-credentials";
import type { ApiSchema } from "@/types/api-helpers";

export const Route = createFileRoute("/facilitator/")({
    component: FacilitatorPage,
    staticData: { title: "Facilitator" },
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
 * The join link card, or in a Run with teams (#1384) the credentials card in
 * its place (#1385): the join link could only add accounts on no team, which
 * cannot enter. Nothing is shown until the page knows whether the Run has
 * teams, so a Run with teams never offers the link, even briefly.
 */
function AccessCard() {
    const session = useWorkshopSession();

    if (session.isPending) {
        return (
            <div className="flex justify-center py-12">
                <Spinner />
            </div>
        );
    }
    if (session.error) {
        return (
            <InfoBanner variant="error">
                {getUserFriendlyError(session.error)}
            </InfoBanner>
        );
    }
    return session.data.teams ? (
        <CredentialsCard />
    ) : (
        <JoinLinkCard
            joinPath={(token) => `/app/join/${token}`}
            formatError={getUserFriendlyError}
        />
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
                        <Link to="/facilitator/slips">
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
