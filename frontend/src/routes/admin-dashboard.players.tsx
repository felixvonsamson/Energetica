import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/players')({
    component: AdminPlayerPage,
})

function AdminPlayerPage() {
    return (
        <div className="p-2">
            <h3>Welcome to players!</h3>
        </div>
    )
}