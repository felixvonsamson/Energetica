import { Link } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/ui/theme-toggle";

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
                        <span className="text-3xl font-bold text-foreground">
                            Energetica
                        </span>
                    </Link>
                </div>
                <header>
                    <div className="flex gap-x-8">
                        <Link
                            to={"/landing-page"}
                            className="text-md font-semibold text-foreground hover:opacity-80"
                        >
                            The Game
                        </Link>
                        <Link
                            to="/learning-tool"
                            className="text-md font-semibold text-foreground hover:opacity-80"
                        >
                            Learning Through Play
                        </Link>
                        <Link
                            to="/about"
                            className="text-md font-semibold text-foreground hover:opacity-80"
                        >
                            About
                        </Link>
                    </div>
                </header>
                <div className="flex flex-1 justify-end gap-3 items-center">
                    <ThemeToggle />
                    <Link
                        to="/app/login"
                        className="bg-primary text-primary-foreground px-6 py-2 rounded-4xl text-sm font-semibold hover:bg-pine-darker shadow-md hover:shadow-lg transition-shadow"
                    >
                        Log In
                    </Link>
                </div>
            </nav>
        </header>
    );
}
