import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/map')({
    component: RouteComponent,
})

function RouteComponent() {
    return <div>Hello "/admin-dashboard/map"!</div>
}
