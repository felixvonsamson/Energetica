import { Link } from "@tanstack/react-router";
import { HomeLayout } from "./HomeLayout";
import { Cable, ChevronRight, Lightbulb, Unlink, Zap } from "lucide-react";

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
                "Set prices, buy and sell electricity, and compete with other players in a market driven by supply and demand. Experience the challenges of volatility and storage firsthand.",
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
                        <div className="absolute inset-0 overflow-hidden rounded-4xl bg-pine shadow-md">
                            {/* Rounded mask overlay */}
                        </div>
                        {/* Content overlay */}

                        <div className="relative mx-8  py-24 sm:py-32 lg:py-32 ">
                            <div className="text-center">
                                <h1 className="text-4xl font-bold tracking-tight text-light-green sm:text-6xl lg:text-7xl leading-tight">
                                    Learn Energy Systems by Playing
                                </h1>
                                <p className="mt-8 text-lg text-light-green sm:text-xl max-w-3xl mx-auto leading-relaxed">
                                    Energetica is multiplayer real-time
                                    simulation game about building sustainable
                                    futures.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Link
                            to="/learning-tool"
                            className="text-light-green bg-pine p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:shadow-xl"
                        >
                            <p className="text-xl">Learn more</p>
                            <ChevronRight />
                        </Link>
                        <a
                            href="/login"
                            className="text-light-green bg-pine p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:shadow-lg"
                        >
                            <p className="text-xl">Play now</p>
                            <ChevronRight />
                        </a>
                    </div>
                </section>
                <section className="px-6 max-w-5xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-6">Why Energetica?</h2>
                    <p className="text-lg max-w-3xl">
                        Climate change and the energy transition are defining
                        challenges. Energetica helps players experience the
                        trade-offs, strategies, and cooperation needed to build
                        a sustainable future.
                    </p>
                </section>
                <section>
                    <div className="max-w-6xl mx-auto grid gap-8 xl:grid-cols-2 2xl:grid-cols-4">
                        {features.map((f) => (
                            <div
                                key={f.title}
                                className="flex flex-col gap-4 p-6 text-center bg-gray-200 rounded-4xl shadow-md"
                            >
                                <div className="flex flex-row items-center justify-center gap-4">
                                    {/* <f.icon className="mx-auto h-10 w-10 text-indigo-600 mb-4" /> */}
                                    {f.icon}
                                    <h3 className="text-xl font-semibold">
                                        {f.title}
                                    </h3>
                                </div>
                                <p className="text-gray-600">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </HomeLayout>
    );
}
