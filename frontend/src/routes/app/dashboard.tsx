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
} from "lucide-react";

import { AchievementCard } from "@/components/dashboard/AchievementCard";
import { ConstructionProjects } from "@/components/dashboard/ConstructionProjects";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { IncomingShipments } from "@/components/dashboard/IncomingShipments";
import { QuickLinkCard } from "@/components/dashboard/QuickLinkCard";
import { ResearchProjects } from "@/components/dashboard/ResearchProjects";
import { GameLayout } from "@/components/layout/GameLayout";
import { InfoBanner, Card, CardTitle } from "@/components/ui";
import { useAchievements } from "@/hooks/useAchievements";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useDailyQuiz, useSubmitQuizAnswer } from "@/hooks/useDailyQuiz";
import { useWeather } from "@/hooks/useWeather";
import { getMonthName } from "@/lib/date-utils";

export const Route = createFileRoute("/app/dashboard")({
    component: DashboardPage,
    staticData: {
        title: "Dashboard",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
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
                    <Thermometer className="w-4 h-4 flex-shrink-0" />
                    <span>
                        Current weather conditions and the in-game season
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Construction className="w-4 h-4 flex-shrink-0" />
                    <span>Ongoing or planned construction projects</span>
                </li>
                <li className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 flex-shrink-0" />
                    <span>Ongoing or planned research projects</span>
                </li>
                <li className="flex items-center gap-2">
                    <Truck className="w-4 h-4 flex-shrink-0" />
                    <span>Ongoing shipments</span>
                </li>
                <li className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 flex-shrink-0" />
                    <span>Quick links to the most important pages</span>
                </li>
                <li className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 flex-shrink-0" />
                    <span>Progression information about achievements</span>
                </li>
                <li className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>Daily quiz to win xp</span>
                </li>
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

    // TODO: Fetch real data from API for these non-capability flags
    const hasDiscoveredGreenhouse = true;
    const hasNetwork = false;

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Dashboard
                </h1>
            </div>

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
                    <ConstructionProjects showActions={true} />
                </DashboardSection>

                {/* Under research - only show if player has laboratory */}
                {capabilities?.has_laboratory && (
                    <DashboardSection
                        title="🔬 Under Research"
                        emptyIcon={FlaskConical}
                        emptyMessage="No technologies under research"
                    >
                        <ResearchProjects showActions={true} />
                    </DashboardSection>
                )}

                {/* Shipments - only show if player has warehouse */}
                {capabilities?.has_warehouse && (
                    <DashboardSection
                        title="🚚 Shipments"
                        emptyIcon={Truck}
                        emptyMessage="No shipments on the way"
                    >
                        <IncomingShipments />
                    </DashboardSection>
                )}
            </div>

            {/* Beginners guide */}
            {!capabilities?.has_network && <BeginnersGuide />}

            {/* Quick links grid */}
            <section className="mb-6">
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
                            to="/app/community/electricity-markets"
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
                </div>
            </section>

            {/* Achievement progression */}
            <AchievementSection />

            {/* Daily quiz */}
            <DailyQuizSection />
        </div>
    );
}

function WeatherSection() {
    const {
        data: weatherData,
        isLoading: isWeatherLoading,
        isError: isWeatherError,
    } = useWeather();

    return (
        <section className="mb-6">
            <Card>
                <CardTitle className="text-center mb-4">
                    Current weather conditions
                </CardTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                    {isWeatherLoading && !weatherData ? (
                        <div className="col-span-full text-center text-gray-500">
                            Loading...
                        </div>
                    ) : isWeatherError ? (
                        <div className="col-span-full text-center text-alert-red">
                            Failed to load weather data
                        </div>
                    ) : weatherData ? (
                        <>
                            {/* Month with year progress indicator */}
                            <div className="px-2">
                                <div className="mb-2 whitespace-nowrap">
                                    Month:{" "}
                                    <b>
                                        {getMonthName(weatherData.month_number)}
                                    </b>
                                </div>
                                <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full">
                                    {/* Current date dot indicator */}
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-pine dark:bg-brand-green rounded-full"
                                        style={{
                                            left: `calc(${weatherData.year_progress * 100}%)`,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Solar Irradiance with visual bar */}
                            <div className="px-2">
                                <div className="mb-2 whitespace-nowrap">
                                    Irradiance:{" "}
                                    <b>
                                        {Math.round(
                                            weatherData.solar_irradiance,
                                        )}{" "}
                                        W/m²
                                    </b>
                                </div>
                                <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-yellow-500 dark:bg-yellow-400 transition-all duration-300"
                                        style={{
                                            width: `${Math.min(100, (weatherData.solar_irradiance / 1000) * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Wind Speed with visual bar */}
                            <div className="px-2">
                                <div className="mb-2 whitespace-nowrap">
                                    Wind speed:{" "}
                                    <b>
                                        {Math.round(weatherData.wind_speed)}{" "}
                                        km/h
                                    </b>
                                </div>
                                <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-cyan-500 dark:bg-cyan-400 transition-all duration-300"
                                        style={{
                                            width: `${Math.min(100, (weatherData.wind_speed / 60) * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* River Discharge with visual bar */}
                            <div className="px-2">
                                <div className="mb-2 whitespace-nowrap">
                                    River discharge:{" "}
                                    <b>
                                        {Math.round(
                                            weatherData.river_discharge,
                                        )}{" "}
                                        m³/s
                                    </b>
                                </div>
                                <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300"
                                        style={{
                                            width: `${Math.min(100, (weatherData.river_discharge / 150) * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </Card>
        </section>
    );
}

function BeginnersGuide() {
    return (
        <section className="mb-6">
            <Card className="border-2 border-pine dark:border-dark-border">
                <CardTitle className="mb-4">Beginners guide</CardTitle>
                <div className="space-y-4 text-base">
                    <p>Welcome to Energetica!</p>
                    <p>
                        You begin your journey with <b>1 steam engine</b> and a
                        small <b>industry</b>, generating revenues. You can
                        monitor their{" "}
                        <Link
                            to="/app/overviews/power"
                            className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                        >
                            power generation and consumption
                        </Link>{" "}
                        as well as your{" "}
                        <Link
                            to="/app/overviews/cash-flow"
                            className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
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
                            className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                        >
                            Power Facilities
                        </Link>{" "}
                        and upgrading your industry on the{" "}
                        <Link
                            to="/app/facilities/functional"
                            className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                        >
                            Functional Facilities
                        </Link>{" "}
                        page. You also have access to{" "}
                        <Link
                            to="/app/facilities/storage"
                            className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
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
                            className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                        >
                            wiki
                        </a>
                        .
                    </p>
                    <p>Best of luck in your energy adventure!</p>
                </div>
            </Card>
        </section>
    );
}

function AchievementSection() {
    const { data: achievementsData, isLoading, isError } = useAchievements();

    return (
        <section className="mb-6">
            <Card>
                <CardTitle className="mb-4">
                    <Trophy className="inline w-6 h-6 mr-2" />
                    Achievement Progression
                </CardTitle>

                {isLoading ? (
                    <div className="text-center text-gray-500 py-4">
                        Loading achievements...
                    </div>
                ) : isError ? (
                    <div className="text-center text-red-600 dark:text-red-400 py-4">
                        Failed to load achievements
                    </div>
                ) : achievementsData?.achievements &&
                  achievementsData.achievements.length > 0 ? (
                    <div className="space-y-3">
                        {achievementsData.achievements.map(
                            (achievement: {
                                id: string;
                                name: string;
                                status: number;
                                objective: number;
                                reward: number;
                            }) => (
                                <AchievementCard
                                    key={achievement.id}
                                    id={achievement.id}
                                    name={achievement.name}
                                    status={achievement.status}
                                    objective={achievement.objective}
                                    reward={achievement.reward}
                                />
                            ),
                        )}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-4">
                        No upcoming achievements
                    </div>
                )}
            </Card>
        </section>
    );
}

function DailyQuizSection() {
    // TODO: correctly answering the daily quiz earns the player 1 XP point. This is not communicated in the new UI
    const { data: quizData, isLoading, isError } = useDailyQuiz();
    const { mutate: submitAnswer, isPending } = useSubmitQuizAnswer();

    const handleAnswerClick = (answer: "answer1" | "answer2" | "answer3") => {
        if (!quizData || quizData.player_answer) return; // Already answered
        submitAnswer(answer);
    };

    const hasAnswered =
        quizData?.player_answer !== undefined &&
        quizData?.player_answer !== null;

    // Helper to determine if an answer is correct
    const isCorrectAnswer = (answer: "answer1" | "answer2" | "answer3") => {
        if (!quizData?.correct_answer) return false;
        return (
            quizData.correct_answer === answer ||
            quizData.correct_answer === "all correct"
        );
    };

    // Helper to get button styling based on state
    const getButtonClass = (answer: "answer1" | "answer2" | "answer3") => {
        const baseClass =
            "w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 ease-out relative";

        if (!hasAnswered) {
            // Before answering - normal clickable button
            return `${baseClass} bg-bone dark:bg-dark-bg-secondary border-2 border-pine dark:border-dark-border hover:border-brand-green dark:hover:border-brand-green hover:shadow-md text-primary disabled:opacity-50 disabled:cursor-not-allowed`;
        }

        // After answering - show feedback
        const isCorrect = isCorrectAnswer(answer);
        const wasSelected = quizData.player_answer === answer;

        if (wasSelected && isCorrect) {
            // User selected correct answer
            return `${baseClass} bg-green-50 dark:bg-green-900/20 border-2 border-green-600 dark:border-green-500 text-green-800 dark:text-green-300 cursor-default`;
        } else if (wasSelected && !isCorrect) {
            // User selected wrong answer
            return `${baseClass} bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-400 text-red-800 dark:text-red-300 cursor-default`;
        } else if (isCorrect) {
            // Correct answer (not selected)
            return `${baseClass} bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-400 text-green-800 dark:text-green-300 cursor-default`;
        } else {
            // Incorrect answer (not selected)
            return `${baseClass} bg-bone dark:bg-dark-bg-secondary border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 cursor-default opacity-60`;
        }
    };

    // Helper to render answer icon/indicator
    const getAnswerIndicator = (answer: "answer1" | "answer2" | "answer3") => {
        if (!hasAnswered) return null;

        const isCorrect = isCorrectAnswer(answer);
        const wasSelected = quizData.player_answer === answer;

        if (wasSelected && isCorrect) {
            return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400 font-bold">
                    ✓ Your answer
                </span>
            );
        } else if (wasSelected && !isCorrect) {
            return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600 dark:text-red-400 font-bold">
                    ✗ Your answer
                </span>
            );
        } else if (isCorrect) {
            return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400 font-bold">
                    ✓ Correct
                </span>
            );
        }
        return null;
    };

    return (
        <section className="mb-6">
            <div className="flex justify-center">
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

                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center text-gray-500">
                                Loading quiz question...
                            </div>
                        ) : isError ? (
                            <div className="text-center text-alert-red">
                                Failed to load quiz question
                            </div>
                        ) : quizData ? (
                            <>
                                {/* Question */}
                                <p className="text-lg text-center mb-4">
                                    {quizData.question}
                                </p>

                                {/* Answer Buttons */}
                                <div className="space-y-3">
                                    <button
                                        onClick={() =>
                                            handleAnswerClick("answer1")
                                        }
                                        disabled={hasAnswered || isPending}
                                        className={getButtonClass("answer1")}
                                    >
                                        <span className="block pr-24">
                                            {quizData.answer1}
                                        </span>
                                        {getAnswerIndicator("answer1")}
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleAnswerClick("answer2")
                                        }
                                        disabled={hasAnswered || isPending}
                                        className={getButtonClass("answer2")}
                                    >
                                        <span className="block pr-24">
                                            {quizData.answer2}
                                        </span>
                                        {getAnswerIndicator("answer2")}
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleAnswerClick("answer3")
                                        }
                                        disabled={hasAnswered || isPending}
                                        className={getButtonClass("answer3")}
                                    >
                                        <span className="block pr-24">
                                            {quizData.answer3}
                                        </span>
                                        {getAnswerIndicator("answer3")}
                                    </button>
                                </div>

                                {/* Explanation and Learn More (only shown after answering) */}
                                {hasAnswered && quizData.explanation && (
                                    <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                                        <p className="text-center mb-3">
                                            {quizData.explanation}
                                        </p>
                                        {quizData.learn_more_link && (
                                            <p className="text-center">
                                                <a
                                                    href={
                                                        quizData.learn_more_link
                                                    }
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                                                >
                                                    Learn more
                                                </a>
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Submitting state */}
                                {isPending && (
                                    <p className="text-center text-gray-500 text-sm">
                                        Submitting answer...
                                    </p>
                                )}
                            </>
                        ) : null}
                    </div>
                </Card>
            </div>
        </section>
    );
}
