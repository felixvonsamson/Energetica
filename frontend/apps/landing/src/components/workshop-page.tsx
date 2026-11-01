import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@energetica/ui/components/dialog";
import {
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyLead,
    TypographyP,
} from "@energetica/ui/components/typography";
import {
    GraduationCap,
    Landmark,
    PartyPopper,
    Puzzle,
    Sun,
    Users,
    Zap,
    ZoomIn,
    type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import megawattTimesExample from "@/assets/megawatt_times_example.webp";
import facilityCards from "@/assets/workshop_facility_cards.webp";
import roundLoop from "@/assets/workshop_round_loop.webp";
import { HomeLayout } from "@/components/home-layout";
import { workshopEnquiryHref } from "@/lib/contact";

const facts = [
    "2–4 hours",
    "5–50 participants",
    "English, French or German",
    "Anywhere in Europe",
];

const outcomes: { title: string; description: string; icon: LucideIcon }[] = [
    {
        title: "Inside a living electricity market",
        description:
            "Every decision moves the market. Participants discover why the most expensive plant still needed sets the price for everyone, and use concepts like marginal cost and LCOE to plan their next move.",
        icon: Zap,
    },
    {
        title: "The energy transition, first-hand",
        description:
            "Wind, solar and batteries reshape prices across the day and the seasons, while blackouts and CO₂ emissions become everyone's problem. Your group lives it instead of reading about it.",
        icon: Sun,
    },
    {
        title: "New challenges every Round",
        description:
            "Every Round brings something new: a surge in demand, a new technology, a price shock. The competition does the rest, as players team up when it pays and strategize against each other when it doesn't.",
        icon: Puzzle,
    },
    {
        title: "A great time with your team",
        description:
            "Energetica is an original way to take on serious topics: challenging, fun, and with so much to keep track of that teamwork and a good division of tasks make all the difference.",
        icon: PartyPopper,
    },
];

const steps = [
    {
        title: "Invest",
        description: "Each company decides which power plants to build.",
    },
    {
        title: "Set prices",
        description:
            "For each of the four seasons, companies bid on the market by setting the price they are ready to sell electricity at.",
    },
    {
        title: "See the market clear",
        description:
            "The market settles and the group looks at the results together: who sold, at what price, and why.",
    },
    {
        title: "Adaptive Gameplay",
        description:
            "At the end of each round, an in-game newspaper recaps the year’s events, announces new developments, and sets out the decisions waiting in the next round. The game adapts as it goes: difficulty and available features evolve with the group’s choices, so every session stays engaging and challenging.",
    },
];

const audiences: { label: string; icon: LucideIcon }[] = [
    { label: "Energy companies and utilities", icon: Zap },
    { label: "Public administrations and regulators", icon: Landmark },
    { label: "Universities and schools", icon: GraduationCap },
    { label: "Associations, NGOs and conferences", icon: Users },
];

const weBring = [
    "Facilitators who run the in-person session",
    "The server the game runs on",
    "Accounts for every participant",
    "Printed help sheets",
];

const youProvide = [
    "A room",
    "Laptops for the participants",
    "A working Wi-Fi connection",
    "A projector or large screen",
];

/** The newspaper is tall, so the page shows its top and opens the rest on click. */
function ExampleEdition() {
    const [open, setOpen] = useState(false);
    const alt =
        "An example edition of The Megawatt Times, with articles on a data centre boom, the arrival of offshore wind turbines, a carbon tax vote and a rise in solar panel prices";
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label="Read the full example edition of The Megawatt Times"
                className="group relative block w-full h-112 overflow-hidden rounded-4xl bg-white shadow-md cursor-zoom-in text-left"
            >
                <img src={megawattTimesExample} alt={alt} className="w-full" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-white to-transparent" />
                <span className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-2 font-semibold text-neutral-900">
                    <ZoomIn className="size-5" />
                    Read the full edition
                </span>
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                {/* Each breakpoint needs its own width because the shared dialog sets one per breakpoint. */}
                <DialogContent className="w-[95vw] max-w-7xl sm:max-w-7xl md:max-w-7xl xl:max-w-7xl max-h-[95vh] overflow-hidden p-2 bg-white">
                    <DialogTitle className="sr-only">
                        The Megawatt Times, example edition
                    </DialogTitle>
                    {/* Only the newspaper scrolls, so the close button stays in view. The minimum width keeps it readable on phones, which scroll sideways too. */}
                    <div
                        // Focus lets the arrow keys scroll the newspaper as soon as it opens.
                        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                        tabIndex={0}
                        className="max-h-[calc(95vh-1.25rem)] overflow-auto outline-none"
                    >
                        <img
                            src={megawattTimesExample}
                            alt={alt}
                            className="w-full min-w-3xl max-w-none"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function CheckList({ title, items }: { title: string; items: string[] }) {
    return (
        <div className="flex flex-col gap-3 p-6 bg-card rounded-4xl shadow-md">
            <TypographyH3 className="text-xl text-foreground">
                {title}
            </TypographyH3>
            <ul className="list-disc pl-5 flex flex-col gap-1">
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

export function WorkshopPage() {
    return (
        <HomeLayout>
            <div className="flex flex-col gap-20 px-6 lg:px-8">
                {/* Banner image */}
                <section className="max-w-6xl mx-auto w-full">
                    <img
                        src={facilityCards}
                        alt="Five facility cards from the game's catalog, each with its price tag: PV solar, offshore wind turbine, lithium-ion batteries, nuclear reactor and coal burner"
                        className="w-full"
                    />
                </section>

                {/* Header */}
                <section className="flex flex-col items-center gap-6 max-w-3xl mx-auto text-center">
                    <TypographyH1 className="text-balance">
                        Run an Electricity Market in a Single Afternoon
                    </TypographyH1>
                    <TypographyLead className="text-foreground">
                        In an Energetica workshop, your group runs competing
                        energy companies. They build power plants, set their
                        prices and face the consequences together. Our
                        facilitators lead the session, and no energy background
                        is needed. It's a great way to take on challenges as a
                        group and have fun together.
                    </TypographyLead>
                    <ul className="flex flex-wrap justify-center gap-2">
                        {facts.map((fact) => (
                            <li
                                key={fact}
                                className="bg-card text-foreground font-semibold px-4 py-1 rounded-full shadow-sm"
                            >
                                {fact}
                            </li>
                        ))}
                    </ul>
                    <a
                        href={workshopEnquiryHref}
                        className="bg-primary text-primary-foreground font-bold text-lg px-10 py-4 rounded-4xl shadow-md hover:bg-primary/90 hover:shadow-xl active:scale-95 transition-all"
                    >
                        Ask about a workshop
                    </a>
                </section>

                {/* Outcomes */}
                <section className="max-w-6xl mx-auto w-full flex flex-col gap-10">
                    <TypographyH2 className="text-primary">
                        What Your Group Takes Away
                    </TypographyH2>
                    <div className="grid gap-8 xl:grid-cols-2">
                        {outcomes.map((outcome) => (
                            <div
                                key={outcome.title}
                                className="flex flex-col gap-3 p-6 bg-card rounded-4xl shadow-md"
                            >
                                <div className="flex flex-row items-center gap-4">
                                    <div className="shrink-0 size-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shadow-md">
                                        <outcome.icon />
                                    </div>
                                    <TypographyH3 className="text-xl text-foreground">
                                        {outcome.title}
                                    </TypographyH3>
                                </div>
                                <TypographyP className="mt-0!">
                                    {outcome.description}
                                </TypographyP>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How a session runs */}
                <section className="max-w-6xl mx-auto w-full flex flex-col gap-10">
                    <div className="flex flex-col gap-3">
                        <TypographyH2 className="text-primary">
                            How a Session Runs
                        </TypographyH2>
                    </div>
                    <div className="grid gap-8 xl:grid-cols-2 items-center">
                        <img
                            src={roundLoop}
                            alt="One Round is one year: an Investment phase, then price setting and a market simulation for spring, summer, autumn and winter, then a Round Recap"
                            className="w-full rounded-4xl bg-card shadow-md"
                        />
                        <ol className="flex flex-col gap-6">
                            {steps.map((step, index) => (
                                <li key={step.title} className="flex gap-4">
                                    <span className="shrink-0 size-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <TypographyH3 className="text-xl text-foreground">
                                            {step.title}
                                        </TypographyH3>
                                        <p>{step.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* The Megawatt Times */}
                <section className="max-w-6xl mx-auto w-full grid gap-8 xl:grid-cols-2 items-center">
                    <div className="flex flex-col gap-4">
                        <TypographyH2 className="text-primary">
                            The News at the End of Every Year
                        </TypographyH2>
                        <TypographyP>
                            After each Round, everyone reads the same newspaper:
                            The Megawatt Times. It reports what happened to the
                            market and warns of what may come next, which gives
                            the group something concrete to discuss.
                        </TypographyP>
                        <p className="text-sm">
                            This example comes from a test session played by
                            bots. Every session writes its own edition.
                        </p>
                    </div>
                    <ExampleEdition />
                </section>

                {/* Who it's for */}
                <section className="max-w-6xl mx-auto w-full flex flex-col gap-6">
                    <TypographyH2 className="text-primary">
                        Who It's For
                    </TypographyH2>
                    <TypographyP className="mt-0!">
                        Workshops work for people new to the subject, for
                        specialists who want to test their intuition, and for
                        teams looking for a memorable activity to share. Before
                        the session, we talk with you about your group and its
                        goals, and we adapt the session to them.
                    </TypographyP>
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {audiences.map((audience) => (
                            <li
                                key={audience.label}
                                className="flex items-center gap-3 p-5 bg-card rounded-3xl shadow-sm font-semibold"
                            >
                                <audience.icon className="shrink-0 size-5 text-primary" />
                                {audience.label}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Logistics */}
                <section className="max-w-6xl mx-auto w-full flex flex-col gap-6">
                    <TypographyH2 className="text-primary">
                        What It Takes
                    </TypographyH2>
                    <div className="grid gap-8 md:grid-cols-2">
                        <CheckList title="We bring" items={weBring} />
                        <CheckList title="You provide" items={youProvide} />
                    </div>
                </section>

                {/* Pricing and contact */}
                <section className="max-w-6xl mx-auto w-full">
                    <div className="bg-primary rounded-4xl p-10 flex flex-col gap-4 items-center text-center shadow-md">
                        <TypographyH2 className="text-primary-foreground">
                            Bring a Workshop to Your Group
                        </TypographyH2>
                        <TypographyLead className="text-primary-foreground max-w-3xl">
                            Pricing depends on group size, location and how much
                            we adapt the session. Send us your date and group
                            size, and we'll send you a quote.
                        </TypographyLead>
                        <a
                            href={workshopEnquiryHref}
                            className="mt-4 inline-block bg-primary-foreground text-primary font-bold text-lg px-10 py-4 rounded-4xl shadow hover:opacity-90 hover:shadow-xl active:scale-95 transition-all"
                        >
                            Ask about a workshop
                        </a>
                    </div>
                </section>
            </div>
        </HomeLayout>
    );
}
