import { Link } from "@tanstack/react-router";
import { Cable, ChevronRight, Lightbulb, Unlink, Zap } from "lucide-react";

import { HomeLayout } from "@/components/home-layout";
import {
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyLead,
    TypographyMuted,
} from "@/components/ui/typography";

export function LandingPage() {
    const features = [
        {
            title: "Make Strategic Energy Choices",
            description:
                "Build power plants, invest in new technologies, and balance costs, efficiency, and emissions. Every decision shapes your path toward sustainability—or collapse.",
            icon: <Zap />,
        },
        {
            title: "Trade on Dynamic Markets",
            description:
                "Set prices, buy and sell electricity, and compete with other players in a market driven by supply and demand. Experience the challenges of volatility and storage first-hand.",
            icon: <Cable />,
        },
        {
            title: "Face Climate Impacts Together",
            description:
                "CO₂ emissions from all players add up, raising global risks of floods, heatwaves, and wildfires. Your actions affect everyone—cooperation and policy are key.",
            icon: <Unlink />,
        },
        {
            // NOTE(mglst): I'm not sure that the daily quiz is important enough to be put forward like this. Or maybe the description should be reworked
            title: "Learn Beyond the Game",
            description:
                "A daily quiz connects the simulation to real-world energy and climate issues, sparking surprising insights and broader learning opportunities.",
            icon: <Lightbulb />,
        },
    ];
    return (
        <HomeLayout>
            <div className="flex flex-col gap-20 px-6 lg:px-8">
                {/* Background illustration */}
                <section className="flex flex-col gap-8">
                    <div className="relative">
                        <div className="absolute inset-0 overflow-hidden rounded-4xl bg-primary shadow-md">
                            {/* Rounded mask overlay */}
                        </div>
                        {/* Content overlay */}

                        <div className="relative mx-8  py-24 sm:py-32 lg:py-32 ">
                            <div className="text-center">
                                <TypographyH1 className="tracking-tight text-primary-foreground sm:text-6xl lg:text-7xl leading-tight">
                                    Learn Energy Systems by Playing
                                </TypographyH1>
                                <TypographyLead className="mt-8 text-primary-foreground sm:text-xl max-w-3xl mx-auto leading-relaxed">
                                    Energetica is multiplayer real-time
                                    simulation game about building sustainable
                                    futures.
                                </TypographyLead>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Link
                            to="/learning-tool"
                            className="bg-primary text-primary-foreground p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:shadow-xl"
                        >
                            <p className="text-xl">Learn more</p>
                            <ChevronRight />
                        </Link>
                        <Link
                            to="/app/login"
                            className="bg-primary text-primary-foreground p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:shadow-lg"
                        >
                            <p className="text-xl text">Play now</p>
                            <ChevronRight />
                        </Link>
                    </div>
                </section>
                <section className="px-6 max-w-5xl mx-auto text-center">
                    <TypographyH2 className="mb-6 text-primary">
                        Why Energetica?
                    </TypographyH2>
                    <TypographyLead className="max-w-3xl text-primary">
                        Climate change and the energy transition are defining
                        challenges. Energetica helps players experience the
                        trade-offs, strategies, and cooperation needed to build
                        a sustainable future.
                    </TypographyLead>
                </section>
                <section>
                    <div className="max-w-6xl mx-auto grid gap-8 xl:grid-cols-2 2xl:grid-cols-4">
                        {features.map((f) => (
                            <div
                                key={f.title}
                                className="flex flex-col gap-4 p-6 text-center bg-card rounded-4xl shadow-md"
                            >
                                <div className="flex flex-row items-center justify-center gap-4">
                                    {/* <f.icon className="mx-auto h-10 w-10 text-indigo-600 mb-4" /> */}
                                    {f.icon}
                                    <TypographyH3 className="text-xl text-foreground">
                                        {f.title}
                                    </TypographyH3>
                                </div>
                                <TypographyMuted>
                                    {f.description}
                                </TypographyMuted>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </HomeLayout>
    );
}
