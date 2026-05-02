import { useState } from "react";

import { Link } from "@tanstack/react-router";
import {
    BarChart3,
    BookOpen,
    ChevronRight,
    Handshake,
    Package,
    Sun,
    TrendingUp,
    ZoomIn,
} from "lucide-react";

import { HomeLayout } from "@/components/home-layout";
import {
    Dialog,
    DialogContent,
    DialogOverlay,
    DialogPortal,
} from "@/components/ui/dialog";
import {
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyLead,
    TypographyP,
} from "@/components/ui/typography";

type ImageTile =
    | { type: "real"; src: string; alt: string; shadow?: boolean }
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
            type: "real",
            src: "/static/images/landing_page/investment_strategies.png",
            alt: "Investment strategies: technology research tree and LCOE comparison",
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
            src: "/static/images/landing_page/resources_management.png",
            alt: "Resources management: network graph showing resource and energy flows",
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
            type: "real",
            src: "/static/images/landing_page/dynamic_energy_markets2.png",
            alt: "Dynamic energy markets: merit order chart and electricity market",
            shadow: true,
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
            type: "real",
            src: "/static/images/landing_page/renewable_intermittency.png",
            alt: "Renewable intermittency: wind and solar production graph with weather model",
            shadow: true,
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
            src: "/static/images/landing_page/collective_action.png",
            alt: "Collective action: global average temperatures graph showing climate change",
            shadow: true,
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
            type: "real",
            src: "/static/images/landing_page/daily_knowledge_boost.png",
            alt: "Daily knowledge boost: daily quiz interface",
        },
    },
];

function ImageLightbox({
    src,
    alt,
    open,
    onOpenChange,
}: {
    src: string;
    alt: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                <DialogOverlay />
                <DialogContent
                    className="max-w-[90vw] xl:max-w-5xl p-2 bg-background/95 border-border"
                    showCloseButton={true}
                >
                    <img
                        src={src}
                        alt={alt}
                        className="w-full h-auto rounded-2xl object-contain max-h-[80vh]"
                    />
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
}

function ImageTileComponent({ image }: { image: ImageTile }) {
    const [lightboxOpen, setLightboxOpen] = useState(false);

    if (image.type === "real") {
        return (
            <>
                <button
                    onClick={() => setLightboxOpen(true)}
                    className={`group overflow-hidden rounded-4xl h-full relative cursor-zoom-in w-full text-left${image.shadow ? " shadow-md" : ""}`}
                    aria-label={`Enlarge image: ${image.alt}`}
                >
                    <img
                        src={image.src}
                        alt={image.alt}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 rounded-4xl flex items-center justify-center">
                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 size-8 drop-shadow-lg" />
                    </div>
                </button>
                <ImageLightbox
                    src={image.src}
                    alt={image.alt}
                    open={lightboxOpen}
                    onOpenChange={setLightboxOpen}
                />
            </>
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
                            <div className="mt-10 mx-auto max-w-6xl overflow-hidden rounded-3xl shadow-lg">
                                <img
                                    src="/static/images/landing_page/energetica_landing_banner.png"
                                    alt="Energetica game interface showing power grid management"
                                    className="w-full h-auto"
                                />
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

                {/* Game element cards — one image per card, alternating layout */}
                <section className="max-w-6xl mx-auto w-full flex flex-col gap-8">
                    <TypographyH2 className="mb-6 text-primary text-center">
                        What You'll Experience
                    </TypographyH2>
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
