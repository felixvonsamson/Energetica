import { useEffect } from "react";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export function HomeLayout({ children }: { children: React.ReactNode }) {
    useFooterColouredOverscroll();

    return (
        <div className="min-h-dvh flex flex-col bg-background">
            <div className="lg:px-[15%] flex-1">
                <Header />
                <div className="flex-1">{children}</div>
            </div>
            <Footer />
        </div>
    );
}

/**
 * Browsers fill the area exposed by overscrolling ("rubber-banding") with a
 * single colour taken from the html and body background colours, and draw no
 * page content there. To show the footer's colour when bouncing past the bottom
 * but the page's green when bouncing past the top, mark the root while the page
 * is scrolled past its halfway point. A bottom bounce can only happen below
 * that point and a top bounce only above it. iOS Safari also tints its bottom
 * toolbar from this colour. The matching styles are in `styles.css`.
 *
 * Switching at the halfway point, rather than when the footer appears, keeps
 * the colour change well away from either edge. Otherwise iOS visibly repaints
 * the background as the footer scrolls into view.
 */
function useFooterColouredOverscroll() {
    useEffect(() => {
        const root = document.documentElement;
        const update = () => {
            const maxScroll = root.scrollHeight - window.innerHeight;
            const pastHalfway = maxScroll > 0 && window.scrollY > maxScroll / 2;
            if (pastHalfway !== root.hasAttribute("data-at-page-end")) {
                root.toggleAttribute("data-at-page-end", pastHalfway);
            }
        };
        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
            root.removeAttribute("data-at-page-end");
        };
    }, []);
}
