import { useQuery } from '@tanstack/react-query'

export default function PlayerList() {
    const { isPending, error, data: players, isFetching } = useQuery({
        queryKey: ['players'],
        queryFn: async () => {
            const response = await fetch('/api/v1/players')
            return await response.json() as Promise<Player[]>
        },
    })

    if (isPending) return 'Loading...'

    if (error) return 'An error has occurred: ' + error.message

    return (
        <div>
            {players.map((player) => (
                <p>{player.username}</p>
            ))}
        </div>
    )
}