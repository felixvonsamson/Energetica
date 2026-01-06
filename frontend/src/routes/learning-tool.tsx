import { createFileRoute, Link } from "@tanstack/react-router";
import {
    TrendingUp,
    Package,
    BarChart3,
    Sun,
    Handshake,
    BookOpen,
    ChevronRight,
} from "lucide-react";

import { HomeLayout } from "@/components/HomeLayout";

export const Route = createFileRoute("/learning-tool")({
    component: RouteComponent,
    staticData: {
        title: "Learning Through Play",
    },
});

function RouteComponent() {
    const game_elements = [
        {
            title: "Investment Strategies",
            description: (
                <>
                    Players learn to analyze the Levelised Cost of Electricity
                    (LCOE) to make strategic decisions across energy
                    technologies. As conditions change, they must continuously
                    adapt their strategy to stay competitive.
                </>
            ),
            icon: <TrendingUp />,
        },
        {
            title: "Resources Management",
            description: (
                <>
                    Scarcity of natural resources forces players to think
                    efficiently. As fossil fuels are depleted and extraction
                    costs increase, they must plan a smooth transition to
                    sustainable technologies.
                </>
            ),
            icon: <Package />,
        },
        {
            title: "Dynamic Energy Markets",
            description: (
                <>
                    A realistic energy market reacts to supply and demand,
                    creating fluctuating prices. Players explore how storage
                    technologies and strategic pricing can stabilize the grid
                    and generate profit.
                </>
            ),
            icon: <BarChart3 />,
        },
        {
            title: "Renewable Intermittency",
            description: (
                <>
                    Wind and solar power are clean but variable and unreliable.
                    A realistic weather model drives the simulation, making the
                    player experience the challenge of balancing this
                    variability and the role of storage in creating a fully
                    renewable energy system.
                </>
            ),
            icon: <Sun />,
        },
        {
            title: "Collective Action",
            description: (
                <>
                    High CO2 emissions affect a shared atmosphere, leading to
                    increasingly severe climate events that harm everyone,
                    showing the global nature of climate change. Players
                    experience how collective action is vital to address shared
                    risks.
                </>
            ),
            icon: <Handshake />,
        },
        {
            title: "Daily Knowledge Boost",
            description: (
                <>
                    A daily quiz expands the learning experience, covering
                    energy, climate, and social justice topics. It helps players
                    connect game concepts to real-world issues.
                </>
            ),
            icon: <BookOpen />,
        },
    ];
    const tile_images = [
        "/static/images/landing/network_graph.png",
        "/static/images/landing/global_average_temperatures_graph.png",
    ];
    return (
        <HomeLayout>
            <div className="flex flex-col gap-20 px-6 lg:px-8">
                <section>
                    <div className="max-w-6xl mx-auto flex flex-col gap-12">
                        {/* Header Image */}
                        <div className="w-full">
                            <img
                                src="/static/images/landing/live_demo_photo.jpg"
                                alt="2 Students playing Energetica"
                                className="w-full rounded-4xl shadow-lg object-cover max-h-144"
                            />
                        </div>

                        {/* Game Element Tiles */}
                        <div className="max-w-6xl mx-auto grid gap-8 xl:grid-cols-2">
                            {game_elements.map((f, index) => (
                                <>
                                    {/* Text tiles */}
                                    <div
                                        key={f.title}
                                        className="flex flex-col gap-4 p-6 bg-bone dark:bg-dark-bg-secondary rounded-4xl shadow-md"
                                    >
                                        <div className="flex flex-row items-center justify-center gap-4 text-bone-text dark:text-dark-text-primary">
                                            {f.icon}
                                            <h3 className="text-xl font-semibold">
                                                {f.title}
                                            </h3>
                                        </div>
                                        <p className="text-bone-text dark:text-dark-text-secondary">
                                            {f.description}
                                        </p>
                                    </div>

                                    {/* Add image tile after 2nd and 4th position */}
                                    {(index === 1 || index === 3) && (
                                        <div className="overflow-hidden rounded-4xl shadow-md">
                                            <img
                                                src={
                                                    tile_images[
                                                        index === 1 ? 0 : 1
                                                    ]
                                                }
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                </>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Call to Action */}
                <section className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Link
                            to="/app/wiki/$slug"
                            params={{ slug: "introduction" }}
                            className="text-bone dark:text-dark-text-primary bg-pine dark:bg-dark-bg-secondary p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:shadow-lg"
                        >
                            <p className="text-xl">Explore the Wiki</p>
                            <ChevronRight />
                        </Link>
                        <Link
                            to="/app/login"
                            className="text-bone dark:text-dark-text-primary bg-pine dark:bg-dark-bg-secondary p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:shadow-lg"
                        >
                            <p className="text-xl">Play now</p>
                            <ChevronRight />
                        </Link>
                    </div>
                </section>
            </div>
        </HomeLayout>
    );
}
