import { createFileRoute } from "@tanstack/react-router";
import { createElement } from "react";

import { HomeLayout } from "@/components/HomeLayout";
import {
    allAssetIcons,
    extractionFacilityIcons,
    functionalFacilityIcons,
    powerFacilityIcons,
    resourceIcons,
    specialIcons,
    storageFacilityIcons,
    technologyIcons,
} from "@/lib/assets/asset-icons";
import { cn } from "@/lib/classname-utils";

export const Route = createFileRoute("/app/internal/icons")({
    component: RouteComponent,
    staticData: {
        title: "Icon Showcase",
    },
});

/**
 * Analyzes icon usage across all asset categories to identify which icons are
 * reused for multiple assets.
 */
function analyzeIconUsage() {
    const iconUsage = new Map<string, string[]>();

    // Count how many assets use each icon
    Object.entries(allAssetIcons).forEach(([assetId, IconComponent]) => {
        const iconName = IconComponent.displayName || IconComponent.name;
        if (!iconUsage.has(iconName)) {
            iconUsage.set(iconName, []);
        }
        iconUsage.get(iconName)!.push(assetId);
    });

    return iconUsage;
}

interface IconCategoryProps {
    title: string;
    description: string;
    icons: Record<string, React.ComponentType>;
    iconUsage: Map<string, string[]>;
}

function IconCategory({
    title,
    description,
    icons,
    iconUsage,
}: IconCategoryProps) {
    return (
        <section className="flex flex-col gap-4">
            <div className="border-b border-gray-300 pb-2">
                <h2 className="text-2xl font-bold">{title}</h2>
                <p className="text-sm text-gray-600">{description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(icons).map(([assetId, IconComponent]) => {
                    const iconName =
                        IconComponent.displayName || IconComponent.name;
                    const usageCount = iconUsage.get(iconName)?.length || 0;
                    const isReused = usageCount > 1;

                    return (
                        <div
                            key={assetId}
                            className={cn(
                                "flex flex-col gap-3 rounded-lg border p-4",
                                isReused
                                    ? "border-orange-400 bg-orange-50"
                                    : "border-gray-200 bg-white",
                            )}
                        >
                            {/* Header with asset ID and reuse badge */}
                            <div className="flex items-start justify-between gap-2">
                                <code className="text-sm font-semibold text-gray-900">
                                    {assetId}
                                </code>
                                {isReused && (
                                    <span className="rounded bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-900">
                                        Reused ×{usageCount}
                                    </span>
                                )}
                            </div>

                            {/* Icon name */}
                            <div className="text-xs text-gray-500">
                                Lucide: <code>{iconName}</code>
                            </div>

                            {/* Icon size examples */}
                            <div className="flex items-center gap-4 border-t border-gray-200 pt-3">
                                {[16, 20, 24, 32].map((size) => (
                                    <div
                                        key={size}
                                        className="flex flex-col items-center gap-1"
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                                            {createElement(IconComponent, {
                                                size,
                                                className: "text-gray-700",
                                            })}
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {size}px
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function RouteComponent() {
    const iconUsage = analyzeIconUsage();

    // Calculate statistics
    const totalAssets = Object.keys(allAssetIcons).length;
    const uniqueIcons = iconUsage.size;
    const reusedIcons = Array.from(iconUsage.entries()).filter(
        ([, assets]) => assets.length > 1,
    );
    const customIconsNeeded = reusedIcons.length;

    return (
        <HomeLayout>
            <div className="flex flex-col gap-8 px-6 lg:px-8">
                {/* Header */}
                <section className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold">
                        Icon Showcase & Design Reference
                    </h1>
                    <p className="text-lg text-gray-600">
                        Comprehensive overview of all icons used in Energetica
                    </p>
                </section>

                {/* Statistics */}
                <section className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="text-3xl font-bold text-blue-600">
                            {totalAssets}
                        </div>
                        <div className="text-sm text-gray-600">
                            Total Assets
                        </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="text-3xl font-bold text-green-600">
                            {uniqueIcons}
                        </div>
                        <div className="text-sm text-gray-600">
                            Unique Icons
                        </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="text-3xl font-bold text-orange-600">
                            {reusedIcons.length}
                        </div>
                        <div className="text-sm text-gray-600">
                            Reused Icons
                        </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="text-3xl font-bold text-purple-600">
                            {customIconsNeeded}
                        </div>
                        <div className="text-sm text-gray-600">
                            Custom Icons Needed
                        </div>
                    </div>
                </section>

                {/* Priority List */}
                <section className="rounded-lg border-2 border-orange-300 bg-orange-50 p-6">
                    <h2 className="mb-3 text-xl font-bold text-orange-900">
                        🎯 Priority: Icons That Need Custom Replacements
                    </h2>
                    <p className="mb-4 text-sm text-orange-800">
                        These Lucide icons are currently reused for multiple
                        different assets. Creating unique icons for these will
                        improve visual clarity.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {reusedIcons
                            .sort((a, b) => b[1].length - a[1].length)
                            .map(([iconName, assets]) => {
                                const IconComponent = allAssetIcons[assets[0]];
                                return (
                                    <div
                                        key={iconName}
                                        className="rounded-lg border border-orange-200 bg-white p-3"
                                    >
                                        <div className="mb-2 flex items-center gap-2">
                                            {createElement(IconComponent, {
                                                size: 20,
                                                className: "text-orange-600",
                                            })}
                                            <code className="font-semibold text-orange-900">
                                                {iconName}
                                            </code>
                                            <span className="ml-auto rounded bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-900">
                                                ×{assets.length}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            Used for:{" "}
                                            {assets
                                                .map((id) => (
                                                    <code key={id}>{id}</code>
                                                ))
                                                .reduce(
                                                    (prev, curr, idx) =>
                                                        idx === 0
                                                            ? [curr]
                                                            : [
                                                                  prev,
                                                                  ", ",
                                                                  curr,
                                                              ],
                                                    [] as React.ReactNode[],
                                                )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </section>

                {/* Design Guidelines */}
                <section className="rounded-lg border border-blue-200 bg-blue-50 p-6">
                    <h2 className="mb-3 text-xl font-bold text-blue-900">
                        📐 Design Guidelines
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <h3 className="mb-2 font-semibold text-blue-900">
                                Technical Specs
                            </h3>
                            <ul className="space-y-1 text-sm text-blue-800">
                                <li>• Format: SVG</li>
                                <li>• ViewBox: 24×24</li>
                                <li>• Stroke width: 2px</li>
                                <li>• Line caps/joins: Round</li>
                                <li>
                                    • Color: currentColor (for CSS inheritance)
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="mb-2 font-semibold text-blue-900">
                                Style Reference
                            </h3>
                            <ul className="space-y-1 text-sm text-blue-800">
                                <li>
                                    • Base style:{" "}
                                    <a
                                        href="https://lucide.dev"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                    >
                                        Lucide Icons
                                    </a>
                                </li>
                                <li>
                                    • Theme: Energy/industrial, clean & modern
                                </li>
                                <li>• Keep icons simple and recognizable</li>
                                <li>
                                    • Maintain visual consistency with Lucide
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Icon Categories */}
                <IconCategory
                    title="Power Facilities"
                    description="Energy generation facilities (renewable and controllable)"
                    icons={powerFacilityIcons}
                    iconUsage={iconUsage}
                />

                <IconCategory
                    title="Storage Facilities"
                    description="Energy storage systems"
                    icons={storageFacilityIcons}
                    iconUsage={iconUsage}
                />

                <IconCategory
                    title="Extraction Facilities"
                    description="Resource mining and extraction"
                    icons={extractionFacilityIcons}
                    iconUsage={iconUsage}
                />

                <IconCategory
                    title="Functional Facilities"
                    description="Utility buildings and infrastructure"
                    icons={functionalFacilityIcons}
                    iconUsage={iconUsage}
                />

                <IconCategory
                    title="Technologies"
                    description="Research and technology tree items"
                    icons={technologyIcons}
                    iconUsage={iconUsage}
                />

                <IconCategory
                    title="Resources"
                    description="Game resources and materials"
                    icons={resourceIcons}
                    iconUsage={iconUsage}
                />

                <IconCategory
                    title="Special Icons"
                    description="UI elements, charts, and special indicators"
                    icons={specialIcons}
                    iconUsage={iconUsage}
                />

                {/* Footer */}
                <section className="border-t border-gray-300 pt-4 text-sm text-gray-600">
                    <p>
                        This page is automatically generated from{" "}
                        <code className="rounded bg-gray-100 px-1 py-0.5">
                            frontend/src/lib/assets/asset-icons.ts
                        </code>
                    </p>
                    <p className="mt-2">
                        Icons highlighted in orange are reused across multiple
                        assets and are priority candidates for custom icon
                        design.
                    </p>
                </section>
            </div>
        </HomeLayout>
    );
}
