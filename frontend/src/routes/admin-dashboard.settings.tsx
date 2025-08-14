import { createFileRoute } from '@tanstack/react-router'
import SetNewPassword from '../components/SetNewPassword/SetNewPassword'

export const Route = createFileRoute('/admin-dashboard/settings')({
    component: AdminSettingsPage,
    staticData: {
        title: 'Settings'
    }
})

function AdminSettingsPage() {
    return (
        <div>
            <h3>Welcome to settings!</h3>
            <SetNewPassword />
        </div>
    )
}