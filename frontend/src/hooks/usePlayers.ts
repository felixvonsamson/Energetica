import { useQuery } from "@tanstack/react-query";

export function usePlayers() {
    return useQuery<Player[]>({
        queryKey: ["players"],
        queryFn: async () => {
            const response = await fetch("/api/v1/players");
            return await response.json();
        },
    });
}
