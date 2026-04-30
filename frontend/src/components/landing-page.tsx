import { Link } from "@tanstack/react-router";
import {
    BarChart3,
    BookOpen,
    ChevronRight,
    Handshake,
    Package,
    Sun,
    TrendingUp,
} from "lucide-react";

import { HomeLayout } from "@/components/home-layout";
import {
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyLead,
    TypographyP,
} from "@/components/ui/typography";

type ImageTile =
    | { type: "real"; src: string; alt: string }
    | { type: "placeholder"; text: string };

const gameElements: {
    title: string;
    description: React.ReactNode;
    icon: React.ReactNode;
    image: ImageTile;
}[] = [
    {
        title: "Investment Strategies",
        description: (
            <>
                Players learn to analyze the Levelised Cost of Electricity
                (LCOE) to make strategic decisions across energy technologies.
                As conditions change, they must continuously adapt their
                strategy to stay competitive.
            </>
        ),
        icon: <TrendingUp />,
        image: {
            type: "placeholder",
            text: "SCREENSHOT: technology research tree / LCOE comparison",
        },
    },
    {
        title: "Resources Management",
        description: (
            <>
                Scarcity of natural resources forces players to think
                efficiently. As fossil fuels are depleted and extraction costs
                increase, they must plan a smooth transition to sustainable
                technologies.
            </>
        ),
        icon: <Package />,
        image: {
            type: "real",
            src: "/static/images/landing/network_graph.png",
            alt: "Network graph showing resource and energy flows",
        },
    },
    {
        title: "Dynamic Energy Markets",
        description: (
            <>
                A realistic energy market reacts to supply and demand, creating
                fluctuating prices. Players explore how storage technologies
                and strategic pricing can stabilize the grid and generate
                profit.
            </>
        ),
        icon: <BarChart3 />,
        image: {
            type: "placeholder",
            text: "SCREENSHOT: merit order chart / electricity market",
        },
    },
    {
        title: "Renewable Intermittency",
        description: (
            <>
                Wind and solar power are clean but variable and unreliable. A
                realistic weather model drives the simulation, making the
                player experience the challenge of balancing this variability
                and the role of storage in creating a fully renewable energy
                system.
            </>
        ),
        icon: <Sun />,
        image: {
            type: "placeholder",
            text: "SCREENSHOT: wind & solar production graph / weather model",
        },
    },
    {
        title: "Collective Action",
        description: (
            <>
                High CO₂ emissions affect a shared atmosphere, leading to
                increasingly severe climate events that harm everyone, showing
                the global nature of climate change. Players experience how
                collective action is vital to address shared risks.
            </>
        ),
        icon: <Handshake />,
        image: {
            type: "real",
            src: "/static/images/landing/global_average_temperatures_graph.png",
            alt: "Global average temperatures graph showing climate change",
        },
    },
    {
        title: "Daily Knowledge Boost",
        description: (
            <>
                A daily quiz expands the learning experience, covering energy,
                climate, and social justice topics. It helps players connect
                game concepts to real-world issues.
            </>
        ),
        icon: <BookOpen />,
        image: {
            type: "placeholder",
            text: "SCREENSHOT: daily quiz interface",
        },
    },
];

function ImageTileComponent({ image }: { image: ImageTile }) {
    if (image.type === "real") {
        return (
            <div className="overflow-hidden rounded-4xl shadow-md h-full">
                <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }
    return (
        <div className="rounded-4xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 h-full flex flex-col items-center justify-center gap-2 text-muted-foreground p-6">
            <p className="text-sm font-semibold uppercase tracking-widest">
                Screenshot placeholder
            </p>
            <p className="text-xs text-center max-w-xs">[{image.text}]</p>
        </div>
    );
}

export function LandingPage() {
    return (
        <HomeLayout>
            <div className="flex flex-col gap-20 px-6 lg:px-8">
                {/* Hero */}
                <section className="flex flex-col gap-8">
                    <div className="relative">
                        <div className="absolute inset-0 overflow-hidden rounded-4xl bg-primary shadow-md" />
                        <div className="relative mx-8 pt-16 pb-8 sm:pt-20 sm:pb-10">
                            <div className="text-center flex flex-col gap-4">
                                <TypographyH1 className="tracking-tight text-primary-foreground sm:text-6xl lg:text-7xl leading-tight">
                                    Build Power Plants.
                                    <br />
                                    Trade Electricity.
                                    <br />
                                    Save the Climate.
                                </TypographyH1>
                                <TypographyLead className="text-primary-foreground sm:text-xl max-w-2xl mx-auto leading-relaxed">
                                    Energetica is a multiplayer strategy game
                                    where you manage a power grid, compete on
                                    electricity markets, and face the collective
                                    consequences of CO₂ emissions.
                                </TypographyLead>
                                <p className="text-primary-foreground/70 text-sm font-medium mt-2">
                                    Used in courses at{" "}
                                    <span className="text-primary-foreground font-semibold">
                                        ETH Zürich
                                    </span>{" "}
                                    and{" "}
                                    <span className="text-primary-foreground font-semibold">
                                        ZHAW
                                    </span>{" "}
                                    · Open source
                                </p>
                            </div>
                            {/* Screenshot placeholder */}
                            <div className="mt-10 mx-auto max-w-4xl rounded-3xl border-2 border-dashed border-primary-foreground/30 bg-primary-foreground/10 h-72 flex flex-col items-center justify-center gap-2 text-primary-foreground/60">
                                <p className="text-sm font-semibold uppercase tracking-widest">
                                    Screenshot placeholder
                                </p>
                                <p className="text-xs text-center max-w-xs">
                                    [SCREENSHOT: e.g. merit order chart / power
                                    production graph / map view / facility
                                    management UI]
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTAs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            to="/app/login"
                            className="md:col-span-2 bg-primary text-primary-foreground p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:bg-primary/90 hover:shadow-xl active:scale-[0.99] transition-all"
                        >
                            <p className="text-xl font-semibold">
                                Play now — it's free
                            </p>
                            <ChevronRight />
                        </Link>
                        <Link
                            to="/for-educators"
                            className="bg-card text-foreground border border-border p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:bg-muted hover:shadow-lg active:scale-[0.99] transition-all"
                        >
                            <p className="text-lg">For Educators</p>
                            <ChevronRight />
                        </Link>
                    </div>
                </section>

                {/* Section intro */}
                <section className="px-6 max-w-5xl mx-auto text-center">
                    <TypographyH2 className="mb-6 text-primary">
                        What You'll Experience
                    </TypographyH2>
                    <TypographyLead className="max-w-3xl text-primary">
                        Climate change and the energy transition are defining
                        challenges. Energetica lets you experience the
                        trade-offs, strategies, and cooperation needed to build
                        a sustainable future.
                    </TypographyLead>
                </section>

                {/* Game element cards — one image per card, alternating layout */}
                <section className="max-w-6xl mx-auto w-full flex flex-col gap-8">
                    {gameElements.map((el, index) => {
                        const card = (
                            <div className="flex flex-col gap-4 p-6 bg-card rounded-4xl shadow-md h-full">
                                <div className="flex flex-row items-center gap-4">
                                    <div className="shrink-0 size-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shadow-md">
                                        {el.icon}
                                    </div>
                                    <TypographyH3 className="text-xl text-foreground">
                                        {el.title}
                                    </TypographyH3>
                                </div>
                                <TypographyP>{el.description}</TypographyP>
                            </div>
                        );
                        const image = (
                            <ImageTileComponent image={el.image} />
                        );
                        return (
                            <div
                                key={el.title}
                                className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:min-h-52"
                            >
                                {index % 2 === 0 ? (
                                    <>
                                        {card}
                                        {image}
                                    </>
                                ) : (
                                    <>
                                        {image}
                                        {card}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </section>

                {/* Bottom CTAs */}
                <section className="max-w-6xl mx-auto w-full">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            to="/app/login"
                            className="md:col-span-2 bg-primary text-primary-foreground p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:bg-primary/90 hover:shadow-xl active:scale-[0.99] transition-all"
                        >
                            <p className="text-xl font-semibold">Play now</p>
                            <ChevronRight />
                        </Link>
                        <Link
                            to="/app/wiki/$slug"
                            params={{ slug: "introduction" }}
                            className="bg-card text-foreground border border-border p-4 rounded-4xl flex flex-row justify-center items-center shadow-md hover:bg-muted hover:shadow-lg active:scale-[0.99] transition-all"
                        >
                            <p className="text-lg">Explore the Wiki</p>
                            <ChevronRight />
                        </Link>
                    </div>
                </section>
            </div>
        </HomeLayout>
    );
}
