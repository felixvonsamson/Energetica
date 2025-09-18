import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { AdminDashboardLayout } from "../../components/AdminDashboard/AdminDashboard";

export const Route = createFileRoute("/admin-dashboard")({
    loader: ({ location }) => {
        // Redirect only if it's exactly /admin-dashboard
        if (location.pathname.replace(/\/+$/, "") === "/admin-dashboard") {
            throw redirect({ to: "/admin-dashboard/players" });
        }
    },
    staticData: {
        title: "Dashboard",
    },
    component: AdminDashboardLayout,
});
