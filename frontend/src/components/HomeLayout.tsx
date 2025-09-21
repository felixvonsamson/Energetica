import { Footer } from "./Footer";
import { Header } from "./Header";

export function HomeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-tan-green">
            <div className="overflow-y-scroll h-screen">
                <div className="min-h-screen flex flex-col">
                    <div className="md:px-[15%] flex-1">
                        <Header />
                        <div className="flex-1">{children}</div>
                    </div>
                    <Footer />
                </div>
            </div>
        </div>
    );
}
