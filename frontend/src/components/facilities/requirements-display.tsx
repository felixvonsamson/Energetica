/**
 * Shared component for displaying facility/technology requirements. Shows
 * unlock requirements with color-coded status.
 */

import { Link } from "@tanstack/react-router";

import { TechnologyName } from "@/components/ui/asset-name";
import {
    getTechnologyRoute,
    getFacilityRoute,
    isTechnology,
} from "@/lib/facility-routes";
import { cn } from "@/lib/utils";

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
                {requirements.map((req) => {
                    const isTech = isTechnology(req.name);
                    const route = isTech
                        ? getTechnologyRoute(req.name)
                        : getFacilityRoute(req.name);
                    const requirementComponent = (
                        <TechnologyName
                            technology={req.name}
                            level={req.level}
                            mode="long"
                            className={cn(
                                route && "underline hover:opacity-80",
                            )}
                        />
                    );

                    return (
                        <li
                            key={`${req.name}-${req.level}`}
                            className={
                                req.status === "satisfied"
                                    ? "text-success"
                                    : req.status === "queued"
                                      ? "text-warning"
                                      : "text-destructive"
                            }
                        >
                            -{" "}
                            {route ? (
                                <Link to={route}>{requirementComponent}</Link>
                            ) : (
                                requirementComponent
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
