import { createFileRoute, Link } from "@tanstack/react-router";
import { Gauge, Palette, Shapes, Type } from "lucide-react";

import { HomeLayout } from "@/components/home-layout";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    TypographyH1,
    TypographyLead,
} from "@/components/ui/typography";

export const Route = createFileRoute("/app/internal/")({
    component: InternalIndexPage,
    staticData: {
        title: "Internal",
        routeConfig: { requiredRole: null },
    },
});

const pages = [
    {
        to: "/app/internal/design",
        title: "Design System",
        description:
            "Color tokens, asset colors, buttons, inputs, feedback, progress, cards, and data display.",
        icon: Palette,
    },
    {
        to: "/app/internal/typography",
        title: "Typography",
        description:
            "Headings, body text, modifiers, and data-display typography components.",
        icon: Type,
    },
    {
        to: "/app/internal/icons",
        title: "Icons",
        description:
            "Asset, resource, technology, and special icons with usage analysis.",
        icon: Shapes,
    },
    {
        to: "/app/internal/colors",
        title: "Color & Gauge Test",
        description:
            "All asset colors rendered as FacilityGauges at multiple fill levels — verify label legibility in light and dark mode.",
        icon: Gauge,
    },
] as const;

function InternalIndexPage() {
    return (
        <HomeLayout>
            <div className="flex flex-col gap-8 px-6 lg:px-8 max-w-5xl mx-auto py-8">
                <section className="flex flex-col gap-2">
                    <TypographyH1>Internal</TypographyH1>
                    <TypographyLead>
                        Reference pages for the design system, typography, and
                        icon library.
                    </TypographyLead>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pages.map(({ to, title, description, icon: Icon }) => (
                        <Link
                            key={to}
                            to={to}
                            className="group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Card className="h-full transition-colors group-hover:border-accent group-hover:bg-muted">
                                <CardHeader className="gap-3">
                                    <Icon className="size-6 text-foreground" />
                                    <CardTitle>{title}</CardTitle>
                                    <CardDescription>
                                        {description}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </section>
            </div>
        </HomeLayout>
    );
}
