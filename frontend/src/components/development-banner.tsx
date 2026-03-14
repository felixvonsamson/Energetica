import { InfoBanner } from "@/components/ui";

export function DevelopmentBanner() {
    return (
        <InfoBanner>
            <div>
                <p>Energetica is in active development!</p>
                <ul>
                    <li>
                        Join the{" "}
                        <a
                            href="https://chat.whatsapp.com/ILiTJvsOMb2K6ZvRi1WCOn"
                            className="underline font-medium hover:opacity-70"
                        >
                            WhatsApp Community
                        </a>{" "}
                        for updates and discussion
                    </li>
                    <li>
                        <a
                            href="https://github.com/felixvonsamson/Energetica"
                            className="underline font-medium hover:opacity-70"
                        >
                            Report bugs and follow development on GitHub
                        </a>
                    </li>
                    <li>
                        Questions? Email{" "}
                        <a
                            href="mailto:energetica.game@gmail.com"
                            className="underline font-medium hover:opacity-70"
                        >
                            energetica.game@gmail.com
                        </a>
                    </li>
                </ul>
            </div>
        </InfoBanner>
    );
}
