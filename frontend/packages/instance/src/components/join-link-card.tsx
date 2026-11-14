/**
 * The facilitator's join link for this private instance (#1020): the link and
 * its QR code, and the "allow joining" toggle gating it.
 */

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
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { JoinQrCode } from "#instance/components/join-qr-code";
import {
    useFacilitatorAccess,
    useSetJoinOpen,
} from "#instance/hooks/use-facilitator-access";
import { buildJoinUrl } from "#instance/lib/facilitator";
import type { FormatError } from "#instance/lib/format-error";

interface JoinLinkCardProps {
    /** The path the app serves its join page at, for this token. */
    joinPath: (token: string) => string;
    formatError: FormatError;
}

export function JoinLinkCard({ joinPath, formatError }: JoinLinkCardProps) {
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
        return <InfoBanner variant="error">{formatError(error)}</InfoBanner>;
    }

    const joinUrl = buildJoinUrl(
        window.location.origin,
        joinPath(data.join_token),
    );

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
                        {formatError(setJoinOpenError)}
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
