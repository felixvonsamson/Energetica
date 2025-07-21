import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/climate')({
    component: RouteComponent,
})

function RouteComponent() {
    return (
        <div className="p-2">
            <h3>Welcome to climate!</h3>
        </div>
    )
}
