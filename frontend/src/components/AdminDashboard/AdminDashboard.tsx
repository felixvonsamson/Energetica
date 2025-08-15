import { Outlet, useMatches, useRouteContext, useRouter } from "@tanstack/react-router";
import { useMatchRoute } from "@tanstack/react-router";

import NavBar from "../NavBar/NavBar";
import styles from "./AdminDashboard.module.css"

export function AdminDashboardLayout() {
    const matches = useMatches()

    const currentMatch = matches[matches.length - 1]
    const { title = 'Dashboard' } = currentMatch?.staticData || {}

    return (
        <div className={styles["navbar-container-layout"]}>
            <NavBar />
            <main>
                <div className={styles["topbar-container-layout"]}>
                    <div className={styles["topbar"]}>
                        <h1>
                            {title}
                        </h1>
                    </div>
                    <div className={styles["content-container"]}>
                        <Outlet />
                    </div>
                </div>
            </main >
        </div >
    )
}
