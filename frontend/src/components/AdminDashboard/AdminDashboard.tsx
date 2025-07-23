import { Outlet } from "@tanstack/react-router";
import NavBar from "../NavBar/NavBar";
import styles from "./AdminDashboard.module.css"

export function AdminDashboardLayout() {
    return (
        <div className={styles.layout}>
            <NavBar />
            <main className="p-4">
                <Outlet />
            </main>
        </div>
    )
}
