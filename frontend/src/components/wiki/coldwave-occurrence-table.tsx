export function ColdwaveOccurrenceTable() {
    const temperatureAnomalies = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    const referenceTemps = [11.75, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.55];

    // Occurrence data: [refTemp][anomaly]
    const occurrences: Record<number, (number | null)[]> = {
        11.75: [12.1, 7.28, 3.7, 1.33, 0.2, 0.26, 1.05, 2.36, 4.2],
        12: [9.89, 5.86, 2.89, 0.96, 0.09, 0.18, 0.7, 1.58, 2.8],
        12.5: [5.6, 3.15, 1.4, 0.35, null, null, null, null, null],
        13: [4.29, 2.19, 0.79, 0.09, null, null, null, null, null],
        13.5: [3.15, 1.4, 0.35, null, null, null, null, null, null],
        14: [2.19, 0.79, 0.09, null, null, null, null, null, null],
        14.5: [1.4, 0.35, null, null, null, null, null, null, null],
        15: [0.79, 0.09, null, null, null, null, null, null, null],
        15.55: [0.32, null, null, null, null, null, null, null, null],
    };

    const getCellColor = (value: number | null) => {
        if (value === null) return "text-success";
        if (value >= 1) return "text-destructive";
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
