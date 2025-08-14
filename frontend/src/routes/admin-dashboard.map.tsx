import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/map')({
    component: RouteComponent,
    staticData: {
        title: 'Map'
    }
})

function RouteComponent() {
    return (
        <div>
            <h3>Welcome to map!</h3>
        </div>
    )
}
