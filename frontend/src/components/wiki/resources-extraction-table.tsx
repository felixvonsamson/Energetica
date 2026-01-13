export function ResourcesExtractionTable() {
    const resources = [
        { name: "Coal", rate: 0.1 },
        { name: "Gas", rate: 0.2 },
        { name: "Uranium", rate: 0.005 },
    ];

    return (
        <div className="flex items-center justify-center my-8">
            <div className="relative flex items-center">
                <table>
                    <thead>
                        <tr>
                            <th>Resource</th>
                            <th>Extraction Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resources.map((resource) => (
                            <tr key={resource.name}>
                                <td>{resource.name}</td>
                                <td>{resource.rate}% /day (ig)</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
