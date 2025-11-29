/**
 * Component that redirects to a legacy Jinja template page. Used as a stub for
 * pages not yet migrated to React.
 */

import { useEffect } from "react";

interface RedirectToLegacyProps {
    to: string;
}

export function RedirectToLegacy({ to }: RedirectToLegacyProps) {
    useEffect(() => {
        window.location.href = to;
    }, [to]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#2d5016] text-white">
            <div className="text-center">
                <div className="text-xl mb-2">Redirecting...</div>
                <div className="text-sm text-gray-300">
                    If you are not redirected,{" "}
                    <a href={to} className="underline">
                        click here
                    </a>
                </div>
            </div>
        </div>
    );
}
