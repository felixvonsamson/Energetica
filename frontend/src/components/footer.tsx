import { Link } from "@tanstack/react-router";

export function Footer() {
    return (
        <footer className="bg-card h-20 shadow-xl flex flex-row items-center justify-center gap-5 mt-12">
            <Link
                to="/landing-page"
                className="text-foreground hover:opacity-70 transition-opacity"
            >
                The Game
            </Link>
            <Link
                to="/for-educators"
                className="text-foreground hover:opacity-70 transition-opacity"
            >
                For Educators
            </Link>
            <Link
                to="/about"
                className="text-foreground hover:opacity-70 transition-opacity"
            >
                The Project
            </Link>
            <a
                href="https://github.com/felixvonsamson/Energetica"
                className="text-foreground hover:opacity-70 transition-opacity"
            >
                Github
            </a>
        </footer>
    );
}
