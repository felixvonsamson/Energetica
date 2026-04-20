import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { CardContent, CardHeader, CardTitle, PageCard } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";

export const Route = createFileRoute("/admin-dashboard/")({
    component: AdminPlayersPage,
    staticData: {
        title: "Players",
        routeConfig: { requiredRole: "admin" },
    },
});

function AdminPlayersPage() {
    const { data: players, isLoading, isError } = useQuery({
        queryKey: ["admin", "players"],
        queryFn: adminApi.getPlayers,
    });

    return (
        <div className="p-6 max-w-3xl">
            <PageCard>
                <CardHeader>
                    <CardTitle>Players</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading && (
                        <p className="text-muted-foreground text-sm">Loading...</p>
                    )}
                    {isError && (
                        <p className="text-destructive text-sm">Failed to load players.</p>
                    )}
                    {players && players.length === 0 && (
                        <p className="text-muted-foreground text-sm">No players yet.</p>
                    )}
                    {players && players.length > 0 && (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    <th className="pb-2 font-medium text-muted-foreground w-16">ID</th>
                                    <th className="pb-2 font-medium text-muted-foreground">Username</th>
                                </tr>
                            </thead>
                            <tbody>
                                {players.map((player) => (
                                    <tr key={player.id} className="border-b last:border-0">
                                        <td className="py-2 text-muted-foreground">{player.id}</td>
                                        <td className="py-2">{player.username}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </PageCard>
        </div>
    );
}
