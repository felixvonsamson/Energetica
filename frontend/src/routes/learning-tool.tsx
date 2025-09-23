import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "../components/HomeLayout";
import { TrendingUp, Package, BarChart3, CloudLightning } from "lucide-react";

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
                description:
                    "Make <b>strategic energy investments</b> by analyzing the Levelised Cost of Electricity (LCOE)." +
                    " Learn how technology, resources, and market trends shape the future of power generation." +
                    " Adapt your strategy as costs rise and conditions change!",
                icon: <TrendingUp />,
            },
            {
                title: "Resources Management",
                description:
                    "Work with scarce resources like land and fossil fuels." +
                    " As resources run out, extraction costs skyrocket." +
                    " Plan ahead to transition your energy system before it’s too late!",
                icon: <Package />,
            },
            {
                title: "Dynamic Energy Markets",
                description:
                    "Trade electricity with other players in a realistic market." +
                    " Prices shift with supply and demand, just like in real life." +
                    " Master strategic pricing and use storage to profit from volatility!",
                icon: <BarChart3 />,
            },
            {
                title: "Climate Consequences",
                description:
                    "Your actions impact the shared atmosphere." +
                    " Rising CO2 causes climate disasters, hurting everyone." +
                    " Work together on policies like carbon taxes to prevent chaos.",
                icon: <CloudLightning />,
            },
        ];
    return (
        <HomeLayout>
             <div className="flex flex-col gap-20 px-6 lg:px-8">
                <section>
                    <div className="max-w-6xl mx-auto grid gap-8 2xl:grid-cols-2">
                        {game_elements.map((f) => (
                            <div
                                key={f.title}
                                className="flex flex-col gap-4 p-6 text-center bg-bone rounded-4xl"
                            >
                                <div className="flex flex-row items-center justify-center gap-4">
                                    {f.icon}
                                    <h3 className="text-xl font-semibold">
                                        {f.title}
                                    </h3>
                                </div>
                                <p className="text-dark-brown">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </section>
             </div>
        </HomeLayout>
    );
}
