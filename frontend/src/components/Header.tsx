import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

export function Header() {
    return (
        <header className="relative z-50">
            <nav
                aria-label="Global"
                className="flex items-center justify-between px-6 py-8 lg:px-8"
            >
                <div className="flex flex-1">
                    <Link
                        to="/landing-page"
                        className="-m-1.5 p-1.5 flex items-center"
                    >
                        <span className="text-3xl font-bold text-gray-800">
                            Energetica
                        </span>
                    </Link>
                </div>
                <header>
                    <div className="flex gap-x-8">
                        <Link
                            to={"/landing-page"}
                            className="text-md font-semibold text-gray-800 hover:text-gray-700"
                        >
                            The Game
                        </Link>
                        <Link
                            to="/learning-tool"
                            className="text-md font-semibold text-gray-800 hover:text-gray-700"
                        >
                            Learning Through Play
                        </Link>
                        <Link
                            to="/about"
                            className="text-md font-semibold text-gray-800 hover:text-gray-700"
                        >
                            About
                        </Link>
                    </div>
                </header>
                <div className="flex flex-1 justify-end">
                    <a
                        href="/login"
                        className="bg-gray-800 text-light-green px-6 py-2 rounded-4xl text-sm font-semibold hover:bg-gray-700 shadow-md hover:shadow-lg"
                    >
                        Log In
                    </a>
                </div>
            </nav>
        </header>
    );
}
