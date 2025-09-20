import { Link } from "@tanstack/react-router";

export function Header() {
    return (
        <header className="relative z-50">
            <nav
                aria-label="Global"
                className="flex items-center justify-between px-6 py-8 lg:px-8"
            >
                <div className="flex lg:flex-1">
                    <Link
                        to="/landing-page"
                        className="-m-1.5 p-1.5 flex items-center"
                    >
                        <span className="text-3xl font-bold text-gray-800">
                            Energetica
                        </span>
                    </Link>
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
                <header>
                    <div className="hidden lg:flex lg:gap-x-8">
                        <Link
                            to={"/landing-page"}
                            className="text-md font-semibold text-gray-800 hover:text-gray-700"
                        >
                            Mission
                        </Link>
                        <Link
                            to="/learning-tool"
                            className="text-md font-semibold text-gray-800 hover:text-gray-700"
                        >
                            Learning Tool
                        </Link>
                        <Link
                            to="/about"
                            className="text-md font-semibold text-gray-800 hover:text-gray-700"
                        >
                            About
                        </Link>
                    </div>
                </header>
                <div className="hidden lg:flex lg:flex-1 lg:justify-end">
                    <a
                        href="/login"
                        className="bg-gray-800 text-light-green px-6 py-2 rounded-4xl text-sm font-semibold hover:bg-gray-700"
                    >
                        Log In
                    </a>
                </div>
            </nav>
        </header>
    );
}
