export function HeatwaveOccurrenceTable() {
    const temperatureAnomalies = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    const referenceTemps = [11.75, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.55];

    // Occurrence data: [refTemp][anomaly]
    const occurrences: Record<number, (number | null)[]> = {
        11.75: [null, null, null, null, null, null, null, null, 0.32],
        12: [null, null, null, null, null, null, null, 0.01, 0.5],
        12.5: [null, null, null, null, null, null, null, 0.17, 1.01],
        13: [null, null, null, null, null, null, 0.01, 0.5, 1.69],
        13.5: [null, null, null, null, null, null, 0.17, 1.01, 2.55],
        14: [null, null, null, null, null, 0.01, 0.5, 1.69, 3.58],
        14.5: [null, null, null, null, null, 0.17, 1.01, 2.55, 4.79],
        15: [1.12, 0.63, 0.28, 0.07, 0.01, 0.57, 1.97, 4.21, 7.29],
        15.55: [4.2, 2.36, 1.05, 0.26, 0.2, 1.33, 3.7, 7.28, 12.1],
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
                            <th className="p-2" colSpan={9}>
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
