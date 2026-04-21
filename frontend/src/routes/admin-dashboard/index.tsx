import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban } from "lucide-react";

import { CardContent, CardHeader, CardTitle, PageCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { adminApi } from "@/lib/api/admin";

export const Route = createFileRoute("/admin-dashboard/")({
    component: AdminPlayersPage,
    staticData: {
        title: "Players",
        routeConfig: { requiredRole: "admin" },
    },
});

function AdminPlayersPage() {
    const queryClient = useQueryClient();

    const { data: players, isLoading, isError } = useQuery({
        queryKey: ["admin", "players"],
        queryFn: adminApi.getPlayers,
    });

    const banMutation = useMutation({
        mutationFn: adminApi.banPlayer,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["admin", "players"] });
        },
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
                    {players && (players.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No players yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    <th className="pb-2 font-medium text-muted-foreground w-16">ID</th>
                                    <th className="pb-2 font-medium text-muted-foreground">Username</th>
                                    <th className="pb-2 w-20" />
                                </tr>
                            </thead>
                            <tbody>
                                {players.map((player) => (
                                    <tr key={player.id} className="border-b last:border-0">
                                        <td className="py-2 text-muted-foreground">{player.id}</td>
                                        <td className="py-2">{player.username}</td>
                                        <td className="py-2 text-right">
                                            <ConfirmDialog
                                                trigger={
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Ban size={14} />
                                                        Ban
                                                    </Button>
                                                }
                                                title={`Ban ${player.username}?`}
                                                description={
                                                    <>
                                                        This will permanently delete{" "}
                                                        <strong>{player.username}</strong>'s account,
                                                        liberate their tile, remove them from all
                                                        markets and chats. This cannot be undone.
                                                    </>
                                                }
                                                confirmLabel="Ban player"
                                                variant="danger"
                                                onConfirm={() => banMutation.mutate(player.id)}
                                                isPending={banMutation.isPending && banMutation.variables === player.id}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ))}
                </CardContent>
            </PageCard>
        </div>
    );
}
