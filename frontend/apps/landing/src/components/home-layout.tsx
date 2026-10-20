import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export function HomeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background">
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
