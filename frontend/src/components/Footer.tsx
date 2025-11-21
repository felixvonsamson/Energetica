import { Link } from "@tanstack/react-router";

export function Footer() {
    return (
        <footer className="bg-bone dark:bg-dark-bg-secondary h-20 shadow-xl flex flex-row items-center justify-center gap-5 mt-12">
            <Link to={"/landing-page"} className="text-bone-text dark:text-dark-text-primary hover:opacity-80">The Game</Link>
            <Link to={"/learning-tool"} className="text-bone-text dark:text-dark-text-primary hover:opacity-80">Learning Through Play</Link>
            <Link to={"/about"} className="text-bone-text dark:text-dark-text-primary hover:opacity-80">About</Link>
            <a href="https://github.com/felixvonsamson/Energetica" className="text-bone-text dark:text-dark-text-primary hover:opacity-80">Github</a>
        </footer>
    );
}
