import { usePlayers } from "../hooks/usePlayers";

function RightSidebar() {
    return (
        <div className="topRight_info">
            <PlayerSelector />
        </div>
    );
}

function PlayerSelector() {
    const { data: players, isPending, error } = usePlayers();

    if (isPending) return "Loading...";

    if (error) return "An error has occurred: " + error.message;

    return (
        <>
            <label htmlFor="admin_player_selector">
                Select a player to observe
            </label>
            <select
                id="admin_player_selector"
                className="create_chat_input medium txt_center"
            >
                <option value="" disabled selected>
                    select player
                </option>
                {players.map((player) => (
                    <option key={player.id} value={player.id}>
                        {player.username}
                    </option>
                ))}
            </select>
        </>
    );
}

export default RightSidebar;
