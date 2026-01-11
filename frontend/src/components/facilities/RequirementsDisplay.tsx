/**
 * Shared component for displaying facility/technology requirements. Shows
 * unlock requirements with color-coded status.
 */

import { Link } from "@tanstack/react-router";

import { AssetName } from "@/components/ui/AssetName";
import {
    getTechnologyRoute,
    getFacilityRoute,
    isTechnology,
} from "@/lib/facility-routes";

interface Requirement {
    name: string;
    level: number;
    status: "satisfied" | "queued" | "unsatisfied";
}

interface RequirementsDisplayProps {
    requirements: Requirement[];
}

export function RequirementsDisplay({
    requirements,
}: RequirementsDisplayProps) {
    return (
        <div className="bg-muted/50 p-3 rounded">
            <div className="font-bold mb-2">Unlock with:</div>
            <ul className="space-y-1 ml-4">
                {requirements.map((req, idx) => {
                    const isTech = isTechnology(req.name);
                    const route = isTech
                        ? getTechnologyRoute(req.name)
                        : getFacilityRoute(req.name);

                    return (
                        <li
                            key={idx}
                            className={
                                req.status === "satisfied"
                                    ? "text-green-600 dark:text-green-400"
                                    : req.status === "queued"
                                      ? "text-yellow-600 dark:text-yellow-400"
                                      : "text-red-600 dark:text-red-400"
                            }
                        >
                            -{" "}
                            {route ? (
                                <Link
                                    to={route}
                                    className="underline hover:opacity-80"
                                >
                                    <AssetName assetId={req.name} mode="long" />{" "}
                                    lvl {req.level}
                                </Link>
                            ) : (
                                <>
                                    <AssetName assetId={req.name} mode="long" />{" "}
                                    lvl {req.level}
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
