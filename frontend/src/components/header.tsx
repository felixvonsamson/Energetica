import { Link } from "@tanstack/react-router";

import Logo from "@/assets/icon.svg?react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TypographyBrand } from "@/components/ui/typography";

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
                        className="-m-1.5 p-1.5 flex items-center gap-2"
                    >
                        <Logo className="size-12 fill-foreground" />
                        <TypographyBrand className="text-3xl text-foreground">
                            Energetica
                        </TypographyBrand>
                    </Link>
                </div>
                <div className="flex gap-x-8">
                    <Link
                        to="/landing-page"
                        className="text-md font-semibold text-foreground hover:opacity-70 transition-opacity"
                    >
                        The Game
                    </Link>
                    <Link
                        to="/for-educators"
                        className="text-md font-semibold text-foreground hover:opacity-70 transition-opacity"
                    >
                        For Educators
                    </Link>
                    <Link
                        to="/about"
                        className="text-md font-semibold text-foreground hover:opacity-70 transition-opacity"
                    >
                        The Project
                    </Link>
                </div>
                <div className="flex flex-1 justify-end gap-3 items-center">
                    <ThemeToggle />
                    <Link
                        to="/app/login"
                        className="bg-primary text-primary-foreground px-6 py-2 rounded-4xl text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-md hover:shadow-lg"
                    >
                        Log In
                    </Link>
                </div>
            </nav>
        </header>
    );
}
