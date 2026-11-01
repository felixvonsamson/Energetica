import { Link } from "@tanstack/react-router";

import { CONTACT_EMAIL } from "@/lib/contact";
import { navLinks } from "@/lib/nav-links";

const linkClass = "text-foreground hover:opacity-70 transition-opacity";

export function Footer() {
    return (
        <footer className="bg-card min-h-20 shadow-xl flex flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 py-4 mt-12">
            {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className={linkClass}>
                    {link.label}
                </Link>
            ))}
            <Link to="/wiki/introduction" className={linkClass}>
                Wiki
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                Contact
            </a>
            <a
                href="https://github.com/felixvonsamson/Energetica"
                className={linkClass}
            >
                GitHub
            </a>
        </footer>
    );
}
