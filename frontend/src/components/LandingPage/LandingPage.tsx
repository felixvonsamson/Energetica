export function LandingPage() {
    return (
        <div className="min-h-screen bg-tan-green">
            {/* Announcement Banner */}
            <div
                className="text-center py-3 px-4"
                style={{ backgroundColor: "#BBB5CF" }}
            >
                <a href="#" className="text-[#5636C2] underline text-sm">
                    Announcing the release of the EnergySimEngine v0.1.12. See
                    what&apos;s new →
                </a>
            </div>
            <div className="px-64">
                <header className="relative z-50">
                    <nav
                        aria-label="Global"
                        className="flex items-center justify-between px-6 py-8 lg:px-8"
                    >
                        <div className="flex lg:flex-1">
                            <a
                                href="#"
                                className="-m-1.5 p-1.5 flex items-center"
                            >
                                <span className="text-3xl font-bold text-gray-800">
                                    Energetica
                                </span>
                            </a>
                        </div>
                        <div className="flex lg:hidden">
                            <button
                                type="button"
                                className="-m-2.5 inline-flex items-center justify-center rounded-4xl p-2.5 text-gray-800"
                            >
                                <span className="sr-only">Open main menu</span>
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    data-slot="icon"
                                    aria-hidden="true"
                                    className="size-6"
                                >
                                    <path
                                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className="hidden lg:flex lg:gap-x-8">
                            <a
                                href="#"
                                className="text-md font-semibold text-gray-800 hover:text-gray-700"
                            >
                                Mission
                            </a>
                            <a
                                href="#"
                                className="text-md font-semibold text-gray-800 hover:text-gray-700"
                            >
                                Features
                            </a>
                            <a
                                href="#"
                                className="text-md font-semibold text-gray-800 hover:text-gray-700"
                            >
                                Docs
                            </a>
                            <a
                                href="#"
                                className="text-md font-semibold text-gray-800 hover:text-gray-700"
                            >
                                Roadmap
                            </a>
                        </div>
                        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
                            <a
                                href="#"
                                className="bg-gray-800 text-light-green px-6 py-2 rounded-4xl text-sm font-semibold hover:bg-gray-700"
                            >
                                Log In
                            </a>
                        </div>
                    </nav>
                </header>

                {/* Main Content */}
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
                                company navigating profitability, grid
                                stability, and decarbonization.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
