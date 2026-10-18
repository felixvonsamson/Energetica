export function TimeConversionTable() {
    const conversions = [
        { realTime: "30 sec", inGameTime: "4 min", ticks: 1 },
        { realTime: "8 min", inGameTime: "1 hour", ticks: 15 },
        { realTime: "3 hours", inGameTime: "1 day / 24h", ticks: 360 },
        { realTime: "18 hours", inGameTime: "1 month / 6d", ticks: 2160 },
        { realTime: "9 days", inGameTime: "1 year / 12m", ticks: 25920 },
        { realTime: "3 months", inGameTime: "10 years", ticks: 259200 },
    ];

    return (
        <div className="flex items-center justify-center my-8">
            <div className="relative flex items-center">
                <table>
                    <thead>
                        <tr>
                            <th>Real Time</th>
                            <th>In-game Time</th>
                            <th>Game Ticks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {conversions.map((conversion) => (
                            <tr key={conversion.ticks}>
                                <td>{conversion.realTime}</td>
                                <td>{conversion.inGameTime}</td>
                                <td>{conversion.ticks}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
