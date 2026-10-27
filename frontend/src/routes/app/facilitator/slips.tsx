/**
 * The printable credentials slips of a Workshop Run with teams (#1385): one
 * slip per team, with each account's username and password and the Run's
 * address, to cut out and hand to each table. The browser's print dialog can
 * also save them as a PDF.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";

import { useWorkshopCredentials } from "@/hooks/use-workshop";
import { getUserFriendlyError } from "@/lib/error-utils";
import {
    type CredentialSlip,
    credentialSlips,
} from "@/lib/workshop-credentials";
import { Button } from "@energetica/ui/components/button";
import { InfoBanner } from "@energetica/ui/components/info-banner";
import { Spinner } from "@energetica/ui/components/spinner";
import { TypographyMuted } from "@energetica/ui/components/typography";

export const Route = createFileRoute("/app/facilitator/slips")({
    component: SlipsPage,
    staticData: {
        title: "Credentials slips",
        // Without it, the Workshop's route guard sends every page that is not a Workshop page
        // back to the Workshop home. The backend refuses anyone but the facilitator.
        runMode: "any",
        routeConfig: { requiredRole: "facilitator" },
    },
});

function SlipsPage() {
    const { data, isPending, error } = useWorkshopCredentials();

    let content;
    if (isPending) {
        content = (
            <div className="flex justify-center py-12">
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
            <InfoBanner variant="info">
                This Run has no credentials to print.
            </InfoBanner>
        );
    } else {
        content = (
            <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
                {credentialSlips(data.accounts).map((slip) => (
                    <Slip key={slip.team} slip={slip} />
                ))}
            </div>
        );
    }

    return (
        <div className="min-h-svh p-4 md:p-8 print:p-0 print:bg-white print:text-black">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                    <Button variant="outline" asChild>
                        <Link to="/app/facilitator">
                            <ArrowLeft />
                            Back
                        </Link>
                    </Button>
                    <TypographyMuted>
                        Print, or save as a PDF from the print dialog, then cut
                        along the dashed lines.
                    </TypographyMuted>
                    <Button onClick={() => window.print()} disabled={!data}>
                        <Printer />
                        Print slips
                    </Button>
                </div>
                {content}
            </div>
        </div>
    );
}

/** One team's slip. Kept whole on one printed page. */
function Slip({ slip }: { slip: CredentialSlip }) {
    return (
        <section className="break-inside-avoid rounded-md border-2 border-dashed border-border p-4 space-y-3 print:border-black">
            <h2 className="font-titles text-xl">{slip.team}</h2>
            <p className="text-sm">
                Play at{" "}
                <span className="font-semibold">{window.location.origin}</span>
            </p>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left">
                        <th className="font-semibold pb-1">Username</th>
                        <th className="font-semibold pb-1">Password</th>
                    </tr>
                </thead>
                <tbody>
                    {slip.accounts.map((account) => (
                        <tr key={account.username}>
                            <td className="font-mono py-0.5 pr-4">
                                {account.username}
                            </td>
                            <td className="font-mono py-0.5">
                                {account.password}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
