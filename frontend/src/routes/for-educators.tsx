import { createFileRoute } from "@tanstack/react-router";
import {
    BookOpen,
    Code2,
    GitFork,
    GraduationCap,
    LifeBuoy,
    MousePointerClick,
    Sparkles,
    Users,
} from "lucide-react";

import { HomeLayout } from "@/components/home-layout";
import {
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyLead,
    TypographyP,
} from "@/components/ui/typography";

export const Route = createFileRoute("/for-educators")({
    component: RouteComponent,
    staticData: {
        title: "For Educators",
    },
});

function RouteComponent() {
    const pedagogicalValues = [
        {
            title: "Systems Thinking",
            description:
                "Generation, storage, markets, and climate are all interconnected. Changing one variable ripples through everything else. There is no single right answer: what works depends on context and what others decide.",
            icon: <GitFork />,
        },
        {
            title: "Meaningful Trade-offs",
            description:
                "Cheap coal vs. clean renewables. Short-term profit vs. long-term resilience. Individual gain vs. collective climate risk. Every decision forces students to weigh competing values with real in-game consequences.",
            icon: <BookOpen />,
        },
        {
            title: "Collective Action Problem",
            description:
                "CO₂ emissions accumulate across all players, triggering shared climate events. Students viscerally experience why collective action on climate is so hard and why it matters.",
            icon: <Users />,
        },
        {
            title: "Learning by Doing",
            description:
                "Students don't just read about energy concepts, they live them. Managing a power grid, making investment calls, and facing market forces builds genuine intuition that lectures alone rarely achieve.",
            icon: <MousePointerClick />,
        },
    ];

    return (
        <HomeLayout>
            <div className="flex flex-col gap-20 px-6 lg:px-8">
                {/* Banner photo */}
                <section>
                    <div className="max-w-6xl mx-auto flex flex-col gap-12">
                        <div className="w-full">
                            <img
                                src="/static/images/landing_page/live_demo_photo.jpg"
                                alt="Students playing Energetica in a classroom"
                                className="w-full rounded-4xl shadow-lg object-cover max-h-144"
                            />
                        </div>
                    </div>
                </section>

                {/* Header */}
                <section className="flex flex-col gap-6 max-w-3xl">
                    <TypographyH1>Energetica in the Classroom</TypographyH1>
                    <TypographyLead className="text-foreground">
                        An open-source simulation game that makes energy
                        systems, electricity markets, and climate trade-offs
                        tangible — through play.
                    </TypographyLead>
                    <p className="text-sm text-muted-foreground font-medium">
                        Already used in courses at{" "}
                        <strong className="text-foreground">ETH Zürich</strong>{" "}
                        and{" "}
                        <strong className="text-foreground">ZHAW</strong>.
                    </p>
                </section>

                {/* Why it works */}
                <section>
                    <div className="max-w-6xl mx-auto flex flex-col gap-10">
                        <TypographyH2 className="text-primary">
                            Why It Works as a Teaching Tool
                        </TypographyH2>
                        <div className="grid gap-8 xl:grid-cols-2">
                            {pedagogicalValues.map((v) => (
                                <div
                                    key={v.title}
                                    className="flex flex-col gap-4 p-6 bg-card rounded-4xl shadow-md"
                                >
                                    <div className="flex flex-row items-center gap-4">
                                        <div className="shrink-0 size-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shadow-md">
                                            {v.icon}
                                        </div>
                                        <TypographyH3 className="text-xl text-foreground">
                                            {v.title}
                                        </TypographyH3>
                                    </div>
                                    <TypographyP>{v.description}</TypographyP>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Testimonials */}
                <section className="max-w-6xl mx-auto w-full">
                    <TypographyH2 className="text-primary mb-8">
                        What Educators Say
                    </TypographyH2>
                    <div className="rounded-4xl p-8 flex flex-col gap-4 bg-card shadow-md">
                        <blockquote className="text-xl italic text-foreground leading-relaxed">
                            "Energetica was a valuable addition to our 'Energy
                            and Climate' module at ZHAW. Students who are
                            usually passive became genuinely engaged. They were
                            debating market strategies and investment trade-offs
                            with each other without being prompted. What struck
                            me most was how naturally the game illustrated
                            concepts like price formation and the challenges
                            linked to renewable intermittency that are otherwise
                            hard to convey in a lecture. I would recommend it to
                            any educator working on energy, climate, or
                            economics topics."
                        </blockquote>
                        <p className="text-muted-foreground font-semibold">
                            — Nicolas Stocker, Lecturer, ZHAW
                        </p>
                    </div>
                </section>

                {/* What we offer */}
                <section className="max-w-6xl mx-auto w-full flex flex-col gap-6">
                    <TypographyH2 className="text-primary">
                        What We Offer
                    </TypographyH2>
                    <TypographyP>
                        Energetica is designed to be used as a complement to a
                        university course, a game played throughout the
                        semester that provides a hands-on backdrop for
                        introducing and reinforcing concepts covered in class.
                    </TypographyP>
                    <div className="divide-y divide-border-brand">
                        {[
                            {
                                icon: <Code2 className="size-5" />,
                                title: "Open Source",
                                description:
                                    "Energetica is fully open source. The code, data, and game mechanics are transparent and available for inspection.",
                            },
                            {
                                icon: <LifeBuoy className="size-5" />,
                                title: "Technical Support",
                                description:
                                    "We help with setup, student onboarding, and answering questions that come up during sessions — so you can focus on the teaching.",
                            },
                            {
                                icon: <GraduationCap className="size-5" />,
                                title: "Curriculum Fit",
                                description:
                                    "Works well alongside courses on energy systems, sustainability, economics, policy, and engineering.",
                            },
                            {
                                icon: <Sparkles className="size-5" />,
                                title: "Actively Developed",
                                description:
                                    "The game is continuously improving — new features, mechanics, and content are added regularly, informed by educator and player feedback.",
                            },
                        ].map((item) => (
                            <div
                                key={item.title}
                                className="flex flex-col sm:flex-row gap-4 sm:gap-8 py-6 items-center"
                            >
                                <div className="flex items-center gap-3 sm:w-56 shrink-0 text-primary">
                                    {item.icon}
                                    <TypographyH3 className="text-base font-semibold">
                                        {item.title}
                                    </TypographyH3>
                                </div>
                                <TypographyP className="flex-1 text-muted-foreground mt-0!">
                                    {item.description}
                                </TypographyP>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="max-w-6xl mx-auto w-full">
                    <div className="bg-primary rounded-4xl p-10 flex flex-col gap-4 items-center text-center shadow-md">
                        <TypographyH2 className="text-primary-foreground">
                            Interested in Using Energetica in Your Course?
                        </TypographyH2>
                        <TypographyLead className="text-primary-foreground max-w-xl">
                            We'd love to help. Reach out and we'll get back to
                            you to discuss how it could fit your course.
                        </TypographyLead>
                        <a
                            href="mailto:energetica.game@gmail.com"
                            className="mt-4 inline-block bg-primary-foreground text-primary font-bold text-lg px-10 py-4 rounded-4xl shadow hover:opacity-90 hover:shadow-xl active:scale-95 transition-all"
                        >
                            energetica.game@gmail.com
                        </a>
                    </div>
                </section>
            </div>
        </HomeLayout>
    );
}
