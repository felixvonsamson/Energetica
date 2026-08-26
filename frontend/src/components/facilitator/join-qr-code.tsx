/** Renders a URL as a scannable QR code (#1020's facilitator join link). */

import { toCanvas } from "qrcode";
import { useEffect, useRef, useState } from "react";

import { InfoBanner } from "@/components/ui/info-banner";

interface JoinQrCodeProps {
    /** The URL to encode — drawn to canvas imperatively, never through raw HTML. */
    value: string;
    /** Canvas side length in CSS pixels. */
    size?: number;
}

export function JoinQrCode({ value, size = 200 }: JoinQrCodeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let cancelled = false;
        toCanvas(canvas, value, { width: size, margin: 1 })
            .then(() => {
                if (!cancelled) setError(false);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [value, size]);

    if (error) {
        return (
            <InfoBanner variant="error">
                Could not generate the QR code. The link above still works.
            </InfoBanner>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            role="img"
            aria-label="QR code for the instance join link"
            className="rounded-md"
        />
    );
}
