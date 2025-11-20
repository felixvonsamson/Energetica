import OldNavBar from "./OldNavBar";
import RightSidebar from "./RightSidebar";
import PageContent from "./PageContent";

export default function PageLayout() {
    return (
        <>
            <GameLogo />
            <OldNavBar />
            <RightSidebar />
            <PageContent />
        </>
    );
}

function GameLogo() {
    return (
        <div className="logo_container flex-row">
            <img
                src="/static/images/icon.svg"
                className="logo small margin_left_7"
            />
            <span className="logo_txt topleft">Energetica</span>
        </div>
    );
}
