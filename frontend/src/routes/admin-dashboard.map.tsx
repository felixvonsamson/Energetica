import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/map')({
    component: RouteComponent,
})

function RouteComponent() {
    return (
        <div className="p-2">
            <h3>Welcome to map!</h3>
        </div>
    )
}
