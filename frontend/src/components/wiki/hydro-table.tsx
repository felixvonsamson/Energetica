export function HydroTable() {
    const hydroPotentials = [0, 20, 40, 60, 80, 100];
    const existingFacilities = [0, 1, 2, 3, 4, 5, 6, 7] as const;

    // Hydro cost multiplier data: [existingFacilities][hydroPotential]
    const costMultipliers = {
        0: [8.0, 2.2, 1.4, 1.2, 1.1, 1.0],
        1: [55, 6.0, 2.6, 1.7, 1.4, 1.2],
        2: ["99+", 18, 5.3, 2.8, 2.0, 1.6],
        3: ["99+", 60, 12, 4.9, 3.0, 2.2],
        4: ["99+", "99+", 27, 9.0, 4.7, 3.1],
        5: ["99+", "99+", 62, 17, 7.7, 4.6],
        6: ["99+", "99+", "99+", 33, 13, 6.9],
        7: ["99+", "99+", "99+", 63, 22, 10.6],
    };

    const getCellColor = (value: string | number) => {
        if (value === "99+") return "text-destructive";
        const numValue = typeof value === "number" ? value : parseFloat(value);
        if (numValue <= 2.0) return "text-success";
        if (numValue >= 10) return "text-destructive";
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
                            <th colSpan={6}>Hydro potential</th>
                        </tr>
                        <tr>
                            <th />
                            {hydroPotentials.map((potential) => (
                                <th key={potential}>{potential}%</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {existingFacilities.map((facilities) => (
                            <tr key={facilities}>
                                <th>{facilities}</th>
                                {hydroPotentials.map(
                                    (potential, potentialIndex) => {
                                        const value =
                                            costMultipliers[facilities][
                                                potentialIndex
                                            ];
                                        return (
                                            <td
                                                key={potential}
                                                className={getCellColor(value)}
                                            >
                                                {value}
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
