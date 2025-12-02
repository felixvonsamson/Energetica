import { usePlayers } from "@hooks/usePlayers";

export default function PlayerList() {
    const { data: players, isPending, error } = usePlayers();

    if (isPending) return "Loading...";

    if (error) return "An error has occurred: " + error.message;

    return (
        <div>
            {players.map((player) => (
                <p>{player.username}</p>
            ))}
        </div>
    );
}
