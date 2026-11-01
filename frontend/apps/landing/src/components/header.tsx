import { lobbyHref } from "@energetica/core/instances";
import Logo from "@energetica/ui/assets/simplified_logo.svg?react";
import { Button } from "@energetica/ui/components/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
    SheetTrigger,
} from "@energetica/ui/components/sheet";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";
import { TypographyBrand } from "@energetica/ui/components/typography";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";

import { navLinks } from "@/lib/nav-links";

const loginButtonClass =
    "bg-primary text-primary-foreground px-6 py-2 rounded-4xl text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-md hover:shadow-lg";

/** The links marked as the current page. The home page must match exactly. */
function NavLink({
    to,
    label,
    className,
    onClick,
}: {
    to: string;
    label: string;
    className: string;
    onClick?: () => void;
}) {
    return (
        <Link
            to={to}
            activeOptions={{ exact: to === "/" }}
            onClick={onClick}
            className={`${className} aria-[current=page]:underline underline-offset-8 decoration-2`}
        >
            {label}
        </Link>
    );
}

/** The menu below the `xl` width, where the links no longer fit on one line. */
function MobileMenu() {
    const [open, setOpen] = useState(false);
    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="Open menu"
                    className="xl:hidden"
                >
                    <Menu />
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="gap-6 p-6">
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription className="sr-only">
                    The main pages of the Energetica site.
                </SheetDescription>
                <nav aria-label="Menu" className="flex flex-col gap-5">
                    {navLinks.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            label={link.label}
                            className="text-lg font-semibold text-foreground w-fit"
                            onClick={() => setOpen(false)}
                        />
                    ))}
                </nav>
                <a
                    href={lobbyHref("/login")}
                    className={`${loginButtonClass} text-center`}
                >
                    Log In
                </a>
            </SheetContent>
        </Sheet>
    );
}

export function Header() {
    return (
        <header className="relative z-50">
            <nav
                aria-label="Global"
                className="flex items-center justify-between gap-4 px-6 py-8 lg:px-8"
            >
                <div className="flex xl:flex-1">
                    <Link
                        to="/"
                        className="-m-1.5 p-1.5 flex items-center gap-2"
                    >
                        <Logo className="size-12 fill-foreground" />
                        <TypographyBrand className="text-3xl text-foreground">
                            Energetica
                        </TypographyBrand>
                    </Link>
                </div>
                <div className="hidden xl:flex gap-x-8">
                    {navLinks.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            label={link.label}
                            className="text-md font-semibold text-foreground whitespace-nowrap hover:opacity-70 transition-opacity"
                        />
                    ))}
                </div>
                <div className="flex xl:flex-1 justify-end gap-3 items-center">
                    <ThemeToggle />
                    {/* Cross-bundle navigation: landing → the lobby, which owns
                        login and the run picker (ADR-0002). Uses <a href> (a real
                        cross-origin nav) so TanStack Router — which has no lobby
                        routes in the landing bundle — doesn't intercept the click. */}
                    <a
                        href={lobbyHref("/login")}
                        className={`${loginButtonClass} hidden sm:block whitespace-nowrap`}
                    >
                        Log In
                    </a>
                    <MobileMenu />
                </div>
            </nav>
        </header>
    );
}
