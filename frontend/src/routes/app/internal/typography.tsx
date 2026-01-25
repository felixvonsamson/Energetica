import { createFileRoute } from "@tanstack/react-router";

import { HomeLayout } from "@/components/home-layout";
import { Money } from "@/components/ui/money";
import {
    DataValue,
    TypographyBlockquote,
    TypographyBrand,
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyH4,
    TypographyInlineCode,
    TypographyLarge,
    TypographyLead,
    TypographyMuted,
    TypographyP,
    TypographySmall,
} from "@/components/ui/typography";

export const Route = createFileRoute("/app/internal/typography")({
    component: RouteComponent,
    staticData: {
        title: "Typography Showcase",
    },
});

function RouteComponent() {
    return (
        <HomeLayout>
            <div className="flex flex-col gap-12 px-6 lg:px-8 max-w-5xl mx-auto">
                {/* Header */}
                <section className="flex flex-col gap-2">
                    <TypographyH1>Typography System</TypographyH1>
                    <TypographyLead>
                        Comprehensive showcase of typography components and
                        their composition patterns
                    </TypographyLead>
                </section>

                {/* Overview */}
                <section className="flex flex-col gap-4">
                    <TypographyH2>System Overview</TypographyH2>
                    <TypographyP>
                        The typography system provides semantic, visual, and
                        data-specific components that compose naturally.
                        Components are built following shadcn/ui patterns with
                        adaptations for Energetica's design system.
                    </TypographyP>
                    <TypographyP>
                        All typography components are defined in{" "}
                        <TypographyInlineCode>
                            frontend/src/components/ui/typography.tsx
                        </TypographyInlineCode>{" "}
                        and follow a three-tier architecture: semantic
                        structure, visual modifiers, and domain-specific data
                        display.
                    </TypographyP>
                </section>

                {/* Semantic Headings */}
                <section className="flex flex-col gap-6">
                    <div>
                        <TypographyH2>Semantic Heading Components</TypographyH2>
                        <TypographyMuted>
                            Use these for structural hierarchy - what the text
                            IS, not how it looks
                        </TypographyMuted>
                    </div>

                    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
                        <div className="space-y-2">
                            <TypographyH1>Heading 1 (H1)</TypographyH1>
                            <TypographyMuted>
                                text-4xl font-extrabold tracking-tight
                            </TypographyMuted>
                        </div>
                        <div className="space-y-2">
                            <TypographyH2>Heading 2 (H2)</TypographyH2>
                            <TypographyMuted>
                                text-3xl font-semibold tracking-tight, with
                                border bottom
                            </TypographyMuted>
                        </div>
                        <div className="space-y-2">
                            <TypographyH3>Heading 3 (H3)</TypographyH3>
                            <TypographyMuted>
                                text-2xl font-semibold tracking-tight
                            </TypographyMuted>
                        </div>
                        <div className="space-y-2">
                            <TypographyH4>Heading 4 (H4)</TypographyH4>
                            <TypographyMuted>
                                text-xl font-semibold tracking-tight
                            </TypographyMuted>
                        </div>
                    </div>
                </section>

                {/* Text Components */}
                <section className="flex flex-col gap-6">
                    <div>
                        <TypographyH2>Text Components</TypographyH2>
                        <TypographyMuted>
                            Body text, leads, and size modifiers
                        </TypographyMuted>
                    </div>

                    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
                        <div className="space-y-2">
                            <TypographySmall>TypographyP</TypographySmall>
                            <TypographyP>
                                Regular paragraph text with proper spacing. This
                                is the default body text style with leading-7
                                and automatic top margin for non-first children.
                            </TypographyP>
                            <TypographyMuted>
                                leading-7 not-first:mt-6
                            </TypographyMuted>
                        </div>

                        <div className="space-y-2">
                            <TypographySmall>TypographyLead</TypographySmall>
                            <TypographyLead>
                                Lead paragraph - used for introductory text that
                                should stand out from body copy. Typically
                                appears below page titles.
                            </TypographyLead>
                            <TypographyMuted>
                                text-xl text-muted-foreground
                            </TypographyMuted>
                        </div>

                        <div className="space-y-2">
                            <TypographySmall>TypographyLarge</TypographySmall>
                            <TypographyLarge>
                                Large text for emphasis or subheadings
                            </TypographyLarge>
                            <TypographyMuted>
                                text-lg font-semibold
                            </TypographyMuted>
                        </div>

                        <div className="space-y-2">
                            <TypographySmall>TypographySmall</TypographySmall>
                            <TypographySmall>
                                Small text for labels and compact information
                            </TypographySmall>
                            <TypographyMuted>
                                text-sm font-medium leading-none
                            </TypographyMuted>
                        </div>

                        <div className="space-y-2">
                            <TypographySmall>TypographyMuted</TypographySmall>
                            <TypographyMuted>
                                Muted text for secondary information, captions,
                                and helper text
                            </TypographyMuted>
                            <TypographyMuted>
                                text-sm text-muted-foreground
                            </TypographyMuted>
                        </div>
                    </div>
                </section>

                {/* Specialty Components */}
                <section className="flex flex-col gap-6">
                    <div>
                        <TypographyH2>Specialty Components</TypographyH2>
                        <TypographyMuted>
                            Brand styling, code, and quotes
                        </TypographyMuted>
                    </div>

                    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
                        <div className="space-y-2">
                            <TypographySmall>TypographyBrand</TypographySmall>
                            <TypographyBrand className="text-4xl">
                                Energetica
                            </TypographyBrand>
                            <TypographyMuted>
                                Expletus Sans font for logo and brand moments
                            </TypographyMuted>
                        </div>

                        <div className="space-y-2">
                            <TypographySmall>
                                TypographyInlineCode
                            </TypographySmall>
                            <TypographyP>
                                Use{" "}
                                <TypographyInlineCode>
                                    bun run dev
                                </TypographyInlineCode>{" "}
                                to start the development server.
                            </TypographyP>
                            <TypographyMuted>
                                Monospace with background, for code snippets
                            </TypographyMuted>
                        </div>

                        <div className="space-y-2">
                            <TypographySmall>
                                TypographyBlockquote
                            </TypographySmall>
                            <TypographyBlockquote>
                                After all, tomorrow is another day!
                            </TypographyBlockquote>
                            <TypographyMuted>
                                Italic with left border, for quotes and
                                citations
                            </TypographyMuted>
                        </div>
                    </div>
                </section>

                {/* Data Display */}
                <section className="flex flex-col gap-6">
                    <div>
                        <TypographyH2>Data Display Components</TypographyH2>
                        <TypographyMuted>
                            Monospaced foundation for numerical values
                        </TypographyMuted>
                    </div>

                    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
                        <div className="space-y-2">
                            <TypographySmall>DataValue</TypographySmall>
                            <TypographyP>
                                Base component for numerical data:{" "}
                                <DataValue>1,234,567</DataValue> units
                            </TypographyP>
                            <TypographyMuted>
                                Monospace (ui-monospace stack) for visual
                                consistency
                            </TypographyMuted>
                        </div>

                        <div className="space-y-2">
                            <TypographySmall>Money</TypographySmall>
                            <div className="space-y-2">
                                <TypographyP>
                                    Small amount: <Money amount={1500} />
                                </TypographyP>
                                <TypographyP>
                                    Scaled (k): <Money amount={15000} />
                                </TypographyP>
                                <TypographyP>
                                    Scaled (M): <Money amount={1500000} />
                                </TypographyP>
                                <TypographyP>
                                    Long format: <Money amount={1500000} long />
                                </TypographyP>
                            </div>
                            <TypographyMuted>
                                Built on DataValue, with dollar sign icon
                            </TypographyMuted>
                        </div>
                    </div>
                </section>

                {/* Composition Examples */}
                <section className="flex flex-col gap-6">
                    <div>
                        <TypographyH2>Composition Patterns</TypographyH2>
                        <TypographyMuted>
                            Components nest naturally for flexible layouts
                        </TypographyMuted>
                    </div>

                    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
                        <div className="space-y-3">
                            <TypographySmall>Money in headings</TypographySmall>
                            <TypographyH1>
                                Revenue: <Money amount={1500000} />
                            </TypographyH1>
                            <TypographyH2>
                                Q4 Earnings: <Money amount={250000} />
                            </TypographyH2>
                            <TypographyH3>
                                Operating Costs: <Money amount={50000} />
                            </TypographyH3>
                        </div>

                        <div className="space-y-3">
                            <TypographySmall>Muted data</TypographySmall>
                            <TypographyMuted>
                                Last updated: <DataValue>2026-01-25</DataValue>
                            </TypographyMuted>
                            <TypographyMuted>
                                Total expenses: <Money amount={75000} />
                            </TypographyMuted>
                        </div>

                        <div className="space-y-3">
                            <TypographySmall>Brand in headings</TypographySmall>
                            <TypographyH2>
                                Welcome to{" "}
                                <TypographyBrand>Energetica</TypographyBrand>
                            </TypographyH2>
                            <TypographyP>
                                The{" "}
                                <TypographyBrand>Energetica</TypographyBrand>{" "}
                                platform provides real-time energy management
                                and trading capabilities for modern grid
                                systems.
                            </TypographyP>
                        </div>
                    </div>
                </section>

                {/* Usage Guidelines */}
                <section className="flex flex-col gap-6">
                    <div>
                        <TypographyH2>Usage Guidelines</TypographyH2>
                        <TypographyMuted>
                            Best practices and migration patterns
                        </TypographyMuted>
                    </div>

                    <div className="rounded-lg border-2 border-success bg-success/10 p-6">
                        <TypographyH3 className="text-success-foreground">
                            ✅ Do This
                        </TypographyH3>
                        <div className="mt-4 space-y-2">
                            <TypographyP>
                                • Use semantic components for structural
                                hierarchy
                            </TypographyP>
                            <TypographyP>
                                • Compose typography with data components
                                naturally
                            </TypographyP>
                            <TypographyP>
                                • Apply Tailwind classes to typography
                                components for customization
                            </TypographyP>
                            <TypographyP>
                                • Use TypographyBrand selectively for brand
                                moments
                            </TypographyP>
                            <TypographyP>
                                • Leverage DataValue for all numerical displays
                            </TypographyP>
                        </div>
                    </div>

                    <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-6">
                        <TypographyH3 className="text-destructive-foreground">
                            ❌ Avoid This
                        </TypographyH3>
                        <div className="mt-4 space-y-2">
                            <TypographyP>
                                • Don't use inline Tailwind classes instead of
                                typography components
                            </TypographyP>
                            <TypographyP>
                                • Don't force all H1s to use brand font - keep
                                it compositional
                            </TypographyP>
                            <TypographyP>
                                • Don't display numerical data without monospace
                                styling
                            </TypographyP>
                            <TypographyP>
                                • Don't create ad-hoc text styling patterns -
                                use existing components
                            </TypographyP>
                            <TypographyP>
                                • Don't mix raw HTML headings with typography
                                components in new code
                            </TypographyP>
                        </div>
                    </div>
                </section>

                {/* Implementation Notes */}
                <section className="flex flex-col gap-4">
                    <TypographyH2>Implementation Notes</TypographyH2>
                    <div className="rounded-lg border border-info bg-info/10 p-6">
                        <TypographyH3 className="text-info-foreground mb-4">
                            📚 Documentation
                        </TypographyH3>
                        <div className="space-y-2">
                            <TypographyP>
                                <TypographySmall>
                                    Component source:
                                </TypographySmall>{" "}
                                <TypographyInlineCode>
                                    frontend/src/components/ui/typography.tsx
                                </TypographyInlineCode>
                            </TypographyP>
                            <TypographyP>
                                <TypographySmall>
                                    Documentation:
                                </TypographySmall>{" "}
                                <TypographyInlineCode>
                                    docs/frontend/typography.md
                                </TypographyInlineCode>
                            </TypographyP>
                            <TypographyP>
                                <TypographySmall>Usage guide:</TypographySmall>{" "}
                                <TypographyInlineCode>
                                    CLAUDE.md
                                </TypographyInlineCode>{" "}
                                (Frontend: UI Components & Styling section)
                            </TypographyP>
                            <TypographyP>
                                <TypographySmall>Examples:</TypographySmall>{" "}
                                <TypographyInlineCode>
                                    frontend/src/components/ui/typography-examples.tsx
                                </TypographyInlineCode>
                            </TypographyP>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <section className="border-t border-border pt-4">
                    <TypographyMuted>
                        This showcase page demonstrates the complete typography
                        system. All components shown here are production-ready
                        and available for use throughout the application.
                    </TypographyMuted>
                </section>
            </div>
        </HomeLayout>
    );
}
