import { Link } from "@tanstack/react-router";

export function Footer() {
    return (
        <footer className="bg-bone h-20 shadow-xl flex flex-row items-center justify-center gap-5 mt-12">
            <Link to={"/landing-page"}>Mission</Link>
            <Link to={"/learning-tool"}>Learning Tool</Link>
            <Link to={"/about"}>About</Link>
            <a href="https://github.com/felixvonsamson/Energetica">Github</a>
        </footer>
    );
}
