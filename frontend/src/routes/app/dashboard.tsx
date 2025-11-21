import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
    Construction,
    FlaskConical,
    Truck,
    DollarSign,
    Zap,
    Battery,
    Leaf,
    TrendingUp,
    Package,
    Trophy,
    HelpCircle,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Modal, InfoBanner, Card, CardTitle } from "@/components/ui";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { QuickLinkCard } from "@/components/dashboard/QuickLinkCard";
import { AchievementCard } from "@/components/dashboard/AchievementCard";

export const Route = createFileRoute("/app/dashboard")({
    component: DashboardPage,
    staticData: {
        title: "Dashboard",
    },
});

function DashboardPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <DashboardContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function DashboardContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);

    // TODO: Fetch real data from API
    const hasNetworkAchievement = false;
    const hasStorageAchievement = true;
    const hasWarehouseAchievement = true;
    const hasDiscoveredGreenhouse = true;
    const hasNetwork = false;

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Dashboard
                </h1>
                <button
                    onClick={() => setShowInfoPopup(true)}
                    className="text-primary hover:opacity-80 transition-opacity"
                    aria-label="Show help"
                >
                    <HelpCircle className="w-8 h-8" />
                </button>
            </div>

            {/* Info modal */}
            <Modal
                isOpen={showInfoPopup}
                onClose={() => setShowInfoPopup(false)}
                title="Help : Dashboard"
            >
                <div className="space-y-3">
                    <p>This is the dashboard of your account. Here you will find:</p>
                    <ul className="list-none space-y-1 ml-4">
                        <li>🌡️ Current weather conditions and the in-game season</li>
                        <li>🏗️ Ongoing or planned construction projects</li>
                        <li>🔬 Ongoing or planned research projects</li>
                        <li>🚚 Ongoing shipments</li>
                        <li>🔗 Quick links to the most important pages</li>
                        <li>🏆 Progression information about achievements</li>
                        <li>📅 Daily quiz to win xp</li>
                    </ul>
                    <p>
                        For more info about in-game time and weather, see the{" "}
                        <a
                            href="/wiki/time_and_weather"
                            className="underline hover:opacity-80 text-white dark:text-dark-text-primary"
                        >
                            wiki
                        </a>
                        .
                    </p>
                </div>
            </Modal>

            {/* Development info banner */}
            <InfoBanner variant="info" className="mb-6">
                🚧 This game is still under development! 🚧 Join the{" "}
                <img
                    src="/static/images/icons/WhatsApp.svg"
                    className="inline w-4 h-4"
                    alt="WhatsApp"
                />
                <a
                    href="https://chat.whatsapp.com/ILiTJvsOMb2K6ZvRi1WCOn"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:opacity-80"
                >
                    {" "}
                    Energetica Community
                </a>{" "}
                to stay updated with the latest news, report bugs, and engage
                with the community. You can also contact me directly
                (felixvonsamson@gmail.com)
            </InfoBanner>

            {/* Weather section */}
            <WeatherSection />

            {/* Construction, Research, Shipments */}
            <div className="space-y-6 mb-6">
                <DashboardSection
                    title="🏗️ Under Construction"
                    emptyIcon={Construction}
                    emptyMessage="No facilities under construction"
                >
                    {/* TODO: Fetch from API */}
                </DashboardSection>

                <DashboardSection
                    title="🔬 Under Research"
                    emptyIcon={FlaskConical}
                    emptyMessage="No technologies under research"
                >
                    {/* TODO: Fetch from API */}
                </DashboardSection>

                <DashboardSection
                    title="🚚 Shipments"
                    emptyIcon={Truck}
                    emptyMessage="No shipments on the way"
                >
                    {/* TODO: Fetch from API */}
                </DashboardSection>
            </div>

            {/* Beginners guide */}
            {!hasNetworkAchievement && <BeginnersGuide />}

            {/* Quick links grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                <QuickLinkCard
                    href="/app/overviews/revenues"
                    icon={DollarSign}
                    title="Revenues"
                />
                <QuickLinkCard
                    href="/app/overviews/electricity"
                    icon={Zap}
                    title="Power Production"
                />
                {hasStorageAchievement && (
                    <QuickLinkCard
                        href="/app/overviews/storage"
                        icon={Battery}
                        title="Stored Energy"
                    />
                )}
                {hasDiscoveredGreenhouse && (
                    <QuickLinkCard
                        href="/app/overviews/emissions"
                        icon={Leaf}
                        title="Emissions"
                    />
                )}
                {hasNetwork && (
                    <QuickLinkCard
                        href="/app/community/network"
                        icon={TrendingUp}
                        title="Market Prices"
                    />
                )}
                {hasWarehouseAchievement && (
                    <QuickLinkCard
                        href="/app/resource-market"
                        icon={Package}
                        title="Resource Market"
                    />
                )}
                <QuickLinkCard
                    href="/app/community/scoreboard"
                    icon={Trophy}
                    title="Ranking"
                />
            </div>

            {/* Achievement progression */}
            <AchievementSection />

            {/* Daily quiz */}
            <DailyQuizSection />
        </div>
    );
}

function WeatherSection() {
    return (
        <Card className="mb-6">
            <CardTitle className="text-center mb-4">
                Current weather conditions
            </CardTitle>
            <div className="flex flex-wrap justify-around gap-4">
                {/* TODO: Fetch and display weather from API */}
                <div className="text-center">
                    <p className="text-lg">Season: Summer</p>
                    <p className="text-lg">Temperature: 25°C</p>
                </div>
            </div>
        </Card>
    );
}

function BeginnersGuide() {
    return (
        <Card className="mb-6 border-2 border-pine dark:border-dark-border">
            <CardTitle className="mb-4">Beginners guide</CardTitle>
            <div className="space-y-4 text-base">
                <p>Welcome to Energetica!</p>
                <p>
                    You begin your journey with <b>1 steam engine</b> and a
                    small <b>industry</b>, generating revenues. You can monitor
                    their{" "}
                    <a
                        href="/app/overviews/electricity"
                        className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                    >
                        power generation and consumption
                    </a>{" "}
                    as well as your{" "}
                    <a
                        href="/app/overviews/revenues"
                        className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                    >
                        revenues
                    </a>{" "}
                    under the <i>Production Overview</i> tab in the top menu.
                </p>
                <p>
                    The first thing you will probably want to do is to{" "}
                    <b>expand your production</b> by investing in{" "}
                    <a
                        href="/app/facilities/power"
                        className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                    >
                        Power Facilities
                    </a>{" "}
                    and upgrading your industry on the{" "}
                    <a
                        href="/app/facilities/functional"
                        className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                    >
                        Functional Facilities
                    </a>{" "}
                    page. You also have access to{" "}
                    <a
                        href="/app/facilities/storage"
                        className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                    >
                        Storage Facilities
                    </a>{" "}
                    to store energy. You will unlock new technologies and more
                    game mechanics as you progress.
                </p>
                <p>
                    Engage with other players via the <i>Community</i> tab.
                </p>
                <p>
                    If you are lost, click on the{" "}
                    <HelpCircle className="inline w-4 h-4" /> icon on the right
                    side of the title, you will find explanations about the
                    content of the page. For detailed explanations on any game
                    mechanics, consult the{" "}
                    <a
                        href="/wiki/introduction"
                        className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                    >
                        wiki
                    </a>
                    .
                </p>
                <p>Best of luck in your energy adventure!</p>
            </div>
        </Card>
    );
}

function AchievementSection() {
    // TODO: Fetch from API
    const achievements = [
        { name: "Power Producer", progress: 75 },
        { name: "Energy Tycoon", progress: 40 },
        { name: "Green Pioneer", progress: 20 },
    ];

    return (
        <Card className="mb-6">
            <CardTitle className="mb-4">
                <Trophy className="inline w-6 h-6 mr-2" />
                Achievement Progression
            </CardTitle>
            <div className="space-y-3">
                {achievements.map((achievement) => (
                    <AchievementCard
                        key={achievement.name}
                        name={achievement.name}
                        progress={achievement.progress}
                    />
                ))}
            </div>
        </Card>
    );
}

function DailyQuizSection() {
    return (
        <div className="flex justify-center mb-8">
            <Card className="border-2 border-pine dark:border-dark-border max-w-2xl w-full">
                <CardTitle className="text-center mb-4">
                    <img
                        src="/static/images/icons/quiz.png"
                        className="inline w-6 h-6"
                        alt=""
                    />
                    <span className="mx-2">Daily Quiz</span>
                    <img
                        src="/static/images/icons/quiz.png"
                        className="inline w-6 h-6"
                        alt=""
                    />
                </CardTitle>
                <div className="text-center text-gray-600 dark:text-gray-400">
                    {/* TODO: Fetch and display daily quiz from API */}
                    <p>Loading quiz question...</p>
                </div>
            </Card>
        </div>
    );
}
