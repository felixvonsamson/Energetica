import { createFileRoute } from "@tanstack/react-router";

import { HomeLayout } from "@/components/home-layout";
import {
    TypographyH2,
    TypographyH3,
    TypographyLead,
    TypographyP,
} from "@/components/ui/typography";

export const Route = createFileRoute("/about")({
    component: RouteComponent,
    staticData: {
        title: "The Project",
    },
});

function RouteComponent() {
    const team = [
        {
            name: "Felix",
            background: "ETH Zürich, Energy Science and Technology",
            bio: "I came up with the original idea for Energetica and started the project as a personal challenge. I cannot believe how much it has grown since then, and I'm excited to keep building and improving it.",
        },
        {
            name: "Maximilien",
            background: "Oxford University, Mathematics & Computer Science",
            bio: "I played an early prototype and saw the potential straight away. I've been helping to build it out since, both on the technical side and on game design too.",
        },
        {
            name: "Yassir",
            background: "École Polytechnique, Computer Science",
            bio: "[...]",
        },
    ];

    return (
        <HomeLayout>
            <div className="flex flex-col gap-16 px-6 lg:px-8">
                {/* Title and subtitle */}
                <section className="flex flex-col gap-4 max-w-3xl">
                    <TypographyH2>Mission</TypographyH2>
                    <TypographyLead className="text-foreground">
                        Energetica is a passion project by a small team. We
                        believe interactive play can make complex problems
                        genuinely understandable, in a way that lectures and
                        reports rarely achieve. We apply that belief to one of
                        the most important challenges of our time: the energy
                        transition.
                    </TypographyLead>
                </section>

                {/* Our Story */}
                <section className="flex flex-col gap-6 max-w-3xl">
                    <TypographyH2 className="text-primary">
                        Origins
                    </TypographyH2>
                    <div>
                        <TypographyP>
                            Energetica started as a semester project at{" "}
                            <strong>ETH Zürich</strong>. The premise was simple:
                            what if you could learn about energy systems not by
                            reading about it, but by living through it as a
                            player? Early playtests showed something surprising:
                            people who had never thought about capacity markets
                            or CO₂ pricing were suddenly arguing about them
                            after thirty minutes of play.
                        </TypographyP>
                        <TypographyP>
                            That reaction convinced us it was worth developing
                            further. Since then the project has grown into a
                            full multiplayer simulation, used in university
                            courses at <strong>ETH Zürich</strong> and{" "}
                            <strong>ZHAW</strong>, and continues to evolve.
                        </TypographyP>
                    </div>
                </section>

                {/* Our Team */}
                <section className="flex flex-col gap-6">
                    <TypographyH2 className="text-primary">
                        The Team
                    </TypographyH2>
                    <div className="grid gap-6 md:grid-cols-3">
                        {team.map((member) => (
                            <div
                                key={member.name}
                                className="p-6 bg-card rounded-4xl shadow-md flex flex-col gap-2"
                            >
                                <TypographyH3 className="text-xl">
                                    {member.name}
                                </TypographyH3>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    {member.background}
                                </p>
                                <TypographyP>{member.bio}</TypographyP>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Open Source */}
                <section className="max-w-6xl mx-auto w-full">
                    <div className="bg-primary rounded-4xl p-10 flex flex-col gap-4 items-center text-center shadow-md">
                        <TypographyH2 className="text-primary-foreground">
                            Open Source
                        </TypographyH2>
                        <TypographyLead className="text-primary-foreground max-w-xl">
                            Energetica is open source and developed in the open.
                            Contributions, feedback, and forks are welcome.
                        </TypographyLead>
                        <a
                            href="https://github.com/felixvonsamson/Energetica"
                            className="mt-4 inline-block bg-primary-foreground text-primary font-bold text-lg px-10 py-4 rounded-4xl shadow hover:opacity-90 hover:shadow-xl active:scale-95 transition-all"
                        >
                            View on GitHub
                        </a>
                    </div>
                </section>
            </div>
        </HomeLayout>
    );
}
