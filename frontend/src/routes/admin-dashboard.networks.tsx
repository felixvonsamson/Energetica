import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/networks')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin-dashboard/networks"!</div>
}
