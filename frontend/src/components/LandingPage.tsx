import { Link } from "@tanstack/react-router";
import { Footer } from "./Footer";
import { HomeLayout } from "./HomeLayout";

export function LandingPage() {
    return (
        <HomeLayout>
            <div className="relative px-6 lg:px-8 ">
                {/* Background illustration */}
                <div className="absolute inset-0 mx-6 lg:mx-8 overflow-hidden rounded-4xl bg-pine">
                    {/* Rounded mask overlay */}
                </div>
                {/* Content overlay */}

                <div className="relative mx-auto max-w-4xl py-24 sm:py-32 lg:py-40">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-light-green sm:text-6xl lg:text-7xl leading-tight">
                            Play the future of the grid.
                            <br />
                            Understand the transition.
                            <br />
                            Build a cleaner world.
                        </h1>
                        <p className="mt-8 text-lg text-light-green sm:text-xl max-w-3xl mx-auto leading-relaxed">
                            Energetica is a free, open-source, real-time
                            simulation game where players operate an energy
                            company navigating profitability, grid stability,
                            and decarbonization.
                        </p>
                    </div>
                </div>
            </div>
        </HomeLayout>
    );
}
