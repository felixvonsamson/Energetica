import {
    Outlet,
    useMatches,
    useRouteContext,
    useRouter,
} from "@tanstack/react-router";

import NavBar from "@components/NavBar/NavBar";
import styles from "./AdminDashboard.module.css";

export function AdminDashboardLayout() {
    const matches = useMatches();

    const currentMatch = matches[matches.length - 1];
    console.log(currentMatch);
    const { title = "Dashboard" } = currentMatch?.staticData || {};

    return (
        <div className={styles["navbar-container-layout"]}>
            <NavBar />
            <main>
                <div className={styles["topbar-container-layout"]}>
                    <div className={styles["topbar"]}>
                        <h1>{title}</h1>
                    </div>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
