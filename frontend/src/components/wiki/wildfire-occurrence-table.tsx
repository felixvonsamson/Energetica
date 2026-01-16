export function WildfireOccurrenceTable() {
    const temperatureAnomalies = [-2, -1, 0, 1, 2, 3, 4];
    const referenceTemps = [11.75, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.55];

    // Occurrence data: [refTemp][anomaly]
    const occurrences: Record<number, (number | null)[]> = {
        11.75: [null, null, null, null, null, 0.2, 1.07],
        12: [null, null, null, null, null, 0.35, 1.4],
        12.5: [null, null, null, null, 0.09, 0.79, 2.19],
        13: [null, null, null, null, 0.35, 1.4, 3.15],
        13.5: [null, null, null, 0.09, 0.79, 2.19, 4.29],
        14: [null, null, null, 0.35, 1.4, 3.15, 5.6],
        14.5: [null, null, 0.09, 0.79, 2.19, 4.29, 7.09],
        15: [null, null, 0.35, 1.4, 3.15, 5.6, 8.75],
        15.55: [null, 0.11, 0.84, 2.28, 4.41, 7.25, 10.78],
    };

    const getCellColor = (value: number | null) => {
        if (value === null) return "text-green-600";
        if (value >= 1) return "text-red-600";
        return "";
    };

    return (
        <div className="flex justify-center my-8">
            <div className="overflow-x-auto">
                <table className="border-collapse">
                    <thead>
                        <tr>
                            <th className="p-2" />
                            <th className="p-2" colSpan={7}>
                                Temperature Anomaly
                            </th>
                        </tr>
                        <tr>
                            <th className="p-2">Reference Temperature</th>
                            {temperatureAnomalies.map((anomaly) => (
                                <th key={anomaly} className="p-2">
                                    {anomaly > 0 ? "+" : ""}
                                    {anomaly}°C
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {referenceTemps.map((refTemp) => (
                            <tr key={refTemp}>
                                <th className="p-2">{refTemp}°C</th>
                                {occurrences[refTemp].map((value, index) => (
                                    <td
                                        key={temperatureAnomalies[index]}
                                        className={`p-2 text-center ${getCellColor(value)}`}
                                    >
                                        {value === null ? "-" : value}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
