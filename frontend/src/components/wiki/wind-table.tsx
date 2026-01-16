export function WindTable() {
    const windPotentials = [0, 20, 40, 60, 80, 100];
    const existingFacilities = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] as const;

    // Wind capacity factor data: [existingFacilities][windPotential]
    const capacityFactors = {
        0: [47, 52, 52, 52, 52, 52],
        2: [20, 46, 50, 51, 52, 52],
        4: [10, 34, 45, 49, 50, 51],
        6: [7, 24, 39, 45, 48, 50],
        8: [5, 18, 31, 40, 45, 48],
        10: [4, 14, 26, 35, 42, 45],
        12: [3, 11, 21, 30, 37, 42],
        14: [3, 10, 18, 26, 33, 39],
        16: [2, 8, 15, 23, 30, 36],
        18: [2, 7, 13, 20, 27, 32],
        20: [2, 6, 12, 18, 24, 29],
    };

    const getCellColor = (value: number) => {
        if (value >= 40) return "text-green-600";
        if (value < 20) return "text-red-600";
        return "";
    };

    return (
        <div className="flex items-center justify-center my-8">
            <div className="relative flex items-center">
                <div className="absolute -left-24 top-1/2 -translate-y-1/2 -rotate-90 origin-center">
                    <b className="text-sm whitespace-nowrap">
                        Existing facilities
                    </b>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th />
                            <th colSpan={6}>Wind potential</th>
                        </tr>
                        <tr>
                            <th />
                            {windPotentials.map((potential) => (
                                <th key={potential}>{potential}%</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {existingFacilities.map((facilities) => (
                            <tr key={facilities}>
                                <th>{facilities}</th>
                                {windPotentials.map(
                                    (potential, potentialIndex) => {
                                        const value =
                                            capacityFactors[facilities][
                                                potentialIndex
                                            ];
                                        return (
                                            <td
                                                key={potential}
                                                className={getCellColor(value)}
                                            >
                                                {value}%
                                            </td>
                                        );
                                    },
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
