import { Outlet, createFileRoute, redirect, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard')({
    loader: ({ location }) => {
        // Redirect only if it's exactly /admin-dashboard
        if (location.pathname.replace(/\/+$/, '') === '/admin-dashboard') {
            throw redirect({ to: '/admin-dashboard/players' })
        }
    },
    component: AdminDashboardLayout,
})

function AdminDashboardLayout() {
    return (
        <div>
            <nav className="p-2 bg-gray-200">
                <Link to='/admin-dashboard/map'>Map</Link>
                <Link to='/admin-dashboard/players'>Players</Link>
                <Link to='/admin-dashboard/networks'>Networks</Link>
                <Link to='/admin-dashboard/climate'>Climate</Link>
            </nav>
            <main className="p-4">
                <Outlet />
            </main>
        </div>
    )
}