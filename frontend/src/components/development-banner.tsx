import { InfoBanner } from "@/components/ui";

export function DevelopmentBanner() {
    return (
        <InfoBanner>
            <div>
                <p>Energetica is in active development!</p>
                <ul>
                    <li>
                        Join the{" "}
                        <a href="https://chat.whatsapp.com/ILiTJvsOMb2K6ZvRi1WCOn">
                            WhatsApp Community
                        </a>{" "}
                        for updates and discussion
                    </li>
                    <li>
                        <a href="https://github.com/felixvonsamson/Energetica">
                            Report bugs and follow development on GitHub
                        </a>
                    </li>
                    <li>
                        Questions? Email{" "}
                        <a href="mailto:felixvonsamson@gmail.com">
                            felixvonsamson@gmail.com
                        </a>
                    </li>
                </ul>
            </div>
        </InfoBanner>
    );
}
