import { Footer } from "./Footer";
import { Header } from "./Header";
import { ThemeToggle } from "./ui/ThemeToggle";

export function HomeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-tan-green dark:bg-dark-bg-primary">
            {/* Theme toggle - top right */}
            <div className="fixed top-4 right-4 z-50">
                <div className="bg-bone dark:bg-dark-bg-secondary p-2 rounded-lg">
                    <ThemeToggle />
                </div>
            </div>

            <div className="overflow-y-scroll h-screen">
                <div className="min-h-screen flex flex-col">
                    <div className="lg:px-[15%] flex-1">
                        <Header />
                        <div className="flex-1">{children}</div>
                    </div>
                    <Footer />
                </div>
            </div>
        </div>
    );
}
