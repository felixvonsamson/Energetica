import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/networks')({
    component: RouteComponent,
})

function RouteComponent() {
    return (
        <div className="p-2">
            <h3>Welcome to networks!</h3>
        </div>
    )
}
