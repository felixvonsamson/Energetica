import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/climate')({
    component: RouteComponent,
    staticData: {
        title: 'Climate'
    }
})

function RouteComponent() {
    return (
        <div>
            <h3>Welcome to climate!</h3>
        </div>
    )
}
