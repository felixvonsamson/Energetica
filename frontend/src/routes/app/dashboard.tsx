import { createFileRoute, Link } from "@tanstack/react-router";
import {
    Construction,
    FlaskConical,
    Truck,
    Coins,
    Zap,
    BatteryFull,
    Leaf,
    TrendingUp,
    Package,
    Trophy,
    HelpCircle,
    Thermometer,
    Link2,
    Calendar,
    Microscope,
    HardHat,
} from "lucide-react";

import { AchievementCard } from "@/components/dashboard/achievement-card";
import { DailyQuizButton } from "@/components/dashboard/daily-quiz";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import {
    ProjectList,
    ShipmentList,
} from "@/components/dashboard/progress-lists";
import { QuickLinkCard } from "@/components/dashboard/quick-link-card";
import { WeatherSection } from "@/components/dashboard/weather";
import { DevelopmentBanner } from "@/components/development-banner";
import { GameLayout } from "@/components/layout/game-layout";
import { PageCard, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useAchievements } from "@/hooks/use-achievements";
import { useCapabilities, useHasCapability } from "@/hooks/use-capabilities";
import { useProjects } from "@/hooks/use-projects";
import { useShipments } from "@/hooks/use-shipments";

export const Route = createFileRoute("/app/dashboard")({
    component: DashboardPage,
    staticData: {
        title: "Dashboard",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => ({ unlocked: true }),
        },
        infoDialog: {
            contents: <DashboardHelp />,
        },
    },
});

function DashboardHelp() {
    return (
        <div className="space-y-3">
            <p>This is the dashboard of your account. Here you will find:</p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 shrink-0" />
                    <span>
                        Current weather conditions and the in-game season
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Construction className="w-4 h-4 shrink-0" />
                    <span>Ongoing or planned construction projects</span>
                </li>
                <li className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 shrink-0" />
                    <span>Ongoing or planned research projects</span>
                </li>
                <li className="flex items-center gap-2">
                    <Truck className="w-4 h-4 shrink-0" />
                    <span>Ongoing shipments</span>
                </li>
                <li className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 shrink-0" />
                    <span>Quick links to the most important pages</span>
                </li>
                <li className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 shrink-0" />
                    <span>Progression information about achievements</span>
                </li>
                <li className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>Daily quiz to win xp</span>
                </li>
            </ul>
            <p>
                For more info about in-game time and weather, see the{" "}
                <a
                    href="/wiki/time_and_weather"
                    className="underline hover:opacity-80 text-foreground"
                >
                    wiki
                </a>
                .
            </p>
        </div>
    );
}

function DashboardPage() {
    return (
        <GameLayout>
            <DashboardContent />
        </GameLayout>
    );
}

function DashboardContent() {
    const capabilities = useCapabilities();
    const { data: projectsData } = useProjects();
    const { data: shipmentsData } = useShipments();

    const hasDiscoveredGreenhouse = useHasCapability(
        "has_greenhouse_gas_effect",
    );
    const hasNetwork = useHasCapability("has_network");

    // Check if there are any construction projects
    const hasConstructionProjects =
        (projectsData?.construction_queue.length ?? 0) > 0;

    // Check if there are any research projects
    const hasResearchProjects = (projectsData?.research_queue.length ?? 0) > 0;

    // Check if there are any shipments
    const hasShipments = (shipmentsData?.shipments.length ?? 0) > 0;

    return (
        <div className="py-4 md:p-8 flex flex-col gap-6">
            {/* Development info banner */}
            <div className="px-4 md:px-0">
                <DevelopmentBanner />
            </div>

            {/* Weather section */}
            <PageCard>
                <CardContent>
                    <WeatherSection />
                </CardContent>
            </PageCard>

            {/* Construction - only show if there are any construction projects */}
            {hasConstructionProjects && (
                <>
                    <DashboardSection
                        title={
                            <>
                                <HardHat className="inline w-4 h-4" /> Under
                                Construction
                            </>
                        }
                    >
                        <ProjectList projectCategory={"construction"} />
                    </DashboardSection>
                </>
            )}

            {/* Under research - only show if player has laboratory and has research projects */}
            {capabilities?.has_laboratory && hasResearchProjects && (
                <DashboardSection
                    title={
                        <>
                            <Microscope className="inline w-4 h-4" /> Under
                            Research
                        </>
                    }
                    emptyIcon={FlaskConical}
                    emptyMessage="No technologies under research"
                >
                    <ProjectList projectCategory={"research"} />
                </DashboardSection>
            )}

            {/* Shipments - only show if player has warehouse and has shipments */}
            {capabilities?.has_warehouse && hasShipments && (
                <DashboardSection
                    title={
                        <>
                            <Truck className="inline w-4 h-4" /> Shipments
                        </>
                    }
                    emptyIcon={Truck}
                    emptyMessage="No shipments on the way"
                >
                    <ShipmentList />
                </DashboardSection>
            )}

            {/* Beginners guide */}
            {!capabilities?.has_network && <BeginnersGuide />}

            {/* Quick links grid */}
            <section className="px-4 md:px-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <QuickLinkCard
                        to="/app/overviews/cash-flow"
                        icon={Coins}
                        title="Revenues"
                    />
                    <QuickLinkCard
                        to="/app/overviews/power"
                        icon={Zap}
                        title="Power Production"
                    />
                    {capabilities?.has_storage && (
                        <QuickLinkCard
                            to="/app/overviews/storage"
                            icon={BatteryFull}
                            title="Stored Energy"
                        />
                    )}
                    {hasDiscoveredGreenhouse && (
                        <QuickLinkCard
                            to="/app/overviews/emissions"
                            icon={Leaf}
                            title="Emissions"
                        />
                    )}
                    {hasNetwork && (
                        <QuickLinkCard
                            to="/app/overviews/electricity-markets"
                            icon={TrendingUp}
                            title="Market Prices"
                        />
                    )}
                    {capabilities?.has_warehouse && (
                        <QuickLinkCard
                            to="/app/community/resource-market"
                            icon={Package}
                            title="Resource Market"
                        />
                    )}
                    <QuickLinkCard
                        to="/app/community/leaderboards"
                        icon={Trophy}
                        title="Leaderboards"
                    />
                    <DailyQuizButton />
                </div>
            </section>

            {/* Achievement progression */}
            <AchievementSection />
        </div>
    );
}

function BeginnersGuide() {
    return (
        <PageCard>
            <CardHeader>
                <CardTitle>Beginners guide</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 text-base">
                    <p>Welcome to Energetica!</p>
                    <p>
                        You begin your journey with <b>1 steam engine</b> and a
                        small <b>industry</b>, generating revenues. You can
                        monitor their{" "}
                        <Link
                            to="/app/overviews/power"
                            className="text-info underline hover:opacity-80"
                        >
                            power generation and consumption
                        </Link>{" "}
                        as well as your{" "}
                        <Link
                            to="/app/overviews/cash-flow"
                            className="text-info underline hover:opacity-80"
                        >
                            revenues
                        </Link>{" "}
                        under the <i>Production Overview</i> tab in the top
                        menu.
                    </p>
                    <p>
                        The first thing you will probably want to do is to{" "}
                        <b>expand your production</b> by investing in{" "}
                        <Link
                            to="/app/facilities/power"
                            className="text-info underline hover:opacity-80"
                        >
                            Power Facilities
                        </Link>{" "}
                        and upgrading your industry on the{" "}
                        <Link
                            to="/app/facilities/functional"
                            className="text-info underline hover:opacity-80"
                        >
                            Functional Facilities
                        </Link>{" "}
                        page. You also have access to{" "}
                        <Link
                            to="/app/facilities/storage"
                            className="text-info underline hover:opacity-80"
                        >
                            Storage Facilities
                        </Link>{" "}
                        to store energy. You will unlock new technologies and
                        more game mechanics as you progress.
                    </p>
                    <p>
                        Engage with other players via the <i>Community</i> tab.
                    </p>
                    <p>
                        If you are lost, click on the{" "}
                        <HelpCircle className="inline w-4 h-4" /> icon on the
                        right side of the title, you will find explanations
                        about the content of the page. For detailed explanations
                        on any game mechanics, consult the{" "}
                        <a
                            href="/wiki/introduction"
                            className="text-info underline hover:opacity-80"
                        >
                            wiki
                        </a>
                        .
                    </p>
                    <p>Best of luck in your energy adventure!</p>
                </div>
            </CardContent>
        </PageCard>
    );
}

function AchievementSection() {
    const { data: achievementsData, isLoading, isError } = useAchievements();

    return (
        <PageCard>
            <CardHeader>
                <CardTitle className="mb-4">
                    <Trophy className="inline w-6 h-6 mr-2" />
                    Achievement Progression
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center text-gray-500 py-4">
                        Loading achievements...
                    </div>
                ) : isError ? (
                    <div className="text-center text-destructive py-4">
                        Failed to load achievements
                    </div>
                ) : achievementsData?.achievements &&
                  achievementsData.achievements.length > 0 ? (
                    <div className="space-y-3">
                        {achievementsData.achievements.map((achievement) => (
                            <AchievementCard
                                key={achievement.id}
                                {...achievement}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-4">
                        No upcoming achievements
                    </div>
                )}
            </CardContent>
        </PageCard>
    );
}
