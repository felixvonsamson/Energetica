import { createFileRoute } from "@tanstack/react-router";

import { HomeLayout } from "@/components/home-layout";
import {
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyLead,
    TypographyP,
} from "@/components/ui/typography";

export const Route = createFileRoute("/about")({
    component: RouteComponent,
    staticData: {
        title: "About",
    },
});

function RouteComponent() {
    const team = [
        { name: "Felix", role: "role", bio: "bio" },
        { name: "Max", role: "role", bio: "bio" },
        { name: "Yassir", role: "role", bio: "bio" },
        { name: "Antoine", role: "role", bio: "bio" },
    ];
    return (
        <HomeLayout>
            <div className="flex flex-col gap-12 px-6 lg:px-8">
                {/* Title and subtitle */}
                <section className="flex flex-col gap-4">
                    <TypographyH1>About Energetica</TypographyH1>
                    <TypographyLead>
                        We believe games can change how people understand energy
                        and climate
                    </TypographyLead>
                </section>
                {/* Our Story */}
                <section className="flex flex-col gap-4">
                    <TypographyH2>Origins of the Project</TypographyH2>
                    <div>
                        <TypographyP>
                            Energetica began as a semester project at{" "}
                            <strong>ETH Zürich</strong>. The game received
                            strong reactions, and high engagement from early
                            players.
                        </TypographyP>
                        <TypographyP>
                            Since then, the project has continued to grow. We
                            have built up a dedicated team from around the
                            world.
                        </TypographyP>
                    </div>
                </section>
                {/* Our Team */}
                <section className="flex flex-col gap-4">
                    <TypographyH2>Our Team</TypographyH2>
                    <div className="grid gap-8 md:grid-cols-2">
                        {team.map((member) => (
                            <div
                                key={member.name}
                                className="p-6 bg-gray-200 rounded-xl shadow text-center"
                            >
                                <TypographyH3>{member.name}</TypographyH3>
                                {/* <p className="text-indigo-600">{member.role}</p> */}
                                {/* <p className="mt-2 text-gray-600">
                                    {member.bio}
                                </p> */}
                            </div>
                        ))}
                    </div>
                </section>
                {/* Our Values */}
                {/* <section className="flex flex-col gap-4">
                    <h2 className="text-2xl font-semibold">Our Values</h2>
                    <ul className="space-y-4">
                        <li>
                            <strong>Education through play</strong> — learning
                            complex topics works best when it's interactive.
                        </li>
                        <li>
                            <strong>Collaboration</strong> — we work openly with
                            educators, researchers, and players.
                        </li>
                        <li>
                            <strong>Accessibility</strong> — the game is free
                            and open-source.
                        </li>
                        <li>
                            <strong>Climate responsibility</strong> —
                            highlighting the importance of collective action.
                        </li>
                    </ul>
                </section> */}
            </div>
        </HomeLayout>
    );
}
